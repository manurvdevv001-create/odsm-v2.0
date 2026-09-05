// src/app/superadmin/actions.ts
'use server';

import { cookies } from 'next/headers';
import { db as prisma } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
const SUPERADMIN_USER = 'spadmin';
const SUPERADMIN_PASS = 'odsm##@superadmin2025';
const SESSION_COOKIE_NAME = 'odsm_superadmin_session';

export async function loginSuperadmin(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (username === SUPERADMIN_USER && password === SUPERADMIN_PASS) {
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/superadmin',
        });
        return { success: true };
    }

    return { success: false, error: 'Identifiants incorrects' };
}

export async function logoutSuperadmin() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function isAuthenticated() {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value === 'authenticated';
}

export async function getSchoolStats(matricule: string) {
    if (!matricule) return { success: false, error: 'Matricule requis' };

    try {
        const school = await prisma.school.findUnique({
            where: { matricule },
            include: {
                students: { select: { id: true } },
                teachers: { select: { id: true } },
                payments: { select: { amount: true, currency: true } }
            }
        });

        if (!school) {
            return { success: false, error: 'École non trouvée' };
        }

        const stats = {
            schoolName: school.name,
            studentCount: school.students.length,
            teacherCount: school.teachers.length,
            paymentCount: school.payments.length,
            totalPaymentsUSD: school.payments.reduce((acc: any, p: any) => p.currency === 'USD' ? acc + p.amount : acc, 0),
            totalPaymentsCDF: school.payments.reduce((acc: any, p: any) => p.currency === 'CDF' ? acc + p.amount : acc, 0),
        };

        return { success: true, stats };
    } catch (error: any) {
        console.error('getSchoolStats Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function resetPassword(matricule: string, newPassword: string) {
    if (!matricule || !newPassword) return { success: false, error: 'Données manquantes' };

    try {
        const school = await prisma.school.findUnique({
            where: { matricule }
        });

        if (!school) {
            return { success: false, error: 'École non trouvée' };
        }

        const hashedPassword = await hashPassword(newPassword);
        await prisma.school.update({
            where: { matricule },
            data: { password: hashedPassword }
        });

        return { success: true };
    } catch (error: any) {
        console.error('resetPassword Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function runBackup() {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const { createBackup } = await import('@/lib/backup');
        const result = await createBackup('global');
        if (result.success) {
            await logSuperadminAction('GLOBAL_BACKUP', undefined, { filename: result.filename });
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function runSchoolBackup(matricule: string, schoolName: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const { createBackup } = await import('@/lib/backup');
        const result = await createBackup('school', matricule, schoolName);
        if (result.success) {
            await logSuperadminAction('SCHOOL_BACKUP', matricule, { filename: result.filename });
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function listSuperadminBackups(matricule?: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const { listBackupFiles } = await import('@/lib/backup');
        // superadmin sees everything when no matricule filter
        const files = listBackupFiles(matricule || undefined);
        return { success: true, files };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function restoreSuperadminBackup(filename: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const { restoreBackup } = await import('@/lib/backup');
        const result = await restoreBackup(filename, 'superadmin');
        if (result.success) {
            await logSuperadminAction('RESTORE_BACKUP', undefined, { filename });
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getGuides() {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    const fs = require('fs');
    const path = require('path');
    const installPath = path.join(process.cwd(), 'docs', 'INSTALL_GUIDE.md');
    const backupPath = path.join(process.cwd(), 'docs', 'BACKUP_GUIDE.md');

    try {
        const guides = {
            install: fs.existsSync(installPath) ? fs.readFileSync(installPath, 'utf8') : 'Guide d\'installation introuvable',
            backup: fs.existsSync(backupPath) ? fs.readFileSync(backupPath, 'utf8') : 'Guide de sauvegarde introuvable'
        };
        return { success: true, guides };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// --- New Super Controller Actions ---

export async function logSuperadminAction(action: string, targetMatricule?: string, details: any = {}) {
    try {
        await prisma.superadminAuditLog.create({
            data: {
                action,
                targetMatricule,
                details: JSON.stringify(details),
            }
        });
    } catch (error) {
        console.error('Failed to log superadmin action:', error);
    }
}

async function generateUniqueMatricule() {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789'; // Exclu 'O' pour éviter confusion avec 0
    let matricule = '';
    let isUnique = false;

    while (!isUnique) {
        matricule = '';
        for (let i = 0; i < 6; i++) {
            matricule += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Vérification de l'unicité globale
        const existing = await prisma.school.findUnique({
            where: { matricule }
        });

        if (!existing) {
            isUnique = true;
        }
    }

    return matricule;
}

export async function createSchool(data: { name: string; password?: string; initialYear: string }) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const matricule = await generateUniqueMatricule();
        const rawPassword = data.password || await generateUniqueMatricule(); 
        const hashedPassword = await hashPassword(rawPassword);

        // Calculate a 14-day demo license
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 14);

        const school = await prisma.school.create({
            data: {
                matricule,
                name: data.name,
                password: hashedPassword,
                configuration: JSON.stringify({ initialYear: data.initialYear }),
                licenses: {
                    create: {
                        type: 'DEMO',
                        status: 'ACTIVE',
                        startDate,
                        endDate,
                    }
                }
            }
        });

        await logSuperadminAction('CREATE_SCHOOL', matricule, { name: data.name, initialYear: data.initialYear });

        return { 
            success: true, 
            school: { matricule: school.matricule, name: school.name },
            rawPassword 
        };
    } catch (error: any) {
        console.error('Create School Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function updateSchoolInfo(matricule: string, data: { name?: string; secopeMatricule?: string; address?: string }) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const school = await prisma.school.update({
            where: { matricule },
            data: {
                name: data.name,
                secopeMatricule: data.secopeMatricule,
                address: data.address,
            }
        });

        await logSuperadminAction('UPDATE_SCHOOL', matricule, data);
        return { success: true, school };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function manageLicense(matricule: string, data: { type: string; customName?: string; endDate: string; status: string; startDate?: string; restrictions?: string }) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        // Expire all currently active licenses for this school to ensure only 1 is active
        if (data.status === 'ACTIVE') {
            await prisma.license.updateMany({
                where: { schoolMatricule: matricule, status: 'ACTIVE' },
                data: { status: 'EXPIRED' }
            });
        }
        
        const license = await prisma.license.create({
            data: {
                schoolMatricule: matricule,
                type: data.type,
                customName: data.customName || null,
                status: data.status,
                startDate: data.startDate ? new Date(data.startDate) : new Date(),
                endDate: new Date(data.endDate),
                restrictions: data.restrictions || "{}"
            }
        });

        await logSuperadminAction('UPDATE_LICENSE', matricule, data);
        return { success: true, license };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function replicateSchool(sourceMatricule: string, data: { name: string; initialYear: string }) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const sourceSchool = await prisma.school.findUnique({
            where: { matricule: sourceMatricule },
            include: {
                licenses: { orderBy: { endDate: 'desc' }, take: 1 }
            }
        });

        if (!sourceSchool) return { success: false, error: 'École source non trouvée' };

        const newMatricule = await generateUniqueMatricule();
        const rawPassword = await generateUniqueMatricule();
        const hashedPassword = await hashPassword(rawPassword);

        // We use a transaction for the deep copy
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the School
            const newSchool = await tx.school.create({
                data: {
                    matricule: newMatricule,
                    name: data.name,
                    password: hashedPassword,
                    secopeMatricule: sourceSchool.secopeMatricule,
                    address: sourceSchool.address,
                    city: sourceSchool.city,
                    province: sourceSchool.province,
                    phone: sourceSchool.phone,
                    logo: sourceSchool.logo,
                    levels: sourceSchool.levels,
                    configuration: sourceSchool.configuration,
                    calendar: sourceSchool.calendar,
                    financeSettings: sourceSchool.financeSettings,
                    structure: sourceSchool.structure,
                    courses: sourceSchool.courses,
                    timeSlots: sourceSchool.timeSlots,
                    timetables: sourceSchool.timetables,
                    activityLog: sourceSchool.activityLog,
                    users: sourceSchool.users,
                    licenses: {
                        create: {
                            type: 'DEMO',
                            status: 'ACTIVE',
                            startDate: new Date(),
                            endDate: new Date(new Date().setDate(new Date().getDate() + 14)),
                        }
                    }
                }
            });

            // 2. Copy Grades
            const grades = await tx.grade.findMany({ where: { schoolMatricule: sourceMatricule } });
            const gradeMap = new Map();
            for (const g of grades) {
                const { id, createdAt, updatedAt, schoolMatricule, ...rest } = g as any;
                const newG = await tx.grade.create({ data: { ...rest, schoolMatricule: newMatricule } });
                gradeMap.set(id, newG.id);
            }

            // 3. Copy Subjects
            const subjects = await tx.subject.findMany({ where: { grade: { schoolMatricule: sourceMatricule } } });
            const subjectMap = new Map();
            for (const s of subjects) {
                const { id, createdAt, updatedAt, gradeId, ...rest } = s as any;
                const newS = await tx.subject.create({ data: { ...rest, gradeId: gradeMap.get(gradeId) } });
                subjectMap.set(id, newS.id);
            }

            // 4. Copy StaffProfiles & Users
            const staff = await tx.staffProfile.findMany({ where: { schoolMatricule: sourceMatricule }, include: { user: true } });
            const staffMap = new Map();
            for (const st of staff) {
                const { id, createdAt, updatedAt, schoolMatricule, userId, user, staffNumber, ...rest } = st as any;
                
                let newUserId = null;
                if (user) {
                    const { id: uId, createdAt: uCa, updatedAt: uUa, ...uRest } = user;
                    const newUser = await tx.user.create({ data: { ...uRest, username: `${newMatricule}_${user.username}` } });
                    newUserId = newUser.id;
                }

                const newSt = await tx.staffProfile.create({ 
                    data: { 
                        ...rest, 
                        schoolMatricule: newMatricule, 
                        userId: newUserId,
                        staffNumber: staffNumber ? `${newMatricule}_${staffNumber}` : null
                    } 
                });
                staffMap.set(id, newSt.id);
            }

            // 5. Copy Classrooms
            const classrooms = await tx.classroom.findMany({ where: { schoolMatricule: sourceMatricule } });
            const classroomMap = new Map();
            for (const c of classrooms) {
                const { id, createdAt, updatedAt, schoolMatricule, titulaireId, gradeId, ...rest } = c as any;
                const newC = await tx.classroom.create({ 
                    data: { 
                        ...rest, 
                        schoolMatricule: newMatricule, 
                        gradeId: gradeId ? (gradeMap.get(gradeId) || gradeId) : null,
                        titulaireId: titulaireId ? (staffMap.get(titulaireId) || titulaireId) : null
                    } 
                });
                classroomMap.set(id, newC.id);
            }

            // 6. Copy Courses
            const courses = await tx.course.findMany({ 
                where: { 
                    OR: [
                        { subject: { grade: { schoolMatricule: sourceMatricule } } },
                        { teacherId: { in: Array.from(staffMap.keys()) } },
                        { assessments: { some: { classroom: { schoolMatricule: sourceMatricule } } } }
                    ]
                } 
            });
            const courseMap = new Map();
            for (const co of courses) {
                const { id, subjectId, teacherId, schoolMatricule, ...rest } = co as any;
                const newCo = await tx.course.create({
                    data: {
                        ...rest,
                        schoolMatricule: newMatricule,
                        subjectId: subjectId ? (subjectMap.get(subjectId) || subjectId) : null,
                        teacherId: teacherId ? (staffMap.get(teacherId) || teacherId) : null
                    }
                });
                courseMap.set(id, newCo.id);
            }

            // 7. Copy Guardians & Students
            const guardians = await tx.guardian.findMany({ where: { schoolMatricule: sourceMatricule } });
            const guardianMap = new Map();
            for (const gu of guardians) {
                const { id, createdAt, updatedAt, schoolMatricule, ...rest } = gu as any;
                const newGu = await tx.guardian.create({ data: { ...rest, schoolMatricule: newMatricule } });
                guardianMap.set(id, newGu.id);
            }

            const students = await tx.student.findMany({ where: { schoolMatricule: sourceMatricule } });
            const studentMap = new Map();
            for (const stu of students) {
                const { id, createdAt, updatedAt, schoolMatricule, guardianId, matricule: stuMatricule, ...rest } = stu as any;
                const newStu = await tx.student.create({ 
                    data: { 
                        ...rest, 
                        schoolMatricule: newMatricule, 
                        guardianId: guardianId ? (guardianMap.get(guardianId) || guardianId) : null,
                        matricule: `${newMatricule}_${stuMatricule}`
                    } 
                });
                studentMap.set(id, newStu.id);
            }

            // 8. Copy Enrollments
            const enrollments = await tx.enrollment.findMany({ where: { student: { schoolMatricule: sourceMatricule } } });
            for (const en of enrollments) {
                const { id, createdAt, studentId, ...rest } = en as any;
                await tx.enrollment.create({ data: { ...rest, studentId: studentMap.get(studentId) } });
            }

            // 9. Copy Periods
            const periods = await tx.period.findMany({ where: { schoolMatricule: sourceMatricule } });
            const periodMap = new Map();
            for (const p of periods) {
                const { id, schoolMatricule, ...rest } = p as any;
                const newP = await tx.period.create({ data: { ...rest, schoolMatricule: newMatricule } });
                periodMap.set(id, newP.id);
            }

            // 10. Copy Assessments & Results
            const assessments = await tx.assessment.findMany({ where: { classroom: { schoolMatricule: sourceMatricule } } });
            const assessmentMap = new Map();
            for (const as of assessments) {
                const { id, createdAt, updatedAt, courseId, classroomId, periodId, schoolMatricule, ...rest } = as as any;
                const newAs = await tx.assessment.create({
                    data: {
                        ...rest,
                        schoolMatricule: newMatricule,
                        courseId: courseMap.get(courseId) || courseId,
                        classroomId: classroomMap.get(classroomId) || classroomId,
                        periodId: periodMap.get(periodId) || periodId
                    }
                });
                assessmentMap.set(id, newAs.id);
            }

            const results = await tx.studentResult.findMany({ where: { student: { schoolMatricule: sourceMatricule } } });
            for (const r of results) {
                const { id, studentId, assessmentId, schoolMatricule, ...rest } = r as any;
                await tx.studentResult.create({
                    data: {
                        ...rest,
                        schoolMatricule: newMatricule,
                        studentId: studentMap.get(studentId) || studentId,
                        assessmentId: assessmentMap.get(assessmentId) || assessmentId
                    }
                });
            }

            // 11. Copy Payments & Details
            const payments = await tx.payment.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const pay of payments) {
                const { id, createdAt, updatedAt, schoolMatricule, studentId, transactionNo, ...rest } = pay as any;
                const details = await tx.paymentDetail.findMany({ where: { paymentId: id } });
                
                const newPay = await tx.payment.create({
                    data: {
                        ...rest,
                        schoolMatricule: newMatricule,
                        studentId: studentMap.get(studentId),
                        transactionNo: `${newMatricule}_${transactionNo}`,
                        details: {
                            create: details.map(d => {
                                const { id: dId, paymentId: pId, ...dRest } = d as any;
                                return dRest;
                            })
                        }
                    }
                });
            }

            // 12. Copy Other Data (Discipline, Conduct, Evaluations, Visits, LessonPlans, Sessions)
            const discipline = await tx.disciplineRecord.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const d of discipline) {
                const { id, createdAt, updatedAt, schoolMatricule, studentId, ...rest } = d as any;
                await tx.disciplineRecord.create({ data: { ...rest, schoolMatricule: newMatricule, studentId: studentMap.get(studentId) } });
            }

            const conducts = await tx.studentConduct.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const co of conducts) {
                const { id, createdAt, updatedAt, schoolMatricule, studentId, periodId, ...rest } = co as any;
                await tx.studentConduct.create({ data: { ...rest, schoolMatricule: newMatricule, studentId: studentMap.get(studentId), periodId: periodMap.get(periodId) } });
            }

            const evaluations = await tx.teacherEvaluation.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const ev of evaluations) {
                const { id, createdAt, updatedAt, schoolMatricule, teacherId, evaluatorId, ...rest } = ev as any;
                await tx.teacherEvaluation.create({ data: { ...rest, schoolMatricule: newMatricule, teacherId: staffMap.get(teacherId), evaluatorId: staffMap.get(evaluatorId) } });
            }

            const visits = await tx.classVisit.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const v of visits) {
                const { id, createdAt, updatedAt, schoolMatricule, teacherId, visitorId, classroomId, courseId, ...rest } = v as any;
                await tx.classVisit.create({ 
                    data: { 
                        ...rest, 
                        schoolMatricule: newMatricule, 
                        teacherId: staffMap.get(teacherId), 
                        visitorId: staffMap.get(visitorId), 
                        classroomId: classroomMap.get(classroomId),
                        courseId: courseId ? courseMap.get(courseId) : null
                    } 
                });
            }

            const lessonPlans = await tx.lessonPlan.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const lp of lessonPlans) {
                const { id, createdAt, updatedAt, schoolMatricule, teacherId, courseId, ...rest } = lp as any;
                await tx.lessonPlan.create({ data: { ...rest, schoolMatricule: newMatricule, teacherId: staffMap.get(teacherId), courseId: courseMap.get(courseId) } });
            }

            const sessions = await tx.classSession.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const cs of sessions) {
                const { id, createdAt, updatedAt, schoolMatricule, teacherId, courseId, classroomId, ...rest } = cs as any;
                await tx.classSession.create({ data: { ...rest, schoolMatricule: newMatricule, teacherId: staffMap.get(teacherId), courseId: courseMap.get(courseId), classroomId: classroomMap.get(classroomId) } });
            }

            const submissions = await tx.gradeSubmission.findMany({ where: { classroom: { schoolMatricule: sourceMatricule } } });
            for (const gs of submissions) {
                const { id, createdAt, updatedAt, periodId, courseId, classroomId, schoolMatricule, ...rest } = gs as any;
                await tx.gradeSubmission.create({ data: { ...rest, schoolMatricule: newMatricule, periodId: periodMap.get(periodId), courseId: courseMap.get(courseId), classroomId: classroomMap.get(classroomId) } });
            }

            const closures = await tx.periodClosure.findMany({ where: { classroom: { schoolMatricule: sourceMatricule } } });
            for (const pc of closures) {
                const { id, createdAt, updatedAt, periodId, classroomId, ...rest } = pc as any;
                await tx.periodClosure.create({ data: { ...rest, periodId: periodMap.get(periodId), classroomId: classroomMap.get(classroomId) } });
            }

            const logs = await tx.activityLog.findMany({ where: { schoolMatricule: sourceMatricule } });
            for (const l of logs) {
                const { id, createdAt, updatedAt, schoolMatricule, ...rest } = l as any;
                await tx.activityLog.create({ data: { ...rest, schoolMatricule: newMatricule } });
            }

            return newSchool;
        });

        await logSuperadminAction('REPLICATE_SCHOOL', newMatricule, { source: sourceMatricule });

        return { success: true, school: result, rawPassword };
    } catch (error: any) {
        console.error('Deep Replication Error:', error);
        return { success: false, error: `Erreur de réplication: ${error.message}` };
    }
}

export async function createImpersonationToken(matricule: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const school = await prisma.school.findUnique({ where: { matricule } });
        if (!school) return { success: false, error: 'École non trouvée' };

        const cookieStore = await cookies();
        // This is a simplified impersonation: we set the standard auth cookie as if the school logged in.
        // In a real app, you might want a distinct 'impersonation_session' to avoid accidentally doing things.
        // Assuming 'odsm_session' is the main app cookie name (we'll need to check the actual auth logic).
        
        const MAIN_SESSION_COOKIE = 'session'; // Based on Next.js standard or typical custom implementation
        
        // Let's set a specific 'impersonated_matricule' cookie that the main layout can read.
        cookieStore.set('impersonated_matricule', matricule, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60, // 1 hour impersonation
            path: '/',
        });

        await logSuperadminAction('IMPERSONATE', matricule);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function getSystemMetrics() {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const os = require('os');

        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercentage = ((usedMem / totalMem) * 100).toFixed(1);

        // os.cpus() peut retourner un tableau vide dans certains environnements cloud
        const cpus = os.cpus() || [];
        const cpuModel = cpus.length > 0 ? cpus[0]?.model : 'Cloud (N/A)';
        const cpuCount = cpus.length || 1;
        const loadAvg = os.loadavg();

        // Taille de la DB : seulement disponible en local (pas sur Netlify)
        let dbSize = 0;
        const isCloud = !!process.env.TURSO_DATABASE_URL;
        
        if (!isCloud) {
            try {
                const fs = require('fs');
                const path = require('path');
                const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
                const dbRelativePath = dbUrl.replace('file:', '');
                const dbPath = path.isAbsolute(dbRelativePath)
                    ? dbRelativePath
                    : path.join(process.cwd(), dbRelativePath);
                if (fs.existsSync(dbPath)) {
                    dbSize = fs.statSync(dbPath).size;
                }
            } catch (_) { /* ignore en mode cloud */ }
        }

        let dbStatus = 'Disconnected';
        let schoolCount = 0;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = isCloud ? 'Connected (Turso Cloud)' : 'Connected (Local)';
            schoolCount = await prisma.school.count();
        } catch (e: any) {
            dbStatus = 'Error: ' + e.message;
        }

        return {
            success: true,
            metrics: {
                memory: {
                    total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                    used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                    percentage: memPercentage
                },
                cpu: {
                    model: cpuModel,
                    count: cpuCount,
                    load: loadAvg[0]?.toFixed(2) ?? '0.00'
                },
                storage: {
                    dbSize: isCloud ? 'Turso Cloud' : (dbSize / (1024 * 1024)).toFixed(2) + ' MB',
                    dbPath: isCloud ? 'Turso Cloud Database' : 'Local dev.db',
                    dbStatus: dbStatus,
                    schoolCount: schoolCount
                },
                uptime: Math.floor(os.uptime() / 3600) + ' hours',
                platform: os.platform() + ' ' + os.release(),
                timestamp: new Date().toISOString()
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAllSchools() {
    if (!await isAuthenticated()) {
        console.log('[Superadmin] getAllSchools: Not Authenticated');
        return { success: false, error: 'Non autorisé' };
    }

    try {
        const schools = await prisma.school.findMany({
            include: {
                licenses: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                },
                _count: {
                    select: { students: true, teachers: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`[Superadmin] getAllSchools: Found ${schools.length} schools`);
        return { success: true, schools };
    } catch (error: any) {
        console.error('[Superadmin] getAllSchools Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function getAuditLogs() {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const logs = await prisma.superadminAuditLog.findMany({
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        return { success: true, logs };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function deleteSchool(matricule: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        // Find users to delete first (via StaffProfile)
        const staff = await prisma.staffProfile.findMany({
            where: { schoolMatricule: matricule },
            select: { userId: true }
        });
        const userIds = staff.map(s => s.userId).filter(Boolean) as string[];

        await prisma.$transaction([
            // 1. Résultats des élèves (référencent Assessment, Student)
            prisma.studentResult.deleteMany({ where: { schoolMatricule: matricule } }),
            // 2. Évaluations (référencent Classroom, Course, Period)
            prisma.assessment.deleteMany({ where: { schoolMatricule: matricule } }),
            // 3. Détails de paiement (référencent Payment)
            prisma.paymentDetail.deleteMany({ where: { payment: { schoolMatricule: matricule } } }),
            // 4. Paiements (référencent Student)
            prisma.payment.deleteMany({ where: { schoolMatricule: matricule } }),
            // 5. Inscriptions (référencent Student)
            prisma.enrollment.deleteMany({ where: { schoolMatricule: matricule } }),
            // 6. Décisions annuelles (référencent Student, Classroom, School) — avant Student et Classroom
            prisma.annualDecision.deleteMany({ where: { schoolMatricule: matricule } }),
            // 7. Conduite des élèves (référencent Student, Period)
            prisma.studentConduct.deleteMany({ where: { schoolMatricule: matricule } }),
            // 8. Dossiers disciplinaires (référencent Student)
            prisma.disciplineRecord.deleteMany({ where: { schoolMatricule: matricule } }),
            // 9. Élèves
            prisma.student.deleteMany({ where: { schoolMatricule: matricule } }),
            // 10. Tuteurs
            prisma.guardian.deleteMany({ where: { schoolMatricule: matricule } }),
            // 11. Soumissions de notes (référencent Classroom, Course, Period)
            prisma.gradeSubmission.deleteMany({ where: { schoolMatricule: matricule } }),
            // 12. Clôtures de période (référencent Classroom, Period)
            prisma.periodClosure.deleteMany({ where: { schoolMatricule: matricule } }),
            // 13. Périodes
            prisma.period.deleteMany({ where: { schoolMatricule: matricule } }),
            // 14. Plans de leçon (référencent Course, StaffProfile)
            prisma.lessonPlan.deleteMany({ where: { schoolMatricule: matricule } }),
            // 15. Sessions de cours (référencent Course, Classroom, StaffProfile)
            prisma.classSession.deleteMany({ where: { schoolMatricule: matricule } }),
            // 16. Visites de classe (référencent Course, Classroom, StaffProfile)
            prisma.classVisit.deleteMany({ where: { schoolMatricule: matricule } }),
            // 17. Évaluations des enseignants (référencent StaffProfile)
            prisma.teacherEvaluation.deleteMany({ where: { schoolMatricule: matricule } }),
            // 18. Profils du personnel
            prisma.staffProfile.deleteMany({ where: { schoolMatricule: matricule } }),
            // 19. Utilisateurs liés au personnel
            prisma.user.deleteMany({ where: { id: { in: userIds } } }),
            // 20. Cours (référencent School via schoolMatricule — manquait avant !)
            prisma.course.deleteMany({ where: { schoolMatricule: matricule } }),
            // 21. Salles de classe
            prisma.classroom.deleteMany({ where: { schoolMatricule: matricule } }),
            // 22. Matières (référencent Grade)
            prisma.subject.deleteMany({ where: { grade: { schoolMatricule: matricule } } }),
            // 23. Niveaux / Classes
            prisma.grade.deleteMany({ where: { schoolMatricule: matricule } }),
            // 24. Journal d'activité
            prisma.activityLog.deleteMany({ where: { schoolMatricule: matricule } }),
            // 25. Clôtures annuelles (référencent School — manquait avant !)
            prisma.annualClosure.deleteMany({ where: { schoolMatricule: matricule } }),
            // 26. Paramètres d'année scolaire (référencent School — manquait avant !)
            prisma.schoolYearSettings.deleteMany({ where: { schoolMatricule: matricule } }),
            // 27. Licences
            prisma.license.deleteMany({ where: { schoolMatricule: matricule } }),
            // 28. École elle-même
            prisma.school.delete({ where: { matricule } })
        ]);

        await logSuperadminAction('DELETE_SCHOOL', matricule);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function resetSchoolData(matricule: string) {
    if (!await isAuthenticated()) return { success: false, error: 'Non autorisé' };

    try {
        const staff = await prisma.staffProfile.findMany({
            where: { schoolMatricule: matricule },
            select: { userId: true }
        });
        const userIds = staff.map(s => s.userId).filter(Boolean) as string[];

        await prisma.$transaction([
            prisma.studentResult.deleteMany({ where: { student: { schoolMatricule: matricule } } }),
            prisma.assessment.deleteMany({ where: { classroom: { schoolMatricule: matricule } } }),
            prisma.paymentDetail.deleteMany({ where: { payment: { student: { schoolMatricule: matricule } } } }),
            prisma.payment.deleteMany({ where: { student: { schoolMatricule: matricule } } }),
            prisma.enrollment.deleteMany({ where: { student: { schoolMatricule: matricule } } }),
            prisma.studentConduct.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.disciplineRecord.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.student.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.guardian.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.gradeSubmission.deleteMany({ where: { classroom: { schoolMatricule: matricule } } }),
            prisma.periodClosure.deleteMany({ where: { classroom: { schoolMatricule: matricule } } }),
            prisma.period.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.lessonPlan.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.classSession.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.classVisit.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.teacherEvaluation.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.staffProfile.deleteMany({ where: { schoolMatricule: matricule } }),
            prisma.user.deleteMany({ where: { id: { in: userIds } } }),
            prisma.activityLog.deleteMany({ where: { schoolMatricule: matricule } }),
            // We keep the school record, classrooms, subjects, grades (the "structure")
        ]);

        await logSuperadminAction('RESET_SCHOOL_DATA', matricule);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: `Erreur: ${error.message}` };
    }
}
