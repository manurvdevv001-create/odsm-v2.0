const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const assessment = await prisma.assessment.findFirst({
    include: {
      course: true,
      classroom: true
    }
  });
  console.log('--- Assessment Sample ---');
  console.log(JSON.stringify(assessment, null, 2));
  
  const courses = await prisma.course.findMany({ take: 5 });
  console.log('\n--- Courses Sample ---');
  console.log(JSON.stringify(courses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
