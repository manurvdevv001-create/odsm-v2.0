"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";

interface StandardizationInput {
    schoolYear: string;
    postCTEB: boolean;
}

export async function saveStandardization(matricule: string, config: StandardizationInput, executorName?: string) {
    try {
        const school = await db.school.findUnique({
            where: { matricule }
        });

        if (!school) {
            return { success: false, message: "École introuvable. Veuillez d'abord compléter l'étape 1." };
        }

        const currentConfig = JSON.parse(school.configuration || "{}");

        await db.school.update({
            where: { id: school.id },
            data: {
                calendar: JSON.stringify({
                    ...JSON.parse(school.calendar || "{}"),
                    schoolYear: config.schoolYear,
                }),
                configuration: JSON.stringify({
                    ...currentConfig,
                    setupStage: "STANDARDIZATION_COMPLETED",
                    postCTEB: config.postCTEB,
                }),
            },
        });

        await logActivity(matricule, `Normalisation de l'école effectuée (Année : ${config.schoolYear})`, executorName || "Administrateur", "info", config.schoolYear);

        revalidatePath("/setup");
        return { success: true };
    } catch (error: unknown) {
        console.error("Erreur de normalisation :", error);
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue.";
        return { success: false, message: `Erreur de base de données : ${errorMessage}` };
    }
}
