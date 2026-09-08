const { PrismaClient } = require('./node_modules/.prisma/client/index.js');
const prisma = new PrismaClient();
prisma.school.findMany().catch(e => {
  console.log("CAUGHT ERROR:", e.message);
});
