import { db } from "./src/lib/db";

async function main() {
    const school = await db.school.findFirst();
    if (!school) {
        console.log("No school found");
        return;
    }

    const timetables = JSON.parse(school.timetables || "{}");
    const ghostCourseNames = ["Vocabulaire", "Opérations", "Expression Ecrite", "Expresson Ecrite", "Mesures des grandeurs"];
    const keys = Object.keys(timetables);
    let deletedCount = 0;

    const newTimetables = { ...timetables };

    keys.forEach(key => {
        const slots = Object.values(timetables[key] || {});
        const hasGhostCourse = slots.some((s: any) => ghostCourseNames.includes(s.course));
        
        // If it's a Maternelle key (ID 67AM3C or Full Name) AND has ghost courses, DELETE it.
        const isMaternelleKey = key === "67AM3C" || 
                                key.toLowerCase().includes("maternelle") || 
                                key === "1ERA" || key === "2ERA" || key === "3ERA";

        // WAIT! We don't want to delete 1ERA if it's the clean one.
        // Let's only delete if it has GHOST COURSES.
        if (isMaternelleKey && hasGhostCourse) {
            console.log(`Deleting polluted key: ${key}`);
            delete newTimetables[key];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await db.school.update({
            where: { id: school.id },
            data: { timetables: JSON.stringify(newTimetables) }
        });
        console.log(`Cleanup complete. Deleted ${deletedCount} polluted keys.`);
    } else {
        console.log("No polluted keys found.");
    }
}

main().catch(console.error);
