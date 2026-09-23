"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

// Génère un matricule ODSM alphanumérique unique (6 caractères)
function generateOdsmMatricule(length: number = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const SchoolIdentitySchema = z.object({
    name: z.string().min(3, "Le nom de l'école doit contenir au moins 3 caractères"),
    secopeMatricule: z.string().optional(),
    logo: z.string().optional(),
});

export async function setupSchoolIdentity(formData: FormData, executorName?: string) {
    const rawData = {
        name: formData.get("name"),
        secopeMatricule: formData.get("secopeMatricule") || undefined,
        logo: formData.get("logo") || undefined,
    };

    const validatedFields = SchoolIdentitySchema.safeParse(rawData);

    if (!validatedFields.success) {
        return {
            success: false,
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name, secopeMatricule, logo } = validatedFields.data;

    try {
        // Générer un matricule ODSM unique
        let odsmMatricule: string;
        let attempts = 0;
        do {
            odsmMatricule = generateOdsmMatricule();
            const exists = await db.school.findUnique({
                where: { matricule: odsmMatricule },
            });
            if (!exists) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return {
                success: false,
                message: "Impossible de générer un matricule unique. Veuillez réessayer.",
            };
        }

        // Créer l'école avec le matricule ODSM auto-généré
        await db.school.create({
            data: {
                name,
                matricule: odsmMatricule,
                secopeMatricule: secopeMatricule || null,
                logo: logo || undefined,
                password: "changeme", // Mot de passe temporaire par défaut
                configuration: JSON.stringify({
                    setupStage: "IDENTITY_COMPLETED",
                    odsmMatricule,
                }),
                licenses: {
                    create: {
                        type: "DEMO",
                        status: "ACTIVE",
                        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                        restrictions: JSON.stringify({
                            maxStudentsPerClassroom: 4,
                            maxClassesPerLevel: {
                                MATERNELLE: 1,
                                PRIMAIRE: 3,
                                SECONDAIRE: 4
                            },
                            maxCoursesPerClassroom: 5,
                            maxPersonnel: null
                        })
                    }
                }
            },
        });

        revalidatePath("/setup");
        await logActivity(odsmMatricule, `Identité de l'école configurée : ${name}`, executorName || "Administrateur", "success");
        return { success: true, matricule: odsmMatricule };
    } catch (error: unknown) {
        console.error("Erreur de configuration :", error);
        const errorMessage = error instanceof Error ? error.message : "Erreur de base de données inconnue.";
        return { success: false, message: `Erreur de base de données : ${errorMessage}` };
    }
}


// --- NEW CALENDAR LOGIC (SWAP STRATEGY) ---

export async function getSchoolCalendarData(matricule: string, year: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, configuration: true }
        });

        if (!school) return { success: false, error: 'École introuvable' };

        const activeCalendar = JSON.parse(school.calendar || '{}');
        const config = JSON.parse(school.configuration || '{}');
        const archives = config.archivedCalendars || {};

        // Standardize School Year string
        const targetYear = year.trim();

        // 1. Check if it matches Active
        if (activeCalendar.schoolYear === targetYear) {
            return { success: true, data: { ...activeCalendar, isActive: true } };
        }

        // 2. Check Archives
        if (archives[targetYear]) {
            return { success: true, data: { ...archives[targetYear], isActive: false } };
        }

        // 3. Not found -> Return a default template for this new year
        return {
            success: true,
            data: {
                schoolYear: targetYear,
                startDate: '',
                endDate: '',
                maternelle: { periods: [] }, // Will be populated by frontend defaults
                primaire: { periods: [] },
                secondaire: { periods: [] },
                holidays: [],
                vacations: [],
                specialDays: [],
                bufferPeriods: [],
                isActive: false
            }
        };

    } catch (error: any) {
        console.error("getSchoolCalendarData Error:", error);
        return { success: false, error: error.message };
    }
}

