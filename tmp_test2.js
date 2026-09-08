const { PrismaClient } = require('@prisma/client');
try {
  const prisma = new PrismaClient();
  prisma.school.findMany().catch(e => console.error("ASYNC ERROR:", e.message));
} catch(e) {
  console.error("SYNC ERROR:", e.message);
}
