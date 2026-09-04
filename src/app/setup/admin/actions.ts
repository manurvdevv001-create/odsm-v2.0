"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";

export async function createAdminAndFinalize(matricule: string, password: string) {
    try {
        const school = await db.school.findUnique({
            where: { matricule }
        });

        if (!school) {
            return { success: false, message: "École introuvable. Veuillez d'abord compléter l'étape 1." };
        }

        if (password.length < 6) {
            return { success: false, message: "Le mot de passe doit contenir au moins 6 caractères." };
        }

        const currentConfig = JSON.parse(school.configuration || "{}");

        // Mettre à jour le mot de passe et marquer la configuration comme terminée
        await db.school.update({
            where: { id: school.id },
            data: {
                password: password, // TODO: Hash le mot de passe en production
                configuration: JSON.stringify({
                    ...currentConfig,
                    setupStage: "COMPLETED",
                    setupCompletedAt: new Date().toISOString(),
                }),
            },
        });

        await logActivity(matricule, "Configuration initiale de l'école terminée et compte Administrateur créé.", "Administrateur", "success");

        revalidatePath("/setup");
        return { success: true, matricule: school.matricule };
    } catch (error: unknown) {
        console.error("Erreur de création du compte admin :", error);
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue.";
        return { success: false, message: `Erreur de base de données : ${errorMessage}` };
    }
}