export async function saveSchoolCalendar(
    matricule: string, 
    calendar: any, 
    updatedKnownYears?: string[],
    contextualData?: {
        structure?: any;
        courses?: any;
        timeSlots?: any;
        timetables?: any;
    },
    executorName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, configuration: true, structure: true, courses: true, timeSlots: true, timetables: true }
        });

        if (!school) return { success: false, error: 'École introuvable' };

        const activeCalendar = JSON.parse(school.calendar || '{}');
        const config = JSON.parse(school.configuration || '{}');
        let archives = config.archivedCalendars || {};
        let knownYears: string[] = updatedKnownYears || config.knownYears || [];

        if (calendar.schoolYear && !knownYears.includes(calendar.schoolYear)) {
            knownYears.push(calendar.schoolYear);
        }
        knownYears = Array.from(new Set(knownYears)).sort();

        // Prepare the calendar object with optional snapshots
        const calendarWithSnapshots = {
            ...calendar,
            // A public holiday applies to the whole school, regardless of academic level.
            holidays: Array.isArray(calendar.holidays)
                ? calendar.holidays.map((holiday: Record<string, unknown>) =>
                    Object.fromEntries(Object.entries(holiday).filter(([key]) => key !== 'appliesTo'))
                )
                : [],
            ...(contextualData?.structure && { structure: contextualData.structure }),
            ...(contextualData?.courses && { courses: contextualData.courses }),
            ...(contextualData?.timeSlots && { timeSlots: contextualData.timeSlots }),
            ...(contextualData?.timetables && { timetables: contextualData.timetables }),
        };

        let newActiveCalendar = activeCalendar;
        let newArchives = { ...archives };
        let updateData: any = {};

        if (activeCalendar.schoolYear === calendar.schoolYear) {
            // Updating ACTIVE year
            newActiveCalendar = calendarWithSnapshots;
            // Also update the main school columns for the active year
            if (contextualData?.structure) updateData.structure = JSON.stringify(contextualData.structure);
            if (contextualData?.courses) updateData.courses = JSON.stringify(contextualData.courses);
            if (contextualData?.timeSlots) updateData.timeSlots = JSON.stringify(contextualData.timeSlots);
            if (contextualData?.timetables) updateData.timetables = JSON.stringify(contextualData.timetables);
        } else {
            // Updating ARCHIVE/DRAFT year
            newArchives[calendar.schoolYear] = calendarWithSnapshots;
        }

        await db.school.update({
            where: { matricule },
            data: {
                ...updateData,
                calendar: JSON.stringify(newActiveCalendar),
                configuration: JSON.stringify({
                    ...config,
                    knownYears,
                    archivedCalendars: newArchives
                })
            }
        });

        // Keep the year-specific snapshot in sync. The school API prefers this
        // record whenever it exists, otherwise calendar edits appear frozen.
        const yearSettingsUpdate: Record<string, string> = {
            calendar: JSON.stringify(calendarWithSnapshots),
        };
        if (contextualData?.structure) yearSettingsUpdate.structure = JSON.stringify(contextualData.structure);
        if (contextualData?.courses) yearSettingsUpdate.courses = JSON.stringify(contextualData.courses);
        if (contextualData?.timeSlots) yearSettingsUpdate.timeSlots = JSON.stringify(contextualData.timeSlots);
        if (contextualData?.timetables) yearSettingsUpdate.timetables = JSON.stringify(contextualData.timetables);

        await db.schoolYearSettings.updateMany({
            where: {
                schoolMatricule: matricule,
                schoolYear: calendar.schoolYear,
            },
            data: yearSettingsUpdate,
        });

        revalidatePath("/calendar");
        revalidatePath("/settings/calendar");
        await logActivity(
            matricule, 
            `Calendrier scolaire mis à jour (${calendar.schoolYear})`, 
            executorName || "Administrateur", 
            "info", 
            calendar.schoolYear,
            {
                year: calendar.schoolYear,
                updatedAt: new Date().toISOString()
            }
        );

        return { success: true };
    } catch (error: any) {
        console.error("saveSchoolCalendar Error:", error);
        return { success: false, error: "Impossible d'enregistrer le calendrier." };
    }
}

