const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  console.log(JSON.stringify(JSON.parse(school.calendar), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
