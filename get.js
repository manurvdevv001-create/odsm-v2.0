const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const s = await prisma.school.findFirst({ where: { matricule: '67AM3C' } });
    if (!s) return console.log('no school');
    const c = JSON.parse(s.courses);
    console.log(JSON.stringify(c, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
