import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

async function main() {
    const dbPath = path.resolve(process.cwd(), 'dev.db');
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
    const prisma = new PrismaClient({ adapter });
    
    let output = "";
    const log = (msg: string) => {
        output += msg + "\n";
        console.log(msg);
    };

    try {
        await prisma.$connect();
        const school = await prisma.school.findUnique({
            where: { matricule: '67AM3C' }
        });

        if (!school) {
            log("❌ Aucun établissement trouvé avec le matricule 67AM3C !");
            return;
        }

        log(`=== INSPECTION DES CLASSES DE COLLEGE BOBOTO ===`);
        log(`Nom : ${school.name}`);
        log(`Matricule : ${school.matricule}`);
        
        log(`\n--- levels (brut) ---`);
        log(String(school.levels));
        
        log(`\n--- structure (brut) ---`);
        log(String(school.structure));
        
        log(`\n--- calendar (brut) ---`);
        log(String(school.calendar));

        log(`\n--- configuration (brut) ---`);
        log(String(school.configuration));

        const students = await prisma.student.findMany({
            where: { schoolMatricule: '67AM3C' }
        });
        log(`\nNombre d'élèves enregistrés : ${students.length}`);
        
        const classesFromStudents = new Set(students.map(s => s.classroomName).filter(Boolean));
        log("Classes référencées par les élèves : " + JSON.stringify(Array.from(classesFromStudents), null, 2));

        fs.writeFileSync(path.resolve(process.cwd(), 'scratch/classes_inspect.txt'), output);
        await prisma.$disconnect();
    } catch (e: any) {
        log(`❌ Erreur pendant l'inspection : ${e.message}`);
    }
}

main();
