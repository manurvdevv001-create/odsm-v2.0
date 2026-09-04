
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function check() {
  try {
    const school = await prisma.school.findFirst();
    if (!school) return;

    const timetables = JSON.parse(school.timetables || '{}');
    const target = timetables["67AM3C"];
    const nameBased = timetables["2EME MATERNELLE"];

    const result = {
        target_67AM3C: target ? Object.values(target).map(s => s.course).filter(Boolean) : "NOT FOUND",
        target_NAME: nameBased ? Object.values(nameBased).map(s => s.course).filter(Boolean) : "NOT FOUND",
        allKeys: Object.keys(timetables).filter(k => k.includes("MATERNEL") || k.includes("67"))
    };

    fs.writeFileSync('db_check.json', JSON.stringify(result, null, 2));

  } catch (e) {
    fs.writeFileSync('db_error.txt', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
