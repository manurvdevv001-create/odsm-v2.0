// src/app/api/staff/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { generateStaffNumber } from "@/lib/staff-numbering";
import { logActivity, formatLogEntity } from "@/lib/activity-logger";
import fs from 'fs/promises';
import path from 'path';

async function saveImageAndGetPath(base64Data: string | null | undefined, name: string): Promise<string | null> {
    if (!base64Data || !base64Data.startsWith('data:image')) return null;

    try {
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        const matches = base64Data.match(/^data:(image\/(\w+));base64,(.*)$/);
        if (!matches || matches.length !== 4) return null;

        const imageType = matches[2];
        const base64 = matches[3];
        const buffer = Buffer.from(base64, 'base64');

        const filename = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.${imageType}`;
        const filepath = path.join(uploadsDir, filename);

        await fs.writeFile(filepath, buffer);
        return `/uploads/${filename}`;
    } catch (error) {
        console.error("Erreur lors de la sauvegarde de l'image:", error);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const matricule = req.nextUrl.searchParams.get("matricule");
    if (!matricule) return NextResponse.json({ error: "Matricule manquant" }, { status: 400 });

    try {
        const staff = await db.staffProfile.findMany({
            where: { schoolMatricule: matricule },
            orderBy: { lastName: 'asc' }
        });

        const parsed = staff.map((s: any) => {
            const isMassiveBase64 = s.photo && s.photo.startsWith('data:image') && s.photo.length > 100000;
            return {
                ...s,
                photo: isMassiveBase64 ? null : s.photo,
                levels: typeof s.levels === 'string' ? JSON.parse(s.levels) : (s.levels || []),
                assignedCourses: typeof s.assignedCourses === 'string' ? JSON.parse(s.assignedCourses) : (s.assignedCourses || []),
            };
        });

        return NextResponse.json(parsed);
    } catch (error) {
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { matricule, staffData, executorName = "Administrateur" } = body;

        // License Validation
        const { checkLicense } = await import('@/lib/license-check');
        const licenseStatus = await checkLicense(matricule);
        if (licenseStatus.isValid && licenseStatus.restrictions?.maxPersonnel) {
            const limit = licenseStatus.restrictions.maxPersonnel;
            const currentCount = await db.staffProfile.count({
                where: { schoolMatricule: matricule }
            });
            if (currentCount >= limit) {
                return NextResponse.json({ success: false, error: `La licence actuelle limite Ã  ${limit} le nombre de membres du personnel.` }, { status: 400 });
            }
        }

        if (!matricule || !staffData) {
            return NextResponse.json({ error: "DonnÃ©es manquantes" }, { status: 400 });
        }

        // Save Photo if present (do this once, before retry loop)
        let photoPath = null;
        if (staffData.photo) {
            photoPath = await saveImageAndGetPath(staffData.photo, `${matricule}_${staffData.lastName}`);
        }

        // Create Profile with retry loop for unique constraint collisions
        let newStaff;
        let staffNumber;
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                const numberingResponse = await generateStaffNumber(matricule, staffData.category, staffData.function);
                staffNumber = numberingResponse.success ? numberingResponse.staffNumber : null;

                newStaff = await db.staffProfile.create({
                    data: {
                        firstName: staffData.firstName,
                        lastName: staffData.lastName,
                        middleName: staffData.middleName,
                        birthDate: staffData.birthDate,
                        gender: staffData.gender,
                        phone: staffData.phone,
                        function: staffData.function,
                        category: staffData.category,
                        level: staffData.level,
                        levels: JSON.stringify(staffData.levels || []),
                        staffNumber,
                        photo: photoPath,
                        schoolMatricule: matricule
                    }
                });
                break;
            } catch (createError: any) {
                if (createError?.code === 'P2002') {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        throw new Error("Impossible de gÃ©nÃ©rer un numÃ©ro unique aprÃ¨s plusieurs tentatives");
                    }
                    continue;
                }
                throw createError;
            }
        }

        const staffLabel = formatLogEntity(`${staffData.lastName} ${staffData.firstName}`, staffNumber);
        if (!newStaff) {
            throw new Error("Échec de la création du membre du personnel.");
        }

        await logActivity(
            matricule,
            `Nouveau membre du personnel enregistré : ${staffLabel} (${staffData.function})`,
            executorName,
            "success",
            undefined,
            { staffId: newStaff.id, staffNumber, function: staffData.function, category: staffData.category }
        );

        return NextResponse.json({ success: true, data: newStaff });
    } catch (error: any) {
        console.error("POST Staff Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de l'enregistrement" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, staffData } = body;

        if (!id || !staffData) {
            return NextResponse.json({ error: "DonnÃ©es manquantes" }, { status: 400 });
        }

        // Handle photo update if a new base64 image was provided
        let photoPath = staffData.photo;
        if (staffData.photo && staffData.photo.startsWith('data:image')) {
            photoPath = await saveImageAndGetPath(staffData.photo, `staff_${id}`);
        }

        // Separate pedagogical fields from simple profile fields
        const { assignedClassroom, assignedClassrooms, assignedCourses, ...simpleFields } = staffData;

        const updateData: any = {
            firstName: simpleFields.firstName,
            lastName: simpleFields.lastName,
            middleName: simpleFields.middleName,
            birthDate: simpleFields.birthDate,
            gender: simpleFields.gender,
            phone: simpleFields.phone,
            function: simpleFields.function,
            category: simpleFields.category,
            level: simpleFields.level,
            ...(simpleFields.levels !== undefined && { levels: JSON.stringify(simpleFields.levels) }),
            ...(photoPath !== undefined && { photo: photoPath }),
        };

        // Handle assignedCourses (stored as JSON string in the profile)
        if (assignedCourses !== undefined) {
            updateData.assignedCourses = JSON.stringify(assignedCourses);
        }

        // Persist assignedClassroom on the StaffProfile directly
        // Normalisation : 0 élément → null, 1 élément → valeur simple, plusieurs → JSON
        if ('assignedClassrooms' in staffData) {
            const list = Array.isArray(assignedClassrooms) ? assignedClassrooms : [];
            updateData.assignedClassroom = list.length === 0 ? null : (list.length === 1 ? String(list[0]) : JSON.stringify(list));
        } else if ('assignedClassroom' in staffData) {
            updateData.assignedClassroom = assignedClassroom || null;
        }

        await db.$transaction(async (tx: any) => {
            // 1. Update the staff profile (includes assignedClassroom field)
            await tx.staffProfile.update({
                where: { id },
                data: updateData
            });

            // 2. Handle Titulaire Assignment (classroom link)
            if ('assignedClassroom' in staffData) {
                // Clear: remove this teacher from ANY classroom first
                await tx.classroom.updateMany({
                    where: { titulaireId: id },
                    data: { titulaireId: null }
                });

                // Assign new classroom if specified
                if (assignedClassroom) {
                    // Find the classroom by name (case-insensitive trim)
                    const targetName = assignedClassroom.trim().toLowerCase();
                    const allClassrooms = await tx.classroom.findMany({
                        where: { schoolMatricule: staffData.schoolMatricule || undefined },
                        select: { id: true, name: true }
                    });

                    const match = allClassrooms.find((c: any) =>
                        c.name.trim().toLowerCase() === targetName
                    );

                    if (match) {
                        await tx.classroom.update({
                            where: { id: match.id },
                            data: { titulaireId: id }
                        });
                    }
                }
            }
        });

        const staffProfile = await db.staffProfile.findUnique({ where: { id }, select: { lastName: true, firstName: true, staffNumber: true, schoolMatricule: true } });
        if (staffProfile && staffProfile.schoolMatricule) {
            const staffLabel = formatLogEntity(`${staffProfile.lastName} ${staffProfile.firstName}`, staffProfile.staffNumber);
            const executorName = body.executorName || "Administrateur";
            await logActivity(
                staffProfile.schoolMatricule,
                `Fiche du personnel mise Ã  jour : ${staffLabel}`,
                executorName,
                "info",
                undefined,
                { staffId: id, updatedFields: Object.keys(updateData) }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("PUT Staff Error:", error);
        return NextResponse.json({ error: error.message || "Erreur de mise Ã  jour" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    try {
        const staff = await db.staffProfile.findUnique({ where: { id }, select: { lastName: true, firstName: true, staffNumber: true, schoolMatricule: true } });
        await db.staffProfile.delete({ where: { id } });

        if (staff && staff.schoolMatricule) {
            const staffLabel = formatLogEntity(`${staff.lastName} ${staff.firstName}`, staff.staffNumber);
            const executorName = req.nextUrl.searchParams.get("executorName") || "Administrateur";
            await logActivity(
                staff.schoolMatricule,
                `Personnel supprimÃ© : ${staffLabel}`,
                executorName,
                "warning",
                undefined,
                { staffId: id }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }
}
