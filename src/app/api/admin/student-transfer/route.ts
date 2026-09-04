// src/app/api/admin/student-transfer/route.ts
/**
 * Student Transfer / Reclassification API
 *
 * Handles mid-year promotion, demotion, or classroom correction without
 * losing any student data (grades, payments, conduct records, etc.).
 *
 * The student's ID and matricule are NEVER changed. Only gradeName,
 * classroomName, and level are updated. A transfer log is appended
 * to student.data.transferHistory for full auditability.
 */
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-logger";

const norm = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() ?? "";

/**
 * POST: Transfer a student to a different classroom / grade
 * Body: {
 *   studentId,
 *   targetClassroomName,  // The destination local (e.g. "2ème B")
 *   targetGradeName,      // The destination grade/classe nominale (e.g. "2ème")
 *   targetLevel?,         // 'primaire' | 'secondaire' | 'maternelle' — optional if resolvable
 *   reason,               // 'PROMOTION' | 'DEMOTION' | 'CORRECTION' | 'SECTION_CHANGE'
 *   executorName?
 * }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            studentId,
            targetClassroomName,
            targetGradeName,
            targetLevel,
            reason,
            executorName
        } = body;

        if (!studentId || !targetClassroomName || !targetGradeName || !reason) {
            return NextResponse.json({
                error: "studentId, targetClassroomName, targetGradeName et reason sont requis"
            }, { status: 400 });
        }

        const VALID_REASONS = ['PROMOTION', 'DEMOTION', 'CORRECTION', 'SECTION_CHANGE'];
        if (!VALID_REASONS.includes(reason)) {
            return NextResponse.json({
                error: `reason invalide. Valeurs: ${VALID_REASONS.join(', ')}`
            }, { status: 400 });
        }

        const school = await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear;

        // Verify student exists and belongs to this school
        const student = await db.student.findUnique({ where: { id: studentId } });
        if (!student || student.schoolMatricule !== school.matricule) {
            return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
        }

        // Resolve target classroom
        const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
        const targetClassroom = allClassrooms.find((c: any) => norm(c.name) === norm(targetClassroomName));
        if (!targetClassroom) {
            return NextResponse.json({ error: `Local "${targetClassroomName}" introuvable dans le système` }, { status: 404 });
        }

        // Build transfer history log (non-destructive — appends to student.data)
        const studentData = JSON.parse((student as any).data || "{}");
        const transferHistory: any[] = studentData.transferHistory || [];
        transferHistory.push({
            date: new Date().toISOString(),
            schoolYear: activeYear,
            reason,
            from: {
                classroomName: student.classroomName,
                gradeName: student.gradeName,
                level: student.level
            },
            to: {
                classroomName: targetClassroomName,
                gradeName: targetGradeName,
                level: targetLevel || targetClassroom.level
            },
            executedBy: executorName || "Système"
        });

        // Update the student (preserve ID, matricule, and all linked records)
        await db.student.update({
            where: { id: studentId },
            data: {
                classroomName: targetClassroomName,
                gradeName: targetGradeName,
                level: targetLevel || targetClassroom.level || student.level,
                data: JSON.stringify({ ...studentData, transferHistory })
            }
        });

        // Log activity
        const reasonLabels: Record<string, string> = {
            PROMOTION: "Promotion",
            DEMOTION: "Démotion",
            CORRECTION: "Correction d'inscription",
            SECTION_CHANGE: "Changement de section"
        };
        await logActivity(
            school.matricule,
            `[${reasonLabels[reason] || reason}] ${student.lastName} ${student.firstName} (${student.matricule}) : ${student.classroomName || 'N/A'} → ${targetClassroomName} (${activeYear})`,
            executorName || "Système",
            reason === 'CORRECTION' ? 'info' : 'warning',
            activeYear,
            {
                studentId,
                reason,
                from: { classroomName: student.classroomName, gradeName: student.gradeName },
                to: { classroomName: targetClassroomName, gradeName: targetGradeName }
            }
        );

        return NextResponse.json({
            success: true,
            message: `Élève transféré vers ${targetClassroomName} avec succès.`,
            transferHistory
        });

    } catch (error: any) {
        console.error("[Student Transfer POST]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
