
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const school = await prisma.school.findFirst();
    if (!school) return;

    const timetables = JSON.parse(school.timetables || '{}');
    const structure = JSON.parse(school.structure || '{}');

    console.log("=== TARGET ID: 67AM3C ===");
    const tt67 = timetables["67AM3C"];
    if (tt67) {
        const c67 = new Set();
        Object.values(tt67).forEach(s => { if(s && s.course) c67.add(s.course); });
        console.log(`Courses in 67AM3C: [${Array.from(c67).join(", ")}]`);
        console.log(`Count: ${c67.size}`);
    } else {
        console.log("ID 67AM3C NOT FOUND IN TIMETABLES");
    }

    console.log("\n=== SEARCHING FOR 22 COURSES ===");
    for (const key of Object.keys(timetables)) {
        const slots = timetables[key];
        const courses = new Set();
        Object.values(slots).forEach(s => { if(s && s.course) courses.add(s.course); });
        if (courses.size > 15) {
            console.log(`Key: [${key}] | Count: ${courses.size}`);
            // Check if this key matches "2EME MATERNELLE" or "2EME PRIMAIRE"
            const inStruct = Object.values(structure).flatMap(l => l.classrooms || []).find(c => c.id === key);
            console.log(`  Structure Match: ${inStruct ? inStruct.name : "NONE"}`);
        }
    }

    console.log("\n=== MATERNELLE STRUCTURE IDs ===");
    const matCls = (structure.maternelle && structure.maternelle.classrooms) || [];
    matCls.forEach(c => console.log(`ID: ${c.id} | Name: ${c.name}`));

  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
