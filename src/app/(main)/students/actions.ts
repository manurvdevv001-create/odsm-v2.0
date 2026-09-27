"use server";

import { db } from "@/lib/db";
import { assertStudentInActiveYear, getActiveYearForSchool } from '@/lib/year-guards';
import { Payment, Student, Guardian } from "@/types";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";
import { resolvePersonContact } from "@/lib/person-contact";



// Utility to generate transaction number
function generateTransactionNumber(counter: number, format?: string | null): string {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    if (format) {
        return format
            .replace('{YYYY}', year)
            .replace('{YY}', year.slice(-2))
            .replace('{MM}', month)
            .replace(/{NO:(\d+)}/g, (_, p1) => counter.toString().padStart(parseInt(p1), '0'))
            // Fallback if no NO token
            .replace('{NO}', counter.toString().padStart(4, '0'));
    }

    // Default legacy format
    const yearShort = year.slice(-2);
    const day = date.getDate().toString().padStart(2, '0');
    const seq = counter.toString().padStart(5, '0');
    return `TRN${yearShort}${month}${day}-${seq}`;
}

// Save image implementation - simple base64 to file logic or just returning base64 if we want to store it in DB
// Or adapting to v2's strategy (e.g. saving to public/uploads like in staff)
async function saveImageAndGetPath(base64Data: string | null | undefined, namePrefix: string): Promise<string | null> {
    if (!base64Data) return null;

    // Check if it's already a URL
    if (base64Data.startsWith('http') || base64Data.startsWith('/')) {
        return base64Data;
    }

    // For now we'll just return the base64 string if it's a data URL
    // In a real app we'd write to the filesystem, but to avoid `fs` errors in edge/client contexts
    // we keep it simple or implement the actual fs logic if needed. 
    // Usually in Next.js Server Actions, we can use `fs` if it's forced to Node.js.
    // Let's implement basic file saving via fs.

    if (!base64Data.startsWith('data:image')) {
        return null; // Not a valid base64 image
    }

    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const crypto = await import('crypto');

        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            return null;
        }

        const extension = matches[1].split('/')[1] || 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const randomString = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const fileName = `${namePrefix}_${timestamp}_${randomString}.${extension}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, fileName);
        await fs.writeFile(filePath, buffer);

        return `/uploads/${fileName}`;
    } catch (e) {
        console.error("Error saving image:", e);
        // Fallback to returning base64 if fs fails
        return base64Data;
    }
}

export async function saveStudentData(matricule: string, studentData: any, paymentData?: Payment, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule) {
        return { success: false, error: 'Matricule de l\'école non fourni.' };
    }
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, financeSettings: true, transactionCounter: true, configuration: true }
        });

        if (!school) {
            throw new Error("École non trouvée !");
        }

        const calendar = JSON.parse(school.calendar || '{}');
        const activeYear = calendar.schoolYear;
        if (!activeYear) {
            throw new Error("Action bloquée : Aucune année scolaire active n'est configurée.");
        }

        // Prevent creating a student for an archived year
        if (studentData.schoolYear && studentData.schoolYear !== activeYear) {
            throw new Error("Impossible d'inscrire un élève dans une année scolaire antérieure/archivée.");
        }

        // License Validation
        if (studentData.classroom) {
            const { checkLicense } = await import('@/lib/license-check');
            const licenseStatus = await checkLicense(matricule);
            if (licenseStatus.isValid && licenseStatus.restrictions?.maxStudentsPerClassroom) {
                const limit = licenseStatus.restrictions.maxStudentsPerClassroom;
                const currentCount = await db.student.count({
                    where: { schoolMatricule: matricule, classroomName: studentData.classroom, status: "ACTIVE" }
                });
                if (currentCount >= limit) {
                    throw new Error(`La licence actuelle limite à ${limit} le nombre d'élèves par local (Classe pleine : ${studentData.classroom}).`);
                }
            }
        }

        // Save photo
        const studentPhotoPath = await saveImageAndGetPath(studentData.photo, `${matricule}_student_${studentData.lastName.toLowerCase()}`);

        // Generate Student Number
        let finalStudentNumber = studentData.studentNumber;
        if (!finalStudentNumber || finalStudentNumber.startsWith('ST20')) {
            const { generateStudentNumber } = await import('@/lib/student-numbering');
            const genResult = await generateStudentNumber(matricule, studentData.level || 'PRIMAIRE');
            if (genResult.success && genResult.studentNumber) {
                finalStudentNumber = genResult.studentNumber;
            } else {
                finalStudentNumber = `ST20-${Date.now().toString().slice(-6)}`;
            }
        }

        // Determine Payment Category fallback manually for simplicity if undefined
        let paymentCategoryId = studentData.paymentCategoryId;

        let finalGuardianId = studentData.guardianId;

        // If inline guardian creation is requested
        if (studentData.guardianId === 'new') {
            const newGuardian = await db.$transaction(async tx => {
                const contact = await resolvePersonContact(tx, {
                    schoolMatricule: matricule,
                    role: "guardian",
                    phone: studentData.guardianPhone,
                    selectedId: studentData.guardianPersonContactId,
                    identity: {
                        firstName: studentData.guardianFirstName,
                        lastName: studentData.guardianLastName,
                        middleName: studentData.guardianMiddleName,
                    },
                });
                return tx.guardian.create({
                    data: {
                        schoolMatricule: matricule,
                        personContactId: contact.id,
                        firstName: contact.identity.firstName,
                        lastName: contact.identity.lastName,
                        middleName: contact.identity.middleName,
                        phone: contact.phone!,
                        address: studentData.guardianAddress,
                    },
                });
            });
            finalGuardianId = newGuardian.id;
        }

        // Create student
        const studentCreateData: any = {
            matricule: finalStudentNumber,
            schoolMatricule: matricule,
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            middleName: studentData.middleName || null,
            gender: studentData.gender,
            birthDate: studentData.birthDate,
            placeOfBirth: studentData.placeOfBirth || '',
            address: studentData.address || '',
            photo: studentPhotoPath,
            status: studentData.status || 'pending_payment',
            gradeName: studentData.gradeName,
            classroomName: studentData.classroomName || null,
            level: studentData.level,
            paymentCategoryId: paymentCategoryId || null,
            schoolYear: activeYear,
            guardianId: finalGuardianId || null,
            data: JSON.stringify({
                parentInfo: studentData.parentInfo || {},
                healthInfo: studentData.healthInfo || {},
                previousSchool: studentData.previousSchool || null
            })
        };

        if (studentData.id && !studentData.id.startsWith('std_')) {
            studentCreateData.id = studentData.id;
        }

        const newStudent = await db.student.create({
            data: studentCreateData
        });

        // Create payment if provided
        if (paymentData) {
            const newCounter = (school.transactionCounter || 0) + 1;
            const receiptFormat = JSON.parse(school.configuration || '{}').receiptSettings?.numberFormat || null;
            const transactionNumber = generateTransactionNumber(newCounter, receiptFormat);

            await db.payment.create({
                data: {
                    id: paymentData.id,
                    transactionNo: transactionNumber,
                    date: new Date(paymentData.date),
                    amount: paymentData.totalAmountPaid,
                    dispensationAmount: paymentData.totalDispensationAmount || 0,
                    currency: paymentData.currency,
                    type: paymentData.type,
                    label: paymentData.label || null,
                    collectorName: paymentData.collectorName || null,
                    paymentMethod: paymentData.paymentMethod || 'caisse',
                    paymentProvider: paymentData.paymentProvider || null,
                    paymentReference: paymentData.paymentReference || null,
                    schoolYear: activeYear,
                    studentId: newStudent.id,
                    schoolMatricule: matricule,
                    details: {
                        create: (paymentData.details || []).map(d => ({
                            feeName: d.feeItemId,
                            amount: d.amountPaid,
                            dispensationAmount: d.dispensationAmount || 0,
                            dispensationReason: d.dispensationReason || null,
                        }))
                    }
                }
            });

            await db.school.update({
                where: { matricule },
                data: { transactionCounter: newCounter }
            });
        }

        await logActivity(
            matricule, 
            `Nouvel élève inscrit (${activeYear}) : ${studentData.lastName} ${studentData.firstName} (${finalStudentNumber}) - Classe: ${studentData.gradeName}`, 
            executorName,
            "success",
            activeYear,
            {
                studentId: newStudent.id,
                studentName: `${studentData.lastName} ${studentData.firstName}`,
                grade: studentData.gradeName,
                classroom: studentData.classroomName,
                hasInitialPayment: !!paymentData
            }
        );

        // Explicit return required logic
        return { success: true };
    } catch (error: any) {
        console.error("saveStudentData Error:", error);
        return { success: false, error: error.message };
    }
}

