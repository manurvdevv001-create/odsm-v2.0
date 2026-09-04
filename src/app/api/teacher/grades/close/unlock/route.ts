import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const forceId = url.searchParams.get("id"); // Can just pass submission ID if known
        
        if (forceId) {
            const existing = await (db as any).gradeSubmission.findUnique({
                where: { id: forceId },
                include: { course: true, classroom: true, period: true }
            });

            if (existing) {
                const isBlockedByPeriodClosure = await (db as any).periodClosure.findFirst({
                    where: {
                        periodId: existing.periodId,
                        classroomId: existing.classroomId
                    }
                });

                if (isBlockedByPeriodClosure && existing.status !== "REVISION_REQUESTED") {
                    return NextResponse.json({
                        error: "Libération impossible : cette période est clôturée et aucune révision administrative n'a été demandée."
                    }, { status: 403 });
                }

                await (db as any).gradeSubmission.delete({
                    where: { id: forceId }
                });

                // LOG ACTIVITY
                try {
                    const { logActivity, formatLogEntity } = await import("@/lib/activity-logger");
                    const school = await db.school.findFirst({ select: { matricule: true } }); // Fallback or use a better way
                    const courseInfo = formatLogEntity(existing.course?.name || "Cours", existing.courseId);
                    const classInfo = formatLogEntity(existing.classroom?.name || "Classe", existing.classroomId);
                    const periodInfo = formatLogEntity(existing.period?.name || "Période", existing.periodId);
                    
                    await logActivity(
                        school?.matricule || "",
                        `Déblocage du cahier de cotes : ${courseInfo} pour la classe ${classInfo} (Période: ${periodInfo})`,
                        "Titulaire/Admin",
                        "warning",
                        undefined,
                        { submissionId: forceId, courseId: existing.courseId, classroomId: existing.classroomId }
                    );
                } catch (e) {}

                console.log("[Grade Closure Unlock] SUCCESS by ID:", forceId);
                return NextResponse.json({ success: true });
            }
        }
        
        // Or if passing params
        const periodId = url.searchParams.get("periodId");
        const courseId = url.searchParams.get("courseId");
        const classroomId = url.searchParams.get("classroomId");
        
        if (!periodId || !courseId || !classroomId) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Delete any submissions matching the criteria
        const existing = await (db as any).gradeSubmission.findFirst({
            where: {
                periodId,
                courseId,
                classroomId
            }
        });

        if (existing) {
            const isBlockedByPeriodClosure = await (db as any).periodClosure.findFirst({
                where: {
                    periodId: existing.periodId,
                    classroomId: existing.classroomId
                }
            });

            if (isBlockedByPeriodClosure && existing.status !== "REVISION_REQUESTED") {
                return NextResponse.json({
                    error: "Libération impossible : cette période est clôturée et aucune révision administrative n'a été demandée."
                }, { status: 403 });
            }

            await (db as any).gradeSubmission.delete({
                where: { id: existing.id }
            });
            console.log("[Grade Closure Unlock] SUCCESS via params:", { periodId, courseId, classroomId });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Aucune soumission trouvée" }, { status: 404 });
    } catch (error: any) {
        console.error("Grade Unlock Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors du déverrouillage" }, { status: 500 });
    }
}
