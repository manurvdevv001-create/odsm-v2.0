import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { saveStudentData, saveSchoolFeePayment, updateStudentData } from "@/app/(main)/students/actions";
import { logActivity } from "@/lib/activity-logger";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { matricule, actions, executorName } = body;

        if (!matricule || !actions || !Array.isArray(actions)) {
            return NextResponse.json({ error: "Données invalides." }, { status: 400 });
        }

        const results = [];

        for (const action of actions) {
            const { type, data, actionExecutor } = action;
            const effectiveExecutor = actionExecutor || executorName || "App Mobile / Sync";
            
            try {
                if (type === 'registration') {
                    const res = await saveStudentData(matricule, data.student, data.payment, effectiveExecutor);
                    results.push({ actionId: action.id, success: res.success, error: res.error });
                } else if (type === 'payment') {
                    const res = await saveSchoolFeePayment(matricule, data, effectiveExecutor);
                    results.push({ actionId: action.id, success: res.success, error: res.error });
                } else if (type === 'student_update') {
                    const res = await updateStudentData(matricule, data.studentId, data.updates, effectiveExecutor);
                    results.push({ actionId: action.id, success: res.success, error: res.error });
                } else if (type === 'add_grade') {
                    // Logic to add a grade
                    const res = await db.studentResult.upsert({
                        where: {
                            studentId_assessmentId: {
                                studentId: data.studentId,
                                assessmentId: data.assessmentId
                            }
                        },
                        update: { score: data.score },
                        create: {
                            score: data.score,
                            school: { connect: { matricule } },
                            student: { connect: { id: data.studentId } },
                            assessment: { connect: { id: data.assessmentId } }
                        }
                    });
                    results.push({ actionId: action.id, success: true, error: null });
                } else if (type === 'mark_attendance') {
                    // Logic to add an attendance record
                    const res = await db.disciplineRecord.create({
                        data: {
                            type: 'ABSENCE',
                            severity: 'MEDIUM',
                            description: `Absence encodée hors-ligne par ${effectiveExecutor}`,
                            studentId: data.studentId,
                            schoolMatricule: matricule
                        }
                    });
                    results.push({ actionId: action.id, success: true, error: null });
                } else {
                    results.push({ actionId: action.id, success: false, error: "Type d'action inconnu." });
                }
            } catch (e: any) {
                results.push({ actionId: action.id, success: false, error: e.message });
            }
        }

        // Log the synchronization event
        await logActivity(
            matricule, 
            `Synchronisation réussie (${results.filter(r => r.success).length}/${actions.length} actions traitées)`, 
            executorName || "Système Sync", 
            "info"
        );

        return NextResponse.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("API /api/sync/push error:", error);
        return NextResponse.json({ error: "Erreur de traitement." }, { status: 500 });
    }
}
