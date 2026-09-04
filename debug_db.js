
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  try {
    const school = await prisma.school.findFirst();
    if (!school) {
        console.log("No school found");
        return;
    }

    const struct = JSON.parse(school.structure || '{}');
    const timetables = JSON.parse(school.timetables || '{}');

    console.log("=== STRUCTURE (MATERNELLE) ===");
    const matClasses = (struct.maternelle && struct.maternelle.classrooms) || [];
    matClasses.forEach(c => {
        console.log(`ID: ${c.id} | Name: ${c.name}`);
    });

    console.log("\n=== TIMETABLE KEYS ANALYSIS ===");
    for (const key of Object.keys(timetables)) {
        const slots = timetables[key];
        const courses = new Set();
        Object.values(slots).forEach(s => {
            if (s && s.course) courses.add(s.course);
        });
        
        if (courses.size > 0) {
            // Filter to show interesting ones
            const isMat = key.toUpperCase().includes("MATERNELLE") || key.length < 10;
            if (isMat || courses.size === 4 || courses.size > 15) {
                console.log(`Key: [${key}] | Courses Count: ${courses.size}`);
                if (courses.size < 10) {
                    console.log(`  Courses: ${Array.from(courses).join(", ")}`);
                }
            }
        }
    }

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

debug();
