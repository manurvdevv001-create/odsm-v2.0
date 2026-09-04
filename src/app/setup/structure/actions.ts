"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface StructureInput {
    maternelle: boolean;
    primaire: boolean;
    secondaire: boolean;
}

export async function saveStructure(matricule: string, structure: StructureInput) {
    try {
        const school = await db.school.findUnique({
            where: { matricule }
        });

        if (!school) {
            return { success: false, message: "École introuvable. Veuillez d'abord compléter l'étape 1." };
        }

        const levels = {
            maternelle: structure.maternelle,
            primaire: structure.primaire,
            secondaire: structure.secondaire,
        };

        await db.school.update({
            where: { id: school.id },
            data: {
                levels: JSON.stringify(levels),
                configuration: JSON.stringify({
                    ...JSON.parse(school.configuration || "{}"),
                    setupStage: "STRUCTURE_COMPLETED",
                }),
            },
        });

        revalidatePath("/setup");
        return { success: true };
    } catch (error: unknown) {
        console.error("Erreur d'enregistrement de la structure :", error);
        const errorMessage = error instanceof Error ? error.message : "Erreur inconnue.";
        return { success: false, message: `Erreur de base de données : ${errorMessage}` };
    }
}
