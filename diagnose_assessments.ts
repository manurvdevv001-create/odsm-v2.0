import { db } from "./src/lib/db";
import * as fs from "fs";

async function diagnose() {
    let output = "=== ASSESSMENT DIAGNOSTIC ===\n";
    const targetClassroomId = "bd6ef3f6-259d-44e2-8950-3298e9dbb378";
    
    try {
        const assessments = await (db.assessment as any).findMany({
            where: { classroomId: targetClassroomId },
            include: {
                course: { select: { name: true } },
                period: { select: { name: true } }
            }
        });
        
        output += `Assessments for classroom ${targetClassroomId}: ${assessments.length}\n`;
        assessments.forEach((a: any) => {
            output += `- Title: '${a.title}', Course: '${a.course?.name}' (${a.courseId}), Period: '${a.period?.name}' (${a.periodId}), Published: ${a.isPublished}\n`;
        });

        if (assessments.length === 0) {
            output += "\nNo assessments found for this specific classroom ID.\n";
            const allAss = await (db.assessment as any).findMany({
                take: 10,
                include: { classroom: { select: { name: true } } }
            });
            output += "\nSample of all assessments in DB:\n";
            allAss.forEach((a: any) => {
                output += `- Title: '${a.title}', Class: '${a.classroom?.name}' (${a.classroomId})\n`;
            });
        }

        fs.writeFileSync("db_diag_assessments.txt", output);
        console.log("Diagnostic written to db_diag_assessments.txt");

    } catch (e: any) {
        fs.writeFileSync("db_diag_assessments_error.txt", e.message || String(e));
        console.error(e);
    } finally {
        process.exit();
    }
}

diagnose();
