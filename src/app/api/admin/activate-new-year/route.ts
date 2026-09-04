// src/app/api/admin/activate-new-year/route.ts
/**
 * New School Year Activation API
 *
 * This is the most critical operation. When a new school year is activated:
 * 1. Students with decisions PROMU / MAINTENU / DEMIS → status='pending_enrollment', 
 *    gradeName updated to targetGrade, classroomName=null (pending classroom assignment)
 * 2. Students with EXCLU / RETIRE → status='excluded', removed from active lists
 * 3. Students WITHOUT any decision → treated as excluded (no decision = no re-enrollment)
 *
 * IMPORTANT: Student IDs and matricules are NEVER changed.
 * ALL historical data (payments, grades, conduct) is preserved.
 */
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-logger";

/**
 * GET: Preview what would happen if the year were activated now
 * Returns a summary without making any changes.
 */
export async function GET(req: NextRequest) {
    try {
        const school = await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear;

        // Fetch all active students for this year
        const students = await db.student.findMany({
            where: {
                schoolMatricule: school.matricule,
                schoolYear: activeYear,
                status: { in: ["active", "pending_payment"] }
            }
        });

        const studentIds = students.map((s: any) => s.id);

        // Fetch all annual decisions
        const decisions = studentIds.length > 0
            ? await (db as any).annualDecision.findMany({
                where: { studentId: { in: studentIds }, schoolYear: activeYear, schoolMatricule: school.matricule }
            })
            : [];

        const decisionMap: Record<string, any> = {};
        decisions.forEach((d: any) => { decisionMap[d.studentId] = d; });

        // Fetch grades for resolution
        const grades = await db.grade.findMany({ where: { schoolMatricule: school.matricule } });
        const gradeMap: Record<string, any> = {};
        grades.forEach((g: any) => { gradeMap[g.id] = g; });

        // Build preview
        const preview = {
            totalStudents: students.length,
            willBePromoted: 0,
            willBeMaintained: 0,
            willBeDemoted: 0,
            willBeExcluded: 0,
            withoutDecision: 0,
            details: [] as any[]
        };

        for (const student of students) {
            const dec = decisionMap[student.id];
            let outcome: string;
            let targetGrade: string | null = null;

            if (!dec) {
                preview.withoutDecision++;
                outcome = 'EXCLU (aucune décision)';
            } else if (dec.decision === 'PROMU') {
                preview.willBePromoted++;
                outcome = 'En attente d\'inscription';
                targetGrade = dec.targetGradeId ? gradeMap[dec.targetGradeId]?.name : null;
            } else if (dec.decision === 'MAINTENU') {
                preview.willBeMaintained++;
                outcome = 'En attente d\'inscription (même niveau)';
                targetGrade = dec.targetGradeId ? gradeMap[dec.targetGradeId]?.name : student.gradeName;
            } else if (dec.decision === 'DEMIS') {
                preview.willBeDemoted++;
                outcome = 'En attente d\'inscription (niveau inférieur)';
                targetGrade = dec.targetGradeId ? gradeMap[dec.targetGradeId]?.name : null;
            } else {
                preview.willBeExcluded++;
                outcome = 'Exclu';
            }

            preview.details.push({
                id: student.id,
                matricule: student.matricule,
                name: `${student.lastName} ${student.firstName}`,
                currentClassroom: student.classroomName,
                currentGrade: student.gradeName,
                decision: dec?.decision || null,
                targetGrade,
                outcome
            });
        }

        return NextResponse.json({ preview, schoolYear: activeYear });
    } catch (error: any) {
        console.error("[Activate New Year GET]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST: Execute the new school year activation
 * Body: { newSchoolYear, executorName, confirmationCode: "CONFIRMER_ACTIVATION" }
 *
 * The confirmationCode is a safety mechanism to prevent accidental activation.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { newSchoolYear, executorName, confirmationCode } = body;

        // Safety gate
        if (confirmationCode !== "CONFIRMER_ACTIVATION") {
            return NextResponse.json({
                error: "Code de confirmation invalide. Envoyez confirmationCode: 'CONFIRMER_ACTIVATION' pour procéder."
            }, { status: 400 });
        }

        if (!newSchoolYear || !/^\d{4}-\d{4}$/.test(newSchoolYear)) {
            return NextResponse.json({ error: "newSchoolYear requis (format: YYYY-YYYY)" }, { status: 400 });
        }

        const school = await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const currentYear = calendar?.schoolYear;

        if (newSchoolYear === currentYear) {
            return NextResponse.json({ error: "La nouvelle année ne peut pas être identique à l'année active actuelle." }, { status: 400 });
        }

        // Fetch all active students for the current year
        const students = await db.student.findMany({
            where: {
                schoolMatricule: school.matricule,
                schoolYear: currentYear,
                status: { in: ["active", "pending_payment"] }
            }
        });

        const studentIds = students.map((s: any) => s.id);

        // Fetch all decisions
        const decisions = studentIds.length > 0
            ? await (db as any).annualDecision.findMany({
                where: { studentId: { in: studentIds }, schoolYear: currentYear, schoolMatricule: school.matricule }
            })
            : [];

        const decisionMap: Record<string, any> = {};
        decisions.forEach((d: any) => { decisionMap[d.studentId] = d; });

        // Fetch grades for name resolution
        const grades = await db.grade.findMany({ where: { schoolMatricule: school.matricule } });
        const gradeMap: Record<string, any> = {};
        grades.forEach((g: any) => { gradeMap[g.id] = g; });

        // Process each student
        const stats = { promoted: 0, maintained: 0, demoted: 0, excluded: 0, noDecision: 0 };

        for (const student of students) {
            const dec = decisionMap[student.id];

            if (!dec || ['EXCLU', 'RETIRE'].includes(dec.decision)) {
                // Exclude student — they will not appear in enrollment queues
                if (!dec) stats.noDecision++;
                else stats.excluded++;

                await db.student.update({
                    where: { id: student.id },
                    data: { status: 'excluded' as any }
                });
            } else {
                // Student eligible for re-enrollment
                let newGradeName = student.gradeName;
                if (dec.targetGradeId && gradeMap[dec.targetGradeId]) {
                    newGradeName = gradeMap[dec.targetGradeId].name;
                }

                if (dec.decision === 'PROMU') stats.promoted++;
                else if (dec.decision === 'MAINTENU') stats.maintained++;
                else if (dec.decision === 'DEMIS') stats.demoted++;

                await db.student.update({
                    where: { id: student.id },
                    data: {
                        status: 'pending_enrollment' as any,
                        gradeName: newGradeName,
                        classroomName: null, // Remove from old classroom — awaiting assignment
                        schoolYear: newSchoolYear
                    }
                });
            }
        }

        // Update school calendar to new year
        const updatedCalendar = { ...calendar, schoolYear: newSchoolYear };
        await db.school.update({
            where: { id: school.id },
            data: { calendar: JSON.stringify(updatedCalendar) }
        });

        // Log activity
        await logActivity(
            school.matricule,
            `Activation de la nouvelle année scolaire ${newSchoolYear} (précédente: ${currentYear}). Résultat : ${stats.promoted} promus, ${stats.maintained} maintenus, ${stats.demoted} démis, ${stats.excluded} exclus, ${stats.noDecision} sans décision (exclus par défaut).`,
            executorName || "Administrateur",
            "warning",
            newSchoolYear,
            { stats, previousYear: currentYear, newYear: newSchoolYear }
        );

        return NextResponse.json({
            success: true,
            newSchoolYear,
            previousYear: currentYear,
            stats,
            message: `Année scolaire ${newSchoolYear} activée avec succès. ${stats.promoted + stats.maintained + stats.demoted} élève(s) en attente d'inscription, ${stats.excluded + stats.noDecision} exclu(s).`
        });

    } catch (error: any) {
        console.error("[Activate New Year POST]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