export async function activateSchoolYear(matricule: string, targetYear: string, executorName?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            include: { teachers: true }
        });

        if (!school) return { success: false, error: 'École introuvable' };

        const activeCalendar = JSON.parse(school.calendar || '{}');
        const config = JSON.parse(school.configuration || '{}');
        const archives = config.archivedCalendars || {};
        const currentYear = activeCalendar.schoolYear;

        if (currentYear === targetYear) return { success: true };

        const targetCalendar = archives[targetYear];
        if (!targetCalendar) {
            return { success: false, error: `Le calendrier ${targetYear} n'existe pas encore. Veuillez le créer d'abord.` };
        }

        // 1. CAPTURE SNAPSHOT OF CURRENT (OLD) ACTIVE YEAR
        // This preserves the history of teacher assignments, structure, courses, etc.
        const staffAssignments = (school.teachers || []).map((t: any) => ({
            id: t.id,
            staffNumber: t.staffNumber,
            assignedClassroom: t.assignedClassroom,
            assignedCourses: t.assignedCourses
        }));

        const snapshot = {
            ...activeCalendar,
            structure: JSON.parse(school.structure || "{}"),
            courses: JSON.parse(school.courses || "{}"),
            timeSlots: JSON.parse(school.timeSlots || "{}"),
            timetables: JSON.parse(school.timetables || "{}"),
            staffAssignments,
            isActive: false
        };

        // 2. PREPARE NEW STATE
        const newArchives = { ...archives, [currentYear]: snapshot };
        const newActiveCalendar = { ...targetCalendar, isActive: true };
        delete newArchives[targetYear];

        // 3. LOAD TARGET SNAPSHOTS BACK TO MAIN COLUMNS (if they exist in the target)
        const updateData: any = {
            calendar: JSON.stringify(newActiveCalendar),
            configuration: JSON.stringify({
                ...config,
                archivedCalendars: newArchives
            })
        };

        if (targetCalendar.structure) updateData.structure = JSON.stringify(targetCalendar.structure);
        if (targetCalendar.courses) updateData.courses = JSON.stringify(targetCalendar.courses);
        if (targetCalendar.timeSlots) updateData.timeSlots = JSON.stringify(targetCalendar.timeSlots);
        if (targetCalendar.timetables) updateData.timetables = JSON.stringify(targetCalendar.timetables);

        await db.school.update({
            where: { matricule },
            data: updateData
        });

        // 4. RESTORE STAFF ASSIGNMENTS FOR NEW YEAR (if snapshot exists in target)
        if (targetCalendar.staffAssignments && Array.isArray(targetCalendar.staffAssignments)) {
            for (const assignment of targetCalendar.staffAssignments) {
                await db.staffProfile.update({
                    where: { id: assignment.id },
                    data: {
                        assignedClassroom: assignment.assignedClassroom,
                        assignedCourses: assignment.assignedCourses
                    }
                });
            }
        }

        await logActivity(matricule, `Année scolaire activée : ${targetYear}`, executorName || "Administrateur", "info", targetYear);
        return { success: true };

    } catch (error: any) {
        console.error("activateSchoolYear Error:", error);
        return { success: false, error: error.message };
    }
}


// --- FINANCE SETTINGS ---

