import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function migrateLogs() {
    console.log("Starting log migration...");
    const schools = await prisma.school.findMany({
        select: { matricule: true, activityLog: true }
    });

    for (const school of schools) {
        if (!school.activityLog) continue;
        
        try {
            const logs = JSON.parse(school.activityLog);
            if (!Array.isArray(logs)) continue;

            console.log(`Migrating ${logs.length} logs for school ${school.matricule}...`);

            for (const log of logs) {
                // Check if log already exists (simple heuristic by description and timestamp)
                const exists = await prisma.activityLog.findFirst({
                    where: {
                        schoolMatricule: school.matricule,
                        description: log.description || log.message,
                        timestamp: new Date(log.timestamp || log.date)
                    }
                });

                if (!exists) {
                    await prisma.activityLog.create({
                        data: {
                            schoolMatricule: school.matricule,
                            description: log.description || log.message || "Action sans description",
                            user: log.user || "Système",
                            type: log.type || "info",
                            schoolYear: log.schoolYear,
                            timestamp: new Date(log.timestamp || log.date)
                        }
                    });
                }
            }
            console.log(`Finished migrating for ${school.matricule}`);
        } catch (e) {
            console.error(`Failed to migrate logs for ${school.matricule}:`, e);
        }
    }
    console.log("Migration complete.");
}

migrateLogs()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
