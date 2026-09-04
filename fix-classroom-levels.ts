import { db as prisma } from './src/lib/db';

async function main() {
    console.log("Fixing classroom levels...");

    const schools = await prisma.school.findMany();
    let updatedCount = 0;

    for (const school of schools) {
        const classrooms = await prisma.classroom.findMany({
            where: { schoolMatricule: school.matricule }
        });

        const structure = school.structure ? JSON.parse(school.structure as string) : {};

        for (const classroom of classrooms) {
            let correctLevel = classroom.level;
            const nameLower = classroom.name.toLowerCase();

            // Infer from name first
            if (nameLower.includes("maternelle")) {
                correctLevel = "MATERNELLE";
            } else if (nameLower.includes("primaire")) {
                correctLevel = "PRIMAIRE";
            } else {
                correctLevel = "SECONDAIRE";
            }

            // Alternatively, look up the level from the school structure if needed
            // But name inference should be 100% accurate given the structure we saw earlier.

            if (classroom.level !== correctLevel) {
                await prisma.classroom.update({
                    where: { id: classroom.id },
                    data: { level: correctLevel }
                });
                updatedCount++;
                console.log(`Updated classroom ${classroom.name} level from ${classroom.level} to ${correctLevel}`);
            }
        }
    }

    console.log(`Finished fixing classroom levels. Updated ${updatedCount} classrooms.`);
}

main().catch(e => { console.error(e); process.exit(1); });