export async function getFinanceSettings(
    matricule: string,
    year?: string
): Promise<{ success: boolean; data?: any; activeYear?: string; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { financeSettings: true, calendar: true }
        });

        if (!school) return { success: false, error: 'École introuvable' };

        const calendar = JSON.parse(school.calendar || '{}');
        const activeYear = calendar.schoolYear;
        const targetYear = year || activeYear;

        if (!targetYear) return { success: false, error: "Année scolaire non définie." };

        const allSettings = JSON.parse(school.financeSettings || '{}');

        // Check if legacy (flat) format — has direct 'currencies' array at top level
        const isLegacy = allSettings.currencies && Array.isArray(allSettings.currencies);

        if (isLegacy) {
            // Legacy: the whole object IS the settings for the active year
            return { success: true, data: allSettings, activeYear };
        }

        // Versioned: keyed by year
        const yearSettings = allSettings[targetYear] || null;
        return { success: true, data: yearSettings, activeYear };

    } catch (error: any) {
        console.error("getFinanceSettings Error:", error);
        return { success: false, error: error.message };
    }
}

export async function saveFinanceSettings(
    matricule: string,
    settings: any,
    year?: string,
    executorName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { financeSettings: true, calendar: true }
        });

        if (!school) return { success: false, error: "École introuvable" };

        const calendar = JSON.parse(school.calendar || '{}');
        const activeYear = calendar.schoolYear;
        const targetYear = year || activeYear;

        if (!targetYear) return { success: false, error: "Année scolaire non définie." };

        let currentSettings = JSON.parse(school.financeSettings || '{}');

        // Check if legacy (flat) format
        const isLegacy = currentSettings.currencies && Array.isArray(currentSettings.currencies);

        if (isLegacy) {
            // Migrate to versioned format
            const migratedSettings: Record<string, any> = {};
            if (activeYear) {
                migratedSettings[activeYear] = currentSettings;
            }
            migratedSettings[targetYear] = settings;
            currentSettings = migratedSettings;
            console.log(`[Finance] Migrated Legacy settings to versioned for ${targetYear}`);
        } else {
            // Already versioned — update the specific year key
            currentSettings[targetYear] = settings;
        }

        await db.school.update({
            where: { matricule },
            data: { financeSettings: JSON.stringify(currentSettings) }
        });

        await logActivity(matricule, `Paramètres financiers mis à jour pour l'année ${targetYear}`, executorName || "Administrateur", "info");

        console.log(`[Finance] Settings saved for ${matricule} (Year: ${targetYear})`);
        return { success: true };

    } catch (error: any) {
        console.error("saveFinanceSettings Error:", error);
        return { success: false, error: "Impossible d'enregistrer les paramètres financiers." };
    }
}

export async function updateSchoolConfig(matricule: string, update: Record<string, any>): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { configuration: true }
        });

        if (!school) return { success: false, error: "École introuvable" };

        const currentConfig = JSON.parse(school.configuration || '{}');
        const newConfig = {
            ...currentConfig,
            ...update
        };

        await db.school.update({
            where: { matricule },
            data: { configuration: JSON.stringify(newConfig) }
        });

        revalidatePath("/setup");
        revalidatePath("/settings");
        return { success: true };
    } catch (error: any) {
        console.error("updateSchoolConfig Error:", error);
        return { success: false, error: "Impossible de mettre à jour la configuration." };
    }
}

export async function saveTimetable(matricule: string, timetables: any, year?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true, configuration: true }
        });

        if (!school) return { success: false, error: "École introuvable" };

        const activeCalendar = JSON.parse(school.calendar || "{}");
        const activeYear = activeCalendar.schoolYear;
        const targetYear = year || activeYear;

        if (targetYear === activeYear) {
            await db.school.update({
                where: { matricule },
                data: { timetables: JSON.stringify(timetables) }
            });
        } else {
            // Update in archives
            const config = JSON.parse(school.configuration || "{}");
            const archives = config.archivedCalendars || {};
            if (archives[targetYear]) {
                archives[targetYear].timetables = timetables;
                await db.school.update({
                    where: { matricule },
                    data: { configuration: JSON.stringify({ ...config, archivedCalendars: archives }) }
                });
            }
        }

        await logActivity(matricule, "L'emploi du temps a été mis à jour", "Administrateur", "info", targetYear);
        return { success: true };
    } catch (error: any) {
        console.error("saveTimetable Error:", error);
        return { success: false, error: "Impossible d'enregistrer l'horaire." };
    }
}

