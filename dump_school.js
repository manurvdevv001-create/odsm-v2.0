
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function dump() {
  try {
    const school = await prisma.school.findFirst();
    if (!school) return;

    const data = {
        name: school.name,
        matricule: school.matricule,
        structure: JSON.parse(school.structure || '{}'),
        timetables: JSON.parse(school.timetables || '{}'),
        courses: JSON.parse(school.courses || '{}'),
        studentsCount: await prisma.student.count()
    };

    fs.writeFileSync('school_dump.json', JSON.stringify(data, null, 2));
    console.log("Dump successful: school_dump.json");

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

dump();