export async function updateStudentData(matricule: string, studentId: string, studentUpdates: Partial<Student>, executorName?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const existingStudent = await db.student.findUnique({
            where: { id: studentId },
            select: { photo: true, lastName: true, matricule: true }
        });

        if (!existingStudent) throw new Error("Élève non trouvé !");

        // Block updates for students not in the active year
        await assertStudentInActiveYear(matricule, studentId);

        let photoPath = existingStudent.photo;
        if (studentUpdates.photo && studentUpdates.photo.startsWith('data:image')) {
            photoPath = await saveImageAndGetPath(studentUpdates.photo, `${matricule}_student_${studentUpdates.lastName || existingStudent.lastName}`);
        }

        const updateData: any = {};
        if (studentUpdates.firstName) updateData.firstName = studentUpdates.firstName;
        if (studentUpdates.lastName) updateData.lastName = studentUpdates.lastName;
        if (studentUpdates.middleName !== undefined) updateData.middleName = studentUpdates.middleName;
        if (studentUpdates.gender) updateData.gender = studentUpdates.gender;
        if (studentUpdates.birthDate) updateData.birthDate = studentUpdates.birthDate;
        if (studentUpdates.placeOfBirth !== undefined) updateData.placeOfBirth = studentUpdates.placeOfBirth;
        if (studentUpdates.address !== undefined) updateData.address = studentUpdates.address;
        if (photoPath) updateData.photo = photoPath;
        if (studentUpdates.status) updateData.status = studentUpdates.status;
        if (studentUpdates.gradeName) updateData.gradeName = studentUpdates.gradeName;
        if (studentUpdates.classroomName !== undefined) updateData.classroomName = studentUpdates.classroomName;
        if (studentUpdates.level) updateData.level = studentUpdates.level;
        if (studentUpdates.paymentCategoryId !== undefined) updateData.paymentCategoryId = studentUpdates.paymentCategoryId;

        await db.student.update({
            where: { id: studentId },
            data: updateData
        });

        const studentIdLog = existingStudent.matricule ? ` (${existingStudent.matricule})` : '';
        await logActivity(
            matricule, 
            `La fiche de l'élève ${studentUpdates.lastName || existingStudent.lastName} ${studentUpdates.firstName || ''}${studentIdLog} a été mise à jour.`, 
            executorName,
            "info",
            undefined,
            {
                studentId,
                updates: Object.keys(updateData)
            }
        );
        return { success: true };
    } catch (error: any) {
        console.error("updateStudentData Error:", error);
        return { success: false, error: error.message };
    }
}

