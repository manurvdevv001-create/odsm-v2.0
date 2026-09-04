import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

async function main() {
    console.log("--- PROD DB DIAGNOSTIC ---");
    const prodDbPath = 'C:\\Users\\emmanuel\\Documents\\ODSM\\odsm-v2-prod\\dev.db';
    console.log("Prod DB Path:", prodDbPath);
    console.log("File exists?", fs.existsSync(prodDbPath));
    
    if (fs.existsSync(prodDbPath)) {
        const stats = fs.statSync(prodDbPath);
        console.log("File Size:", stats.size, "bytes");
    }

    try {
        const adapter = new PrismaBetterSqlite3({ url: `file:${prodDbPath}` });
        const prisma = new PrismaClient({ adapter });
        
        console.log("Connecting to Prod DB...");
        await prisma.$connect();
        console.log("Connected to Prod DB successfully!");

        const schoolCount = await prisma.school.count();
        console.log("Schools in Prod DB:", schoolCount);

        if (schoolCount > 0) {
            const school = await prisma.school.findFirst();
            console.log("First School Name in Prod DB:", school?.name);
            console.log("First School Matricule in Prod DB:", school?.matricule);
        }

        await prisma.$disconnect();
    } catch (error: any) {
        console.error("PRISMA ERROR ON PROD DB:", error.message);
        if (error.code) console.error("Error Code:", error.code);
    }
}

main();
