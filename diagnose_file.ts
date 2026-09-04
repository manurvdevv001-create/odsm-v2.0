import { db } from "./src/lib/db";
import * as fs from "fs";

async function diagnose() {
    let output = "=== ALL GRADE SUBMISSIONS ===\n";
    try {
        const allSubs = await (db as any).gradeSubmission.findMany({
            include: {
                course: { select: { name: true } },
                period: { select: { name: true } },
                classroom: { select: { name: true } }
            }
        });
        
        output += `Total records: ${allSubs.length}\n`;
        allSubs.forEach((s: any) => {
            output += `ID: ${s.id}\n`;
            output += `  Course: ${s.course?.name} (ID: ${s.courseId})\n`;
            output += `  Class: ${s.classroom?.name} (ID: ${s.classroomId})\n`;
            output += `  Period: ${s.period?.name} (ID: ${s.periodId})\n`;
            output += `  Status: ${s.status}, Date: ${s.submittedAt}\n`;
            output += "-----------------------------------\n";
        });

        if (allSubs.length === 0) {
            output += "No submissions found at all in the database.\n";
        }

        fs.writeFileSync("db_diag.txt", output);
        console.log("Diagnostic written to db_diag.txt");

    } catch (e: any) {
        fs.writeFileSync("db_diag_error.txt", e.message || String(e));
        console.error(e);
    } finally {
        process.exit();
    }
}

diagnose();