export async function updateStudentPaymentStatus(matricule: string, studentId: string, paymentData: Payment, executorName?: string): Promise<{ success: boolean, error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, transactionCounter: true, configuration: true }
        });

        if (!school) throw new Error("École non trouvée !");

        const activeYear = JSON.parse(school.calendar || '{}').schoolYear;
        if (!activeYear) throw new Error("Aucune année scolaire active.");

        const newCounter = (school.transactionCounter || 0) + 1;
        const receiptFormat = JSON.parse(school.configuration || '{}').receiptSettings?.numberFormat || null;
        const transactionNumber = generateTransactionNumber(newCounter, receiptFormat);

        // Block payment/status updates for archived-year students
        await assertStudentInActiveYear(matricule, studentId);

        await db.$transaction([
            db.student.update({
                where: { id: studentId },
                data: { status: 'active' }
            }),
            db.payment.create({
                data: {
                    id: paymentData.id,
                    studentId: studentId,
                    schoolMatricule: matricule,
                    type: paymentData.type,
                    amount: paymentData.totalAmountPaid,
                    dispensationAmount: paymentData.totalDispensationAmount || 0,
                    currency: paymentData.currency,
                    date: new Date(paymentData.date),
                    transactionNo: transactionNumber,
                    label: paymentData.label || null,
                    collectorName: paymentData.collectorName || null,
                    schoolYear: activeYear,
                    details: {
                        create: (paymentData.details || []).map(d => ({
                            feeName: d.feeItemId,
                            amount: d.amountPaid,
                            dispensationAmount: d.dispensationAmount || 0,
                            dispensationReason: d.dispensationReason || null,
                        }))
                    }
                }
            }),
            db.school.update({
                where: { matricule },
                data: { transactionCounter: newCounter }
            })
        ]);

        const student = await db.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
        await logActivity(
            matricule, 
            `Paiement d'inscription enregistré pour l'élève ${student?.lastName} ${student?.firstName}. Statut mis à jour vers 'active'.`, 
            executorName,
            "success",
            activeYear,
            {
                studentId,
                studentName: `${student?.lastName} ${student?.firstName}`,
                amount: paymentData.totalAmountPaid,
                currency: paymentData.currency
            }
        );

        return { success: true };
    } catch (error: any) {
        console.error("updateStudentPaymentStatus Error:", error);
        return { success: false, error: error.message };
    }
}

