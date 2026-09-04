"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";

interface SchoolSetupData {
    name: string;
    address?: string;
    city?: string;
    province?: string;
    phone?: string;
    logo?: string;
    levels: Record<string, boolean>;
    classrooms: Record<string, Record<string, number>>;
    courses: Record<string, unknown[]>;
    timeSlots: Record<string, unknown>;
    postCTEB?: boolean;
    configuredOptions?: unknown[];
    qualitativeMentions?: Record<string, any>;
    finalDecisions?: Record<string, string[]>;
    uiSettings?: Record<string, any>;
}

export async function saveSchoolSetupData(matricule: string, data: SchoolSetupData, executorName?: string) {
    try {
        const school = await db.school.findUnique({
            where: { matricule }
        });
        if (!school) {
            return { success: false, error: "École introuvable." };
        }

        const existingConfig = JSON.parse(school.configuration || "{}");

        // License Validation
        const { checkLicense } = await import('@/lib/license-check');
        const licenseStatus = await checkLicense(matricule);
        if (licenseStatus.isValid && licenseStatus.restrictions) {
            const { maxClassesPerLevel, maxCoursesPerClassroom } = licenseStatus.restrictions;
            
            if (maxClassesPerLevel && data.classrooms) {
                for (const level of Object.keys(data.classrooms)) {
                    const levelLimit = maxClassesPerLevel[level.toUpperCase()];
                    if (levelLimit !== undefined && levelLimit !== null) {
                        const count = Array.isArray(data.classrooms[level]) ? data.classrooms[level].length : 0;
                        if (count > levelLimit) {
                            return { success: false, error: `La licence actuelle limite à ${levelLimit} le nombre de locaux pour le niveau ${level}.` };
                        }
                    }
                }
            }
            
            if (maxCoursesPerClassroom && data.courses) {
                for (const grade of Object.keys(data.courses)) {
                    const coursesArr = data.courses[grade] || [];
                    if (coursesArr.length > maxCoursesPerClassroom) {
                        return { success: false, error: `La licence actuelle limite à ${maxCoursesPerClassroom} le nombre de cours par local (Dépassement en classe de ${grade}).` };
                    }
                }
            }
        }

        await db.school.update({
            where: { id: school.id },
            data: {
                name: data.name,
                address: data.address || null,
                city: data.city || null,
                province: data.province || null,
                phone: data.phone || null,
                logo: data.logo || null,
                levels: JSON.stringify(data.levels),
                structure: JSON.stringify(data.classrooms),
                courses: JSON.stringify(data.courses),
                timeSlots: JSON.stringify(data.timeSlots),
                configuration: JSON.stringify({
                    ...existingConfig,
                    postCTEB: data.postCTEB || false,
                    configuredOptions: data.configuredOptions || [],
                    qualitativeMentions: data.qualitativeMentions || existingConfig.qualitativeMentions || {},
                    finalDecisions: data.finalDecisions || existingConfig.finalDecisions || {},
                    uiSettings: data.uiSettings || existingConfig.uiSettings || {}
                }),
            },
        });

        await logActivity(matricule, "Configuration de l'école mise à jour (Identité/Structure/Cours)", executorName || "Administrateur", "info");

        revalidatePath("/settings/school-setup");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error: unknown) {
        console.error("Error saving school setup:", error);
        const msg = error instanceof Error ? error.message : "Erreur inconnue.";
        return { success: false, error: msg };
    }
}

export async function getOfficialCourses(fileName: string) {
    try {
        const { readFile } = await import("fs/promises");
        const { join } = await import("path");

        const filePath = join(process.cwd(), "docs", "branches", `${fileName}.json`);
        const content = await readFile(filePath, "utf-8");
        const data = JSON.parse(content);

        return { success: true, data };
    } catch (error: unknown) {
        console.error("Error loading official courses:", error);
        return { success: false, error: `Fichier introuvable: ${fileName}.json` };
    }
}
