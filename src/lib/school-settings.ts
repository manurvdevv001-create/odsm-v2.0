import { db } from '@/lib/db';
import { getCurrentSchoolYear, getNextSchoolYear, normalizeSchoolYear } from '@/lib/school-year-utils';

export type SchoolSettingsPayload = {
    calendar?: any;
    financeSettings?: any;
    configuration?: any;
    structure?: any;
    courses?: any;
    timeSlots?: any;
    timetables?: any;
    activityLog?: any;
    users?: any;
};

export type SchoolSettingsResult = SchoolSettingsPayload & {
    schoolMatricule: string;
    schoolYear: string;
    isDraft: boolean;
    activeYear: string | null;
    yearState: 'active' | 'archive' | 'draft';
};

function safeParse(value: any, fallback: any = {}) {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    return value;
}

function resolveYearState(activeYear: string | null, targetYear: string): 'active' | 'archive' | 'draft' {
    if (!activeYear) return 'draft';
    if (targetYear < activeYear) return 'archive';
    if (targetYear > activeYear) return 'draft';
    return 'active';
}

let schoolYearSettingsTableInitialized = false;

async function ensureSchoolYearSettingsTable() {
    if (schoolYearSettingsTableInitialized) {
        return;
    }

    // Sur Turso (cloud), la table a déjà été créée via baseline.sql.
    // sqlite_master n'existe pas sur Turso, on court-circuite la vérification.
    if (process.env.TURSO_DATABASE_URL) {
        schoolYearSettingsTableInitialized = true;
        return;
    }

    try {
        const result: any = await db.$queryRaw`SELECT count(name) as count FROM sqlite_master WHERE type='table' AND name='SchoolYearSettings';`;
        const count = Array.isArray(result) && result.length > 0 ? (result[0]?.count ?? 0) : 0;
        if (!count) {
            await db.$executeRawUnsafe(`
                CREATE TABLE IF NOT EXISTS "SchoolYearSettings" (
                    "id" TEXT PRIMARY KEY,
                    "schoolMatricule" TEXT NOT NULL,
                    "schoolYear" TEXT NOT NULL,
                    "isDraft" BOOLEAN NOT NULL DEFAULT 0,
                    "calendar" TEXT NOT NULL DEFAULT '{}',
                    "financeSettings" TEXT NOT NULL DEFAULT '{}',
                    "configuration" TEXT NOT NULL DEFAULT '{}',
                    "structure" TEXT NOT NULL DEFAULT '{}',
                    "courses" TEXT NOT NULL DEFAULT '{}',
                    "timeSlots" TEXT NOT NULL DEFAULT '{}',
                    "timetables" TEXT NOT NULL DEFAULT '{}',
                    "activityLog" TEXT NOT NULL DEFAULT '[]',
                    "users" TEXT NOT NULL DEFAULT '[]',
                    "createdBy" TEXT,
                    "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
                    "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
                );
            `);
            await db.$executeRawUnsafe(`
                CREATE UNIQUE INDEX IF NOT EXISTS "SchoolYearSettings_schoolMatricule_schoolYear_key"
                ON "SchoolYearSettings" ("schoolMatricule", "schoolYear");
            `);
            await db.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS "SchoolYearSettings_schoolMatricule_schoolYear_idx"
                ON "SchoolYearSettings" ("schoolMatricule", "schoolYear");
            `);
        }

        schoolYearSettingsTableInitialized = true;
    } catch (error: any) {
        console.error('[SchoolSettings] Failed to ensure SchoolYearSettings table exists:', error);
        throw error;
    }

}

export async function getActiveYearForSchool(matricule: string): Promise<string | null> {
    const school = await db.school.findUnique({
        where: { matricule },
        select: { calendar: true }
    });
    if (!school) return null;
    const calendar = safeParse(school.calendar, {});
    return calendar?.schoolYear || null;
}

export async function getSchoolSettingsForYear(matricule: string, targetYear?: string): Promise<SchoolSettingsResult | null> {
    const school = await db.school.findUnique({
        where: { matricule },
        select: {
            matricule: true,
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

    if (!school) return null;

    const parsedCalendar = safeParse(school.calendar, {});
    const activeYear = parsedCalendar?.schoolYear || null;
    const parsedConfiguration = safeParse(school.configuration, {});
    const archivedCalendars = parsedConfiguration?.archivedCalendars || {};
    const knownYears = Array.isArray(parsedConfiguration?.knownYears)
        ? parsedConfiguration.knownYears.map((year: any) => normalizeSchoolYear(year)).filter(Boolean)
        : [];

    let normalizedTargetYear = targetYear ? normalizeSchoolYear(targetYear) : activeYear;
    if (!normalizedTargetYear) {
        normalizedTargetYear = knownYears.length > 0
            ? knownYears[knownYears.length - 1]
            : Object.keys(archivedCalendars)
                .map((year) => normalizeSchoolYear(year))
                .filter(Boolean)
                .sort()
                .pop() || getCurrentSchoolYear();
    }

    const yearState = resolveYearState(activeYear, normalizedTargetYear);

    await ensureSchoolYearSettingsTable();
    const rawSettings = await db.schoolYearSettings.findUnique({
        where: {
            schoolMatricule_schoolYear: {
                schoolMatricule: matricule,
                schoolYear: normalizedTargetYear
            }
        }
    });

    if (rawSettings) {
        return {
            schoolMatricule: matricule,
            schoolYear: normalizedTargetYear,
            isDraft: rawSettings.isDraft,
            activeYear,
            yearState,
            calendar: safeParse(rawSettings.calendar, {}),
            financeSettings: safeParse(rawSettings.financeSettings, {}),
            configuration: safeParse(rawSettings.configuration, {}),
            structure: safeParse(rawSettings.structure, {}),
            courses: safeParse(rawSettings.courses, {}),
            timeSlots: safeParse(rawSettings.timeSlots, {}),
            timetables: safeParse(rawSettings.timetables, {}),
            activityLog: safeParse(rawSettings.activityLog, []),
            users: safeParse(rawSettings.users, [])
        };
    }

    const financeSettingsRaw = safeParse(school.financeSettings, {});
    const financeSettings = typeof financeSettingsRaw === 'object' && financeSettingsRaw !== null && normalizedTargetYear in financeSettingsRaw
        ? financeSettingsRaw[normalizedTargetYear]
        : financeSettingsRaw;

    let calendar = { ...parsedCalendar };
    let structure = safeParse(school.structure, {});
    let courses = safeParse(school.courses, {});
    let timeSlots = safeParse(school.timeSlots, {});
    let timetables = safeParse(school.timetables, {});

    if (yearState !== 'active' && archivedCalendars[normalizedTargetYear]) {
        const archive = archivedCalendars[normalizedTargetYear];
        calendar = archive;
        if (archive.structure) structure = archive.structure;
        if (archive.courses) courses = archive.courses;
        if (archive.timeSlots) timeSlots = archive.timeSlots;
        if (archive.timetables) timetables = archive.timetables;
    }

    return {
        schoolMatricule: matricule,
        schoolYear: normalizedTargetYear,
        isDraft: false,
        activeYear,
        yearState,
        calendar,
        financeSettings,
        configuration: parsedConfiguration,
        structure,
        courses,
        timeSlots,
        timetables,
        activityLog: safeParse(school.activityLog, []),
        users: safeParse(school.users, [])
    };
}

function serializeSettingsPayload(payload: SchoolSettingsPayload) {
    return {
        calendar: JSON.stringify(payload.calendar ?? {}),
        financeSettings: JSON.stringify(payload.financeSettings ?? {}),
        configuration: JSON.stringify(payload.configuration ?? {}),
        structure: JSON.stringify(payload.structure ?? {}),
        courses: JSON.stringify(payload.courses ?? {}),
        timeSlots: JSON.stringify(payload.timeSlots ?? {}),
        timetables: JSON.stringify(payload.timetables ?? {}),
        activityLog: JSON.stringify(payload.activityLog ?? []),
        users: JSON.stringify(payload.users ?? []),
    };
}

export async function upsertSchoolSettingsForYear(
    matricule: string,
    schoolYear: string,
    payload: SchoolSettingsPayload,
    isDraft = false,
    createdBy?: string
) {
    const normalizedYear = normalizeSchoolYear(schoolYear);
    const now = new Date();
    const data = serializeSettingsPayload(payload);

    await ensureSchoolYearSettingsTable();

    return await db.schoolYearSettings.upsert({
        where: {
            schoolMatricule_schoolYear: { schoolMatricule: matricule, schoolYear: normalizedYear }
        },
        update: {
            ...data,
            isDraft,
            updatedAt: now
        },
        create: {
            schoolMatricule: matricule,
            schoolYear: normalizedYear,
            isDraft,
            createdBy,
            ...data
        }
    });
}

export async function getSchoolSettingsYears(matricule: string): Promise<string[]> {
    await ensureSchoolYearSettingsTable();
    const rows = await db.schoolYearSettings.findMany({
        where: { schoolMatricule: matricule },
        select: { schoolYear: true }
    });
    return rows.map((row) => row.schoolYear);
}
