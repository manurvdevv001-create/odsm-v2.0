import { db as prisma } from './src/lib/db';

const normalizeStr = (s: string) => {
    if (!s) return "";
    let norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
    norm = norm.replace(/([2-9])eme/g, '$1e');
    norm = norm.replace(/education de base/g, 'cteb');
    return norm.replace(/\s+/g, ' ');
};

async function main() {
    console.log("Migrating Assessment classroomId to UUIDs...");

    const schools = await prisma.school.findMany();
    for (const school of schools) {
        const classrooms = await prisma.classroom.findMany({
            where: { schoolMatricule: school.matricule }
        });
        const classroomMap = new Map<string, string>();
        classrooms.forEach(c => {
            classroomMap.set(normalizeStr(c.name), c.id);
        });

        const assessments = await prisma.assessment.findMany({
            where: { schoolMatricule: school.matricule }
        });

        for (const assessment of assessments) {
            if (assessment.classroomId.includes('-') && assessment.classroomId.length > 20) {
                continue; // Already a UUID
            }
            const normKey = normalizeStr(assessment.classroomId);
            const uuid = classroomMap.get(normKey);
            if (uuid) {
                await prisma.assessment.update({
                    where: { id: assessment.id },
                    data: { classroomId: uuid }
                });
                console.log(`Migrated Assessment ${assessment.id} to classroom ${uuid}`);
            }
        }
    }
    console.log("Done migrating assessments.");
}

main().catch(e => { console.error(e); process.exit(1); });
