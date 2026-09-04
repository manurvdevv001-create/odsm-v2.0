import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

async function main() {
    console.log("=== INSPECTION DE TOUS LES ÉTABLISSEMENTS ===");
    
    const dbPath = path.resolve(process.cwd(), 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    const prisma = new PrismaClient({ adapter });
    
    try {
        await prisma.$connect();
        const schools = await prisma.school.findMany();

        for (const school of schools) {
            console.log(`\n🏫 École : ${school.name} (${school.matricule})`);
            
            const struct = typeof school.structure === 'string' ? JSON.parse(school.structure) : school.structure;
            const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
            
            console.log("  - Levels active:", school.levels);
            
            // Compter les classes dans la structure principale
            let structClassCount = 0;
            if (struct) {
                for (const level of ['maternelle', 'primaire', 'secondaire']) {
                    const lvlStruct = struct[level] || {};
                    for (const [grade, count] of Object.entries(lvlStruct)) {
                        if (['classrooms', 'options', 'postCTEB', 'config'].includes(grade)) continue;
                        if (typeof count === 'number') structClassCount += count;
                    }
                }
            }
            console.log(`  - Classes dans 'structure' : ${structClassCount}`);

            // Compter les classes dans calendar.structure
            let calStructClassCount = 0;
            const calStruct = calendar?.structure;
            if (calStruct) {
                for (const level of ['maternelle', 'primaire', 'secondaire']) {
                    const lvlStruct = calStruct[level] || {};
                    for (const [grade, count] of Object.entries(lvlStruct)) {
                        if (['classrooms', 'options', 'postCTEB', 'config'].includes(grade)) continue;
                        if (typeof count === 'number') calStructClassCount += count;
                    }
                }
            }
            console.log(`  - Classes dans 'calendar.structure' : ${calStructClassCount}`);
        }

        await prisma.$disconnect();
    } catch (e: any) {
        console.error("❌ Erreur pendant l'inspection :", e.message);
    }
}

main();