export async function createGuardian(matricule: string, guardianData: Partial<Guardian>, executorName?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        if (!guardianData.firstName || !guardianData.lastName || !guardianData.phone || !guardianData.address) {
            throw new Error("Nom, prénom, téléphone et adresse sont obligatoires pour le tuteur.");
        }
        const newGuardian = await db.$transaction(async tx => {
            const contact = await resolvePersonContact(tx, {
                schoolMatricule: matricule,
                role: "guardian",
                phone: guardianData.phone,
                selectedId: guardianData.personContactId,
                identity: {
                    firstName: guardianData.firstName!,
                    lastName: guardianData.lastName!,
                    middleName: guardianData.middleName,
                },
            });
            return tx.guardian.create({
                data: {
                    schoolMatricule: matricule,
                    personContactId: contact.id,
                    firstName: contact.identity.firstName,
                    lastName: contact.identity.lastName,
                    middleName: contact.identity.middleName,
                    phone: contact.phone!,
                    email: guardianData.email || null,
                    profession: guardianData.profession || null,
                    address: guardianData.address!,
                },
            });
        });
        await logActivity(matricule, `Nouveau tuteur ajouté: ${guardianData.firstName} ${guardianData.lastName}`, executorName);
        return { success: true, data: newGuardian };
    } catch (error: any) {
        console.error("createGuardian Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getGuardians(matricule: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const guardians = await db.guardian.findMany({
            where: { schoolMatricule: matricule },
            include: { students: true }
        });
        return { success: true, data: guardians };
    } catch (error: any) {
        console.error("getGuardians Error:", error);
        return { success: false, error: error.message };
    }
}

