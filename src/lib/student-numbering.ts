
import { db } from "@/lib/db";
import {
    StudentNumberingConfig,
    DEFAULT_STUDENT_NUMBERING,
    previewStudentNumber,
    NumberingPolicy
} from "./numbering-utils";

/**
 * Generates the next student number based on the school's policy for the given level.
 */
export async function generateStudentNumber(
    matricule: string,
    level: string = 'PRIMAIRE'
): Promise<{ success: boolean; studentNumber?: string; error?: string }> {
    try {
        return await db.$transaction(async (tx) => {
            const school = await tx.school.findUnique({
                where: { matricule },
                select: { configuration: true }
            });

            if (!school) throw new Error("École non trouvée");

            const config = JSON.parse(school.configuration || '{}');
            const numberingConfig: StudentNumberingConfig = config.studentNumbering || DEFAULT_STUDENT_NUMBERING;

            // Determine which policy to use based on mode
            let policy: NumberingPolicy = numberingConfig.default;
            const normalizedLevel = level.toLowerCase();
            const usePerLevel = numberingConfig.mode === 'per-level';

            if (usePerLevel) {
                if (normalizedLevel === 'maternelle' && numberingConfig.maternelle) {
                    policy = numberingConfig.maternelle;
                } else if (normalizedLevel === 'primaire' && numberingConfig.primaire) {
                    policy = numberingConfig.primaire;
                } else if ((normalizedLevel === 'secondaire' || normalizedLevel.includes('humanité') || normalizedLevel.includes('cteb')) && numberingConfig.secondaire) {
                    policy = numberingConfig.secondaire;
                }
            }

            // Extract active year from school config
            let activeYear: number | undefined;
            const activePeriod = config.activePeriod;
            if (activePeriod && typeof activePeriod === 'string') {
                const parts = activePeriod.split('-');
                if (parts.length > 0) {
                    const parsedYear = parseInt(parts[0], 10);
                    if (!isNaN(parsedYear)) {
                        activeYear = parsedYear;
                    }
                }
            }

            // Increment
            policy.currentSequence = (policy.currentSequence || policy.sequenceStart - 1) + 1;

            const schoolPrefix = matricule;
            const studentNumber = previewStudentNumber(policy, level, schoolPrefix, activeYear);

            // Save back to DB
            if (usePerLevel) {
                if (normalizedLevel === 'maternelle' && numberingConfig.maternelle) {
                    numberingConfig.maternelle = policy;
                } else if (normalizedLevel === 'primaire' && numberingConfig.primaire) {
                    numberingConfig.primaire = policy;
                } else if ((normalizedLevel.includes('secondaire') || normalizedLevel.includes('humanité') || normalizedLevel.includes('cteb')) && numberingConfig.secondaire) {
                    numberingConfig.secondaire = policy;
                } else {
                    numberingConfig.default = policy;
                }
            } else {
                numberingConfig.default = policy;
            }

            config.studentNumbering = numberingConfig;

            await tx.school.update({
                where: { matricule },
                data: { configuration: JSON.stringify(config) }
            });

            return { success: true, studentNumber };
        });

    } catch (error: any) {
        console.error("Error generating student number:", error);
        return { success: false, error: error.message };
    }
}