/**
 * Imports data from a source year to a target year (usually a Draft year)
 */
export async function importYearData(
    matricule: string, 
    sourceYear: string, 
    targetYear: string, 
    options: {
        structure?: boolean;
        finance?: boolean;
        staff?: boolean;
    },
    executorName?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            include: { teachers: true }
        });

        if (!school) return { success: false, error: "École introuvable" };

        const config = JSON.parse(school.configuration || "{}");
        const archives = config.archivedCalendars || {};
        const activeCalendar = JSON.parse(school.calendar || "{}");
        const activeYear = activeCalendar.schoolYear;

        // 1. Get Source Data
        let sourceData: any = {};
        if (sourceYear === activeYear) {
            sourceData = {
                calendar: activeCalendar,
                structure: JSON.parse(school.structure || "{}"),
                courses: JSON.parse(school.courses || "{}"),
                timeSlots: JSON.parse(school.timeSlots || "{}"),
                timetables: JSON.parse(school.timetables || "{}"),
                staffAssignments: (school.teachers || []).map((t: any) => ({
                    id: t.id,
                    staffNumber: t.staffNumber,
                    assignedClassroom: t.assignedClassroom,
                    assignedCourses: t.assignedCourses
                }))
            };
        } else {
            sourceData = archives[sourceYear];
            if (!sourceData) return { success: false, error: `Données de l'année source ${sourceYear} introuvables.` };
        }

        // 2. Get Target Data (must be in archives/draft)
        const targetData = archives[targetYear];
        if (!targetData && targetYear !== activeYear) {
            return { success: false, error: `L'année cible ${targetYear} n'est pas initialisée.` };
        }

        // 3. Perform Import Logic
        const updatedTarget = { ...(targetData || activeCalendar) };

        // Option A: Structure & Courses (often go together)
        if (options.structure) {
            updatedTarget.structure = sourceData.structure;
            updatedTarget.courses = sourceData.courses;
            updatedTarget.timeSlots = sourceData.timeSlots;
            updatedTarget.timetables = sourceData.timetables;
        }

        // Option B: Staff Assignments
        if (options.staff) {
            updatedTarget.staffAssignments = sourceData.staffAssignments;
        }

        // 4. Update Database
        if (targetYear === activeYear) {
            // This is rare but possible if admin wants to reset active year from an archive
            await db.school.update({
                where: { matricule },
                data: {
                    calendar: JSON.stringify(updatedTarget),
                    structure: JSON.stringify(updatedTarget.structure || "{}"),
                    courses: JSON.stringify(updatedTarget.courses || "{}"),
                    timetables: JSON.stringify(updatedTarget.timetables || "{}"),
                    timeSlots: JSON.stringify(updatedTarget.timeSlots || "{}")
                }
            });
        } else {
            const newArchives = { ...archives, [targetYear]: updatedTarget };
            await db.school.update({
                where: { matricule },
                data: {
                    configuration: JSON.stringify({ ...config, archivedCalendars: newArchives })
                }
            });
        }

        // Option C: Finance (Stored in separate column)
        if (options.finance) {
            const financeSettings = JSON.parse(school.financeSettings || "{}");
            const sourceFinance = financeSettings[sourceYear];
            if (sourceFinance) {
                financeSettings[targetYear] = sourceFinance;
                await db.school.update({
                    where: { matricule },
                    data: { financeSettings: JSON.stringify(financeSettings) }
                });
            }
        }

        await logActivity(
            matricule, 
            `Importation des données de ${sourceYear} vers ${targetYear} effectuée.`, 
            executorName || "Administrateur", 
            "info", 
            targetYear
        );

        return { success: true };
    } catch (error: any) {
        console.error("importYearData Error:", error);
        return { success: false, error: "Erreur lors de l'importation des données." };
    }
}
