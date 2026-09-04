const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('Starting data migration for multi-tenancy...');
    const schools = await prisma.school.findMany();
    if (schools.length === 0) {
        console.log('No schools found. Skipping migration.');
        return;
    }
    const defaultSchoolMatricule = schools[0].matricule;
    console.log('Using default school matricule for orphans: ' + defaultSchoolMatricule);
    await prisma.classroom.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.course.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.assessment.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.studentResult.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.enrollment.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.gradeSubmission.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.subject.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    await prisma.periodClosure.updateMany({ where: { schoolMatricule: 'TO_MIGRATE' }, data: { schoolMatricule: defaultSchoolMatricule } });
    console.log('Migration finished successfully.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
