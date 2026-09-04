import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

async function main() {
    console.log("=== RE-SYNCHRONISATION ET CORRECTION DES STRUCTURES ACADÉMIQUES ===");
    
    const dbPath = path.resolve(process.cwd(), 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    const prisma = new PrismaClient({ adapter });
    
    try {
        await prisma.$connect();
        const schools = await prisma.school.findMany();

        for (const school of schools) {
            console.log(`\n🏫 Analyse de : ${school.name} (${school.matricule})`);
            
            const struct = typeof school.structure === 'string' ? JSON.parse(school.structure) : school.structure;
            const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
            
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
            
            console.log(`  - Classes dans 'structure' actuelle : ${structClassCount}`);
            console.log(`  - Classes dans 'calendar.structure' : ${calStructClassCount}`);
            
            if (structClassCount === 0 && calStructClassCount > 0) {
                console.log(`  🔄 Restauration de la structure depuis calendar.structure...`);
                
                // Extraire uniquement les structures maternelle/primaire/secondaire propres
                const newStructure = {
                    maternelle: calStruct.maternelle || { "1ère Maternelle": 0, "2ème Maternelle": 0, "3ème Maternelle": 0 },
                    primaire: calStruct.primaire || { "1e Primaire": 0, "2e Primaire": 0, "3e Primaire": 0, "4e Primaire": 0, "5e Primaire": 0, "6e Primaire": 0, "6e Spécial": 0 },
                    secondaire: calStruct.secondaire || { "7e CTEB": 0, "8e CTEB": 0, "1e Humanité": 0, "2e Humanité": 0, "3e Humanité": 0, "4e Humanité": 0 }
                };
                
                // Mettre à jour l'école dans la base de données
                await prisma.school.update({
                    where: { id: school.id },
                    data: {
                        structure: JSON.stringify(newStructure)
                    }
                });
                
                console.log(`  ✅ Structure restaurée pour ${school.name} !`);
            } else {
                console.log(`  ℹ️ Aucune correction requise.`);
            }
        }

        await prisma.$disconnect();
    } catch (e: any) {
        console.error("❌ Erreur pendant la correction :", e.message);
    }
}

main();