export async function saveSchoolFeePayment(matricule: string, paymentData: Payment, executorName?: string): Promise<{ success: boolean; error?: string; data?: any }> {
    if (!matricule) {
        return { success: false, error: 'Matricule de l\'école non fourni.' };
    }
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, transactionCounter: true, configuration: true }
        });

        if (!school) {
            throw new Error("Document de l'école non trouvé !");
        }

        const calendar = JSON.parse(school.calendar || '{}');
        const activeYear = calendar.schoolYear;
        if (!activeYear) {
            throw new Error("Paiement refusé : Aucune année scolaire active n'est configurée.");
        }

        const newCounter = (school.transactionCounter || 0) + 1;
        const receiptFormat = JSON.parse(school.configuration || '{}').receiptSettings?.numberFormat || null;
        const transactionNumber = generateTransactionNumber(newCounter, receiptFormat);

        // Ensure we're not adding payments for archived-year students
        if (paymentData.studentId) {
            await assertStudentInActiveYear(matricule, paymentData.studentId);
        }

        await db.$transaction([
            db.payment.create({
                data: {
                    id: paymentData.id,
                    transactionNo: transactionNumber,
                    date: new Date(paymentData.date),
                    amount: paymentData.totalAmountPaid,
                    dispensationAmount: paymentData.totalDispensationAmount || 0,
                    currency: paymentData.currency,
                    type: paymentData.type,
                    label: paymentData.label || null,
                    collectorName: paymentData.collectorName || null,
                    paymentMethod: paymentData.paymentMethod || 'caisse',
                    paymentProvider: paymentData.paymentProvider || null,
                    paymentReference: paymentData.paymentReference || null,
                    schoolYear: activeYear,
                    studentId: paymentData.studentId,
                    schoolMatricule: matricule,
                    details: {
                        create: (paymentData.details || []).map(d => ({
                            feeName: d.feeItemId,
                            amount: d.amountPaid,
                            dispensationAmount: d.dispensationAmount,
                            dispensationReason: d.dispensationReason || null,
                        }))
                    }
                }
            }),
            db.school.update({
                where: { matricule },
                data: { transactionCounter: newCounter }
            })
        ]);

        const student = await db.student.findUnique({
            where: { id: paymentData.studentId },
            select: { lastName: true, firstName: true, matricule: true }
        });

        const studentName = student ? `${student.lastName} ${student.firstName} (${student.matricule})` : "Élève inconnu";

        await logActivity(
            matricule, 
            `Paiement (${activeYear}) de ${paymentData.totalAmountPaid.toLocaleString()} ${paymentData.currency} enregistré pour ${studentName}.`, 
            executorName,
            "success",
            activeYear,
            {
                studentId: paymentData.studentId,
                studentName,
                amount: paymentData.totalAmountPaid,
                currency: paymentData.currency,
                transactionNo: transactionNumber,
                label: paymentData.label,
                details: paymentData.details?.map(d => ({ item: d.feeItemId, amount: d.amountPaid }))
            }
        );

        const savedPayment = {
            ...paymentData,
            transactionNumber: transactionNumber,
        };

        return { success: true, data: savedPayment };
    } catch (error: any) {
        console.error("saveSchoolFeePayment Error:", error);
        return {

            success: false,
            error: error.message || "Une erreur est survenue lors de l'enregistrement du paiement."
        };
    }
}

