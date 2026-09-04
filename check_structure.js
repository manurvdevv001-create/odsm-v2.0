const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const school = await prisma.school.findFirst();
    if (!school) {
        console.log("No school found");
        return;
    }

    const structure = JSON.parse(school.structure || "{}");
    const classrooms = structure.classrooms || [];
    console.log("Classrooms in structure:");
    classrooms.forEach(c => {
        console.log(`- ID: ${c.id}, Name: ${c.name}, Level: ${c.level}`);
    });

    const timetables = JSON.parse(school.timetables || "{}");
    console.log("\nTimetables keys:");
    Object.keys(timetables).forEach(k => {
        const courses = new Set(Object.values(timetables[k]).map(s => s.course).filter(Boolean));
        console.log(`- Key: ${k}, Courses (${courses.size}): ${Array.from(courses).join(', ')}`);
    });

    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
