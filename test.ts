import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const a = await prisma.assessment.findMany({ include: { period: true } });
    console.log(a.map(x => ({ id: x.id, title: x.title, courseId: x.courseId, periodId: x.periodId, periodName: x.period?.name })));
}

run();
