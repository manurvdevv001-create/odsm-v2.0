import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('Fields in StaffProfile:', Object.keys((prisma as any)._dmmf.modelMap.StaffProfile.fields));
  await prisma.$disconnect();
}

main().catch(console.error);