export async function assignStudentToCategory(matricule: string, studentId: string, categoryId: string, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule || !studentId) {
        return { success: false, error: "Informations manquantes." };
    }
    try {
        const student = await db.student.findUnique({
            where: { id: studentId }
        });

        if (!student) {
            throw new Error("Élève non trouvé !");
        }

        // Prevent moving student category for archived-year students
        await assertStudentInActiveYear(matricule, studentId);

        await db.student.update({
            where: { id: studentId },
            data: { paymentCategoryId: categoryId }
        });

        await logActivity(matricule, `L'élève ${student.lastName} ${student.firstName} a été déplacé vers une nouvelle catégorie de paiement.`, executorName);

        return { success: true };
    } catch (error: any) {
        console.error("assignStudentToCategory Error:", error);
        return { success: false, error: error.message || "Une erreur est survenue." };
    }
}
export async function deleteStudent(matricule: string, studentId: string, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule || !studentId) {
        return { success: false, error: "Informations manquantes." };
    }
    try {
        const student = await db.student.findUnique({
            where: { id: studentId },
            select: { lastName: true, firstName: true, matricule: true }
        });

        if (!student) {
            throw new Error("Élève non trouvé !");
        }

        // Block deletion for archived-year students
        await assertStudentInActiveYear(matricule, studentId);

        // Delete related student data first to avoid foreign key constraint violations.
        const paymentIds = await db.payment.findMany({
            where: { studentId },
            select: { id: true }
        });

        await db.$transaction([
            db.paymentDetail.deleteMany({ where: { paymentId: { in: paymentIds.map(payment => payment.id) } } }),
            db.payment.deleteMany({ where: { studentId } }),
            db.enrollment.deleteMany({ where: { studentId } }),
            db.studentResult.deleteMany({ where: { studentId } }),
            db.disciplineRecord.deleteMany({ where: { studentId } }),
            db.studentConduct.deleteMany({ where: { studentId } }),
            db.annualDecision.deleteMany({ where: { studentId } }),
            db.student.delete({ where: { id: studentId } })
        ]);

        await logActivity(matricule, `L'élève ${student.lastName} ${student.firstName} (${student.matricule}) a été supprimé de la base de données.`, executorName);

        return { success: true };
    } catch (error: any) {
        console.error("deleteStudent Error:", error);
        return { success: false, error: error.message || "Une erreur est survenue lors de la suppression." };
    }
}

export async function deleteGuardian(matricule: string, guardianId: string, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule || !guardianId) return { success: false, error: "Informations manquantes." };
    try {
        const guardian = await db.guardian.findUnique({
            where: { id: guardianId },
            include: { students: true }
        });
        if (!guardian) throw new Error("Tuteur non trouvé !");
        if (guardian.students && guardian.students.length > 0) {
            // If guardian has any students, prevent deletion. Additionally, if any of those students belong
            // to an archived year, we must prevent deletion/changes to protect archives.
            throw new Error("Impossible de supprimer ce tuteur car il a des élèves à sa charge. Les données d'archives ne peuvent pas être modifiées.");
        }

        // Extra safety: prevent deletion if guardian had students in archived years (read-only archive protection)
        const activeYear = await getActiveYearForSchool(matricule);
        if (guardian.students && guardian.students.some(s => s.schoolYear && activeYear && s.schoolYear !== activeYear)) {
            throw new Error("Action interdite : ce tuteur est lié à des élèves d'années archivées et ne peut être supprimé.");
        }

        await db.guardian.delete({
            where: { id: guardianId }
        });
        await logActivity(matricule, `Tuteur supprimé : ${guardian.lastName} ${guardian.firstName}`, executorName);
        return { success: true };
    } catch (error: any) {
        console.error("deleteGuardian Error:", error);
        return { success: false, error: error.message || "Une erreur est survenue lors de la suppression du tuteur." };
    }
}

