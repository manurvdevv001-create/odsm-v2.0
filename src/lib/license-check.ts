import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export interface LicenseStatus {
    isValid: boolean;
    license: any | null;
    restrictions: any | null;
    message?: string;
}

export async function checkLicense(matricule?: string): Promise<LicenseStatus> {
    try {
        let schoolMatricule = matricule;

        if (!schoolMatricule) {
            const session = await getSession();
            if (!session) {
                return { isValid: false, license: null, restrictions: null, message: "Non authentifié" };
            }
            schoolMatricule = session.matricule;
        }

        // Fetch the most recent license regardless of status
        const latestLicense = await db.license.findFirst({
            where: {
                schoolMatricule: schoolMatricule,
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        if (!latestLicense) {
            return {
                isValid: false,
                license: null,
                restrictions: null,
                message: "Aucune licence trouvée pour cet établissement. Veuillez contacter l'administration ODSM."
            };
        }

        const now = new Date();

        // Blocked: manually suspended by superadmin
        if (latestLicense.status === "SUSPENDED") {
            return {
                isValid: false,
                license: latestLicense,
                restrictions: null,
                message: "L'accès à cette application a été suspendu par l'administration ODSM. Veuillez les contacter pour régulariser votre situation."
            };
        }

        // Blocked: license already marked as expired in DB
        if (latestLicense.status === "EXPIRED") {
            return {
                isValid: false,
                license: latestLicense,
                restrictions: null,
                message: "Votre licence d'exploitation a expiré. Veuillez contacter l'administration ODSM pour renouveler votre licence."
            };
        }

        // Active license: check date validity
        if (latestLicense.status === "ACTIVE") {
            // License not yet started
            if (now < latestLicense.startDate) {
                return {
                    isValid: false,
                    license: latestLicense,
                    restrictions: null,
                    message: "Votre licence n'est pas encore active. Veuillez patienter ou contacter l'administration ODSM."
                };
            }

            // License has expired: auto-update status in DB
            if (now > latestLicense.endDate) {
                await db.license.update({
                    where: { id: latestLicense.id },
                    data: { status: "EXPIRED" }
                });
                return {
                    isValid: false,
                    license: latestLicense,
                    restrictions: null,
                    message: "Votre licence d'exploitation a expiré. Veuillez contacter l'administration ODSM pour renouveler votre licence."
                };
            }

            // License is valid
            let restrictions = {};
            try {
                restrictions = JSON.parse(latestLicense.restrictions || "{}");
            } catch (e) {
                console.error("Erreur parsing restrictions licence:", e);
            }

            return {
                isValid: true,
                license: latestLicense,
                restrictions,
            };
        }

        // Unknown status — block access
        return {
            isValid: false,
            license: latestLicense,
            restrictions: null,
            message: "Statut de licence invalide. Veuillez contacter l'administration ODSM."
        };

    } catch (error) {
        console.error("Erreur checkLicense:", error);
        return { isValid: false, license: null, restrictions: null, message: "Erreur système lors de la vérification de la licence." };
    }
}
