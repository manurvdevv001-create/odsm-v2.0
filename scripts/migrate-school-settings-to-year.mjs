import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'prisma', 'dev.db');
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

function safeParse(value, fallback = {}) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    return value;
}

function normalizeSchoolYear(year) {
    if (!year) return null;
    const trimmed = String(year).trim();
    const match = trimmed.match(/(\d{4})\s*-\s*(\d{4})/);
    return match ? `${match[1]}-${match[2]}` : null;
}

async function main() {
    console.log('Migrating school settings into SchoolYearSettings...');

    const schools = await prisma.school.findMany({
        select: {
            matricule: true,
            name: true,
            calendar: true,
            configuration: true,
            financeSettings: true,
            structure: true,
            courses: true,
            timeSlots: true,
            timetables: true,
            activityLog: true,
            users: true
        }
    });

    let migratedCount = 0;
    let archivedCount = 0;

    for (const school of schools) {
        const calendar = safeParse(school.calendar, {});
        const activeYear = normalizeSchoolYear(calendar?.schoolYear);

        if (!activeYear) {
            console.warn(`Skipping school ${school.matricule} (${school.name}) because active year is not defined`);
            continue;
        }

        const configuration = safeParse(school.configuration, {});
        const archivedCalendars = configuration?.archivedCalendars || {};
        const financeSettingsRaw = safeParse(school.financeSettings, {});

        const activePayload = {
            calendar: JSON.stringify(calendar),
            financeSettings: JSON.stringify(typeof financeSettingsRaw === 'object' && financeSettingsRaw !== null && financeSettingsRaw[activeYear]
                ? financeSettingsRaw[activeYear]
                : financeSettingsRaw),
            configuration: JSON.stringify(configuration),
            structure: JSON.stringify(safeParse(school.structure, {})),
            courses: JSON.stringify(safeParse(school.courses, {})),
            timeSlots: JSON.stringify(safeParse(school.timeSlots, {})),
            timetables: JSON.stringify(safeParse(school.timetables, {})),
            activityLog: JSON.stringify(safeParse(school.activityLog, [])),
            users: JSON.stringify(safeParse(school.users, []))
        };

        await prisma.schoolYearSettings.upsert({
            where: {
                schoolMatricule_schoolYear: {
                    schoolMatricule: school.matricule,
                    schoolYear: activeYear
                }
            },
            update: {
                ...activePayload,
                isDraft: false
            },
            create: {
                schoolMatricule: school.matricule,
                schoolYear: activeYear,
                isDraft: false,
                ...activePayload
            }
        });
        migratedCount += 1;

        for (const [archivedYearRaw, archiveData] of Object.entries(archivedCalendars)) {
            const archivedYear = normalizeSchoolYear(archivedYearRaw);
            if (!archivedYear) continue;

            const archivedPayload = {
                calendar: JSON.stringify(archiveData),
                financeSettings: JSON.stringify(typeof financeSettingsRaw === 'object' && financeSettingsRaw !== null && financeSettingsRaw[archivedYear]
                    ? financeSettingsRaw[archivedYear]
                    : {}),
                configuration: JSON.stringify(configuration),
                structure: JSON.stringify(archiveData?.structure || safeParse(school.structure, {})),
                courses: JSON.stringify(archiveData?.courses || safeParse(school.courses, {})),
                timeSlots: JSON.stringify(archiveData?.timeSlots || safeParse(school.timeSlots, {})),
                timetables: JSON.stringify(archiveData?.timetables || safeParse(school.timetables, {})),
                activityLog: JSON.stringify(safeParse(school.activityLog, [])),
                users: JSON.stringify(safeParse(school.users, []))
            };

            await prisma.schoolYearSettings.upsert({
                where: {
                    schoolMatricule_schoolYear: {
                        schoolMatricule: school.matricule,
                        schoolYear: archivedYear
                    }
                },
                update: {
                    ...archivedPayload,
                    isDraft: false
                },
                create: {
                    schoolMatricule: school.matricule,
                    schoolYear: archivedYear,
                    isDraft: false,
                    ...archivedPayload
                }
            });
            archivedCount += 1;
        }
    }

    console.log(`
Migration complete. Active-year settings migrated for ${migratedCount} school(s).`);
    console.log(`Archived-year settings migrated for ${archivedCount} archive entry(ies).`);
}

main()
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
