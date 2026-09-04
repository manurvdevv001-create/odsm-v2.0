import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import fs from 'fs';

async function main() {
    console.log("--- DB DIAGNOSTIC ---");
    const dbPath = path.resolve(process.cwd(), 'dev.db');
    console.log("Current Directory:", process.cwd());
    console.log("Expected DB Path:", dbPath);
    console.log("File exists?", fs.existsSync(dbPath));
    
    if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        console.log("File Size:", stats.size, "bytes");
    }

    console.log("DATABASE_URL from env:", process.env.DATABASE_URL);

    const RESOLVED_URL = process.env.DATABASE_URL || `file:${dbPath}`;
    console.log("Resolved URL:", RESOLVED_URL);

    try {
        const adapter = new PrismaBetterSqlite3({ url: RESOLVED_URL });
        const prisma = new PrismaClient({ adapter });
        
        console.log("Connecting...");
        await prisma.$connect();
        console.log("Connected successfully!");

        const schoolCount = await prisma.school.count();
        console.log("Schools in DB:", schoolCount);

        if (schoolCount > 0) {
            const school = await prisma.school.findFirst();
            console.log("First School Name:", school?.name);
            console.log("First School Matricule:", school?.matricule);
        }

        await prisma.$disconnect();
    } catch (error: any) {
        console.error("PRISMA ERROR:", error.message);
        if (error.code) console.error("Error Code:", error.code);
    }
}

main();
