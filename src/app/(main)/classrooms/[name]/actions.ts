"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";
import { getCourseDBKeyMap } from "@/lib/classroom-utils";

interface CleanupOptions {
    courses: boolean;
    grades: boolean;
    timetables: boolean;
}

/**
 * Resets or cleans up specific data categories for a classroom.
 */
export async function cleanupClassroomData(
    matricule: string,
    classroomName: string,
    options: CleanupOptions,
    executorName: string
) {
    try {
        const school = await db.school.findUnique({
            where: { matricule }
        });

        if (!school) {
            return { success: false, error: "École introuvable." };
        }

        const dbKeyMap = getCourseDBKeyMap(school as any);
        const dbKey = dbKeyMap[classroomName] || classroomName;

        const results: string[] = [];

        await db.$transaction(async (tx: any) => {
            // 1. Cleanup Courses in JSON Configuration
            if (options.courses) {
                const coursesObj = JSON.parse(school.courses || "{}");
                if (coursesObj[dbKey]) {
                    delete coursesObj[dbKey];
                    await tx.school.update({
                        where: { id: school.id },
                        data: { courses: JSON.stringify(coursesObj) }
                    });
                    results.push("Configuration des cours réinitialisée");
                }
                
                // Also cleanup specific Course entities in DB linked by classroomName
                const deletedCourses = await tx.course.deleteMany({
                    where: { classroomName: classroomName }
                });
                if (deletedCourses.count > 0) {
                    results.push(`${deletedCourses.count} entités de cours supprimées du système`);
                }
            }

            // 2. Cleanup Timetables in JSON Configuration
            if (options.timetables) {
                const timetablesObj = JSON.parse(school.timetables || "{}");
                if (timetablesObj[classroomName]) {
                    delete timetablesObj[classroomName];
                    await tx.school.update({
                        where: { id: school.id },
                        data: { timetables: JSON.stringify(timetablesObj) }
                    });
                    results.push("Horaire hebdomadaire réinitialisé");
                }
            }

            // 3. Cleanup Grades (Assessments & Results)
            if (options.grades) {
                const classroom = await tx.classroom.findFirst({
                    where: { 
                        name: classroomName,
                        schoolMatricule: matricule
                    }
                });

                if (classroom) {
                    // Delete all results for assessments belonging to this classroom
                    const assessments = await tx.assessment.findMany({
                        where: { classroomId: classroom.id },
                        select: { id: true }
                    });
                    const assessmentIds = assessments.map((a: any) => a.id);

                    if (assessmentIds.length > 0) {
                        const deletedResults = await tx.studentResult.deleteMany({
                            where: { assessmentId: { in: assessmentIds } }
                        });
                        const deletedAssessments = await tx.assessment.deleteMany({
                            where: { id: { in: assessmentIds } }
                        });
                        results.push(`${deletedAssessments.count} évaluations et leurs notes (${deletedResults.count}) supprimées`);
                    }

                    // Delete submissions and closures
                    const deletedSubmissions = await tx.gradeSubmission.deleteMany({
                        where: { classroomId: classroom.id }
                    });
                    const deletedClosures = await tx.periodClosure.deleteMany({
                        where: { classroomId: classroom.id }
                    });
                    
                    if (deletedSubmissions.count > 0 || deletedClosures.count > 0) {
                        results.push("Clôtures et soumissions de périodes réinitialisées");
                    }
                } else {
                    // Fallback: search by classroomName prefix in assessments if no DB classroom record exists
                    // (Often happens with legacy data or sync issues)
                    results.push("Attention: Aucun enregistrement 'Classroom' trouvé pour suppression directe des notes.");
                }
            }
        });

        if (results.length > 0) {
            await logActivity(
                matricule,
                `Maintenance du local [${classroomName}] : ${results.join(", ")}`,
                executorName || "Administrateur",
                "warning"
            );
        }

        revalidatePath(`/classrooms/${encodeURIComponent(classroomName)}`);
        return { success: true, message: results.join(". ") };
    } catch (error: any) {
        console.error("Cleanup error:", error);
        return { success: false, error: error.message || "Erreur lors du nettoyage" };
    }
}

/**
 * Bulk assign students to a classroom.
 * Takes students from the waiting list (classroomName = null) and assigns them to a specific classroom.
 */
export async function bulkAssignStudents(
    matricule: string,
    classroomName: string,
    studentIds: string[],
    executorName: string
): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!matricule || !classroomName || studentIds.length === 0) {
        return { success: false, error: "Paramètres manquants." };
    }

    try {
        // Assign currently active students (keep status)
        const activeResult = await db.student.updateMany({
            where: {
                id: { in: studentIds },
                schoolMatricule: matricule,
                status: "active",
            },
            data: { classroomName: classroomName },
        });

        // Assign pending_enrollment students (new year) → they become pending_payment
        // so the registration flow can be initiated for the new year fees
        const pendingEnrollmentResult = await db.student.updateMany({
            where: {
                id: { in: studentIds },
                schoolMatricule: matricule,
                status: "pending_enrollment" as any,
            },
            data: {
                classroomName: classroomName,
                status: "pending_payment",
            },
        });

        const totalCount = activeResult.count + pendingEnrollmentResult.count;

        if (totalCount > 0) {
            await logActivity(
                matricule,
                `Affectation collective : ${totalCount} élève(s) affecté(s) au local [${classroomName}] (dont ${pendingEnrollmentResult.count} en transition de nouvelle année).`,
                executorName,
                "success",
                undefined,
                { classroomName, studentIds, count: totalCount }
            );
        }

        revalidatePath(`/classrooms/${encodeURIComponent(classroomName)}`);
        revalidatePath("/students");
        return { success: true, count: totalCount };
    } catch (error: any) {
        console.error("bulkAssignStudents Error:", error);
        return { success: false, error: error.message || "Erreur lors de l'affectation collective." };
    }
}


/**
 * Bulk unassign students from a classroom.
 * Removes classroom assignment, sending them back to the waiting list.
 */
export async function bulkUnassignStudents(
    matricule: string,
    classroomName: string,
    studentIds: string[],
    executorName: string
): Promise<{ success: boolean; count?: number; error?: string }> {
    if (!matricule || studentIds.length === 0) {
        return { success: false, error: "Paramètres manquants." };
    }

    try {
        const result = await db.student.updateMany({
            where: {
                id: { in: studentIds },
                schoolMatricule: matricule,
                classroomName: classroomName,
            },
            data: {
                classroomName: null,
            },
        });

        if (result.count > 0) {
            await logActivity(
                matricule,
                `Désaffectation collective : ${result.count} élève(s) retiré(s) du local [${classroomName}] et renvoyé(s) en liste d'attente.`,
                executorName,
                "warning",
                undefined,
                { classroomName, studentIds, count: result.count }
            );
        }

        revalidatePath(`/classrooms/${encodeURIComponent(classroomName)}`);
        revalidatePath("/students");
        return { success: true, count: result.count };
    } catch (error: any) {
        console.error("bulkUnassignStudents Error:", error);
        return { success: false, error: error.message || "Erreur lors de la désaffectation collective." };
    }
}
