import { db } from "./src/lib/db";

async function diagnose() {
    try {
        console.log("--- GradeSubmission Diagnostic ---");
        
        // Find the classroom by name first to get its UUID
        const classroom = await db.classroom.findFirst({
            where: { name: { contains: "7e CTEB A" } }
        });
        
        if (!classroom) {
            console.log("Classroom '7e CTEB A' not found in DB.");
            return;
        }
        
        console.log(`Found Classroom: ${classroom.name} (ID: ${classroom.id})`);
        
        // Find submissions for this classroom
        const submissions = await (db as any).gradeSubmission.findMany({
            where: { classroomId: classroom.id },
            include: {
                course: { select: { name: true } },
                period: { select: { name: true } }
            }
        });
        
        console.log(`Submissions found: ${submissions.length}`);
        submissions.forEach((s: any) => {
            console.log(`- Course: ${s.course?.name} (${s.courseId}), Period: ${s.period?.name} (${s.periodId}), Status: ${s.status}`);
        });

        // Also list periods
        const periods = await db.period.findMany();
        console.log("\n--- Periods in DB ---");
        periods.forEach(p => {
            console.log(`- ${p.name} (ID: ${p.id})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

diagnose();
