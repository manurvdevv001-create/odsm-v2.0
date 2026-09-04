// check_db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const assessments = await prisma.assessment.findMany({
      select: {
        id: true,
        title: true,
        isPublished: true,
        hasPendingChanges: true,
        results: {
          take: 1,
          select: { score: true, publishedScore: true }
        }
      }
    });
    console.log(JSON.stringify(assessments, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
