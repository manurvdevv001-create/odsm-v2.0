const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const school = await prisma.school.findFirst();
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
        const hasGhostCourse = slots.some((s) => ghostCourseNames.includes(s.course));
        
        const isMaternelleKey = key === "67AM3C" || 
                                key.toLowerCase().includes("maternelle") || 
                                key === "1ERA" || key === "2ERA" || key === "3ERA";

        if (isMaternelleKey && hasGhostCourse) {
            console.log(`Deleting polluted key: ${key}`);
            delete newTimetables[key];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await prisma.school.update({
            where: { id: school.id },
            data: { timetables: JSON.stringify(newTimetables) }
        });
        console.log(`Cleanup complete. Deleted ${deletedCount} polluted keys.`);
    } else {
        console.log("No polluted keys found.");
    }

    await prisma.$disconnect();
}

main().catch(console.error);
