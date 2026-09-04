import { db } from "./src/lib/db";

async function diagnose() {
    try {
        console.log("=== ALL GRADE SUBMISSIONS ===");
        const allSubs = await (db as any).gradeSubmission.findMany({
            include: {
                course: { select: { name: true } },
                period: { select: { name: true } },
                classroom: { select: { name: true } }
            }
        });
        
        console.log(`Total records: ${allSubs.length}`);
        allSubs.forEach((s: any) => {
            console.log(`ID: ${s.id}`);
            console.log(`  Course: ${s.course?.name} (ID: ${s.courseId})`);
            console.log(`  Class: ${s.classroom?.name} (ID: ${s.classroomId})`);
            console.log(`  Period: ${s.period?.name} (ID: ${s.periodId})`);
            console.log(`  Status: ${s.status}, Date: ${s.submittedAt}`);
            console.log("-----------------------------------");
        });

        if (allSubs.length === 0) {
            console.log("No submissions found at all in the database.");
        }

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

diagnose();