export async function updateGuardian(matricule: string, guardianId: string, guardianData: Partial<Guardian>, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule || !guardianId) return { success: false, error: "Informations manquantes." };
    try {
        if (!guardianData.firstName || !guardianData.lastName || !guardianData.phone || !guardianData.address) {
            throw new Error("Nom, prénom, téléphone et adresse sont obligatoires pour le tuteur.");
        }

        // Prevent editing guardians that are linked to archived-year students
        const guardianRecord = await db.guardian.findUnique({ where: { id: guardianId }, include: { students: true } });
        const activeYear = await getActiveYearForSchool(matricule);
        if (guardianRecord && guardianRecord.students && guardianRecord.students.some(s => s.schoolYear && activeYear && s.schoolYear !== activeYear)) {
            throw new Error("Action interdite : ce tuteur est lié à des élèves d'années archivées et ne peut être modifié.");
        }

        await db.$transaction(async tx => {
            const contact = await resolvePersonContact(tx, {
                schoolMatricule: matricule,
                role: "guardian",
                phone: guardianData.phone,
                selectedId: guardianData.personContactId,
                existingRoleId: guardianId,
                identity: {
                    firstName: guardianData.firstName!,
                    lastName: guardianData.lastName!,
                    middleName: guardianData.middleName,
                },
            });
            await tx.guardian.update({
                where: { id: guardianId },
                data: {
                    personContactId: contact.id,
                    firstName: contact.identity.firstName,
                    lastName: contact.identity.lastName,
                    middleName: contact.identity.middleName,
                    phone: contact.phone!,
                    email: guardianData.email || null,
                    profession: guardianData.profession || null,
                    address: guardianData.address,
                },
            });
        });
        await logActivity(matricule, `Mise à jour des informations du tuteur : ${guardianData.firstName} ${guardianData.lastName}`, executorName);
        return { success: true };
    } catch (error: any) {
        console.error("updateGuardian Error:", error);
        return { success: false, error: error.message || "Une erreur est survenue lors de la modification du tuteur." };
    }
}

export async function updateStudentGuardian(matricule: string, studentId: string, newGuardianId: string | null, newGuardianData?: Partial<Guardian>, executorName?: string): Promise<{ success: boolean; error?: string }> {
    if (!matricule || !studentId) return { success: false, error: "Informations manquantes." };
    try {
        let finalGuardianId = newGuardianId;

        // Ensure the student belongs to the active year before changing guardian
        await assertStudentInActiveYear(matricule, studentId);

        // If inline guardian creation is requested
        if (newGuardianId === 'new' && newGuardianData) {
             if (!newGuardianData.firstName || !newGuardianData.lastName || !newGuardianData.phone || !newGuardianData.address) {
                throw new Error("Nom, prénom, téléphone et adresse sont obligatoires pour le nouveau tuteur.");
            }
            const newGuardian = await db.$transaction(async tx => {
                const contact = await resolvePersonContact(tx, {
                    schoolMatricule: matricule,
                    role: "guardian",
                    phone: newGuardianData.phone,
                    selectedId: newGuardianData.personContactId,
                    identity: {
                        firstName: newGuardianData.firstName!,
                        lastName: newGuardianData.lastName!,
                        middleName: newGuardianData.middleName,
                    },
                });
                return tx.guardian.create({
                    data: {
                        schoolMatricule: matricule,
                        personContactId: contact.id,
                        firstName: contact.identity.firstName,
                        lastName: contact.identity.lastName,
                        middleName: contact.identity.middleName,
                        phone: contact.phone!,
                        email: newGuardianData.email || null,
                        profession: newGuardianData.profession || null,
                        address: newGuardianData.address!,
                    },
                });
            });
            finalGuardianId = newGuardian.id;
            await logActivity(matricule, `Nouveau tuteur ajouté lors de la migration: ${newGuardianData.firstName} ${newGuardianData.lastName}`, executorName);
        }

        await db.student.update({
            where: { id: studentId },
            data: { guardianId: finalGuardianId }
        });

        const student = await db.student.findUnique({ where: { id: studentId } });
        if (finalGuardianId === null) {
            await logActivity(matricule, `L'élève ${student?.lastName} ${student?.firstName} a été retiré de son tuteur.`, executorName);
        } else {
            await logActivity(matricule, `Le tuteur de l'élève ${student?.lastName} ${student?.firstName} a été mis à jour.`, executorName);
        }

        return { success: true };
    } catch (error: any) {
        console.error("updateStudentGuardian Error:", error);
        return { success: false, error: error.message || "Une erreur est survenue lors de la mise à jour du tuteur de l'élève." };
    }
}
