const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  if (school) {
    const courses = JSON.parse(school.courses || '{}');
    console.log(JSON.stringify(courses, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
