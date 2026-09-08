"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setSession } from "@/lib/auth";
import { checkLicense } from "@/lib/license-check";

export async function verifyLogin(
    matricule: string,
    passwordAttempt: string,
    username?: string,
    isTraditional: boolean = false
): Promise<{ success: boolean; error?: string; schoolName?: string; userName?: string; user?: Record<string, unknown> }> {

    console.log(`[verifyLogin] Tentative de connexion pour : ${matricule}, user: ${username}`);
    try {
        if (!matricule?.trim()) {
            return { success: false, error: "Le matricule est requis." };
        }

        if (!passwordAttempt?.trim()) {
            return { success: false, error: "Le mot de passe est requis." };
        }

        // Rechercher l'école par son matricule ODSM
        const school = await db.school.findUnique({
            where: { matricule: matricule.trim() },
        });

        console.log(`[verifyLogin] Ecole trouvée : ${school?.name || 'AUCUNE'}`);

        if (!school) {
            return {
                success: false,
                error: "Aucune école trouvée avec ce matricule.",
            };
        }

        // Helper for password comparison (supports both plain text and bcrypt)
        const comparePasswords = (attempt: string, stored: string) => {
            if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
                return bcrypt.compareSync(attempt, stored);
            }
            return attempt === stored;
        };

        // 1. Connexion Admin principal (pas de nom d'utilisateur)
        if (!username) {
            if (comparePasswords(passwordAttempt, school.password)) {
                // Vérifier la validité de la licence avant d'ouvrir la session
                const licenseStatus = await checkLicense(matricule.trim());
                if (!licenseStatus.isValid) {
                    return { success: false, error: licenseStatus.message || "Licence invalide. Contactez l'administration ODSM." };
                }

                await setSession({
                    userId: "admin",
                    matricule: school.matricule,
                    role: "ADMIN",
                    name: "Administrateur",
                });

                return {
                    success: true,
                    schoolName: school.name,
                    userName: "Administrateur",
                    user: { role: "ADMIN", name: "Administrateur" },
                };
            } else {
                return { success: false, error: "Mot de passe incorrect." };
            }
        }

        // 2. Connexion utilisateur (enseignant, secrétaire, etc.)
        interface AppUser {
            id: string;
            login: string;
            name: string;
            password: string;
            role: string;
            staffId?: string;
            twoFactorEnabled?: boolean;
            twoFactorSecret?: string;
            isSessionActive?: boolean;
            multipleSessionsEnabled?: boolean;
        }

        let users: AppUser[] = [];
        try {
            users = JSON.parse(school.users || "[]");
        } catch {
            users = [];
        }

        const user = users.find((u: AppUser) => u.login === username.trim());

        if (!user) {
            return { success: false, error: "Utilisateur non trouvé dans cette école." };
        }

        if (comparePasswords(passwordAttempt, user.password)) {
            // CHECK FOR MULTIPLE SESSIONS (If not enabled, block if already active)
            if (user.isSessionActive && !user.multipleSessionsEnabled && !isTraditional) {
                return { 
                    success: false, 
                    error: "Une session est déjà active sur un autre appareil. Veuillez vous déconnecter ou demander une clôture de session à l'administrateur." 
                };
            }

            // CHECK FOR 2FA (Skip if traditional/bypass mode)
            if (user.twoFactorEnabled && user.twoFactorSecret && !isTraditional) {
                return {
                    success: true,
                    requires2FA: true,
                    userId: user.id,
                    matricule: school.matricule,
                    userName: user.name,
                } as any;
            }

            // Record login session
            const userIndex = users.findIndex((u: AppUser) => u.id === user.id);
            if (userIndex !== -1) {
                (users[userIndex] as any).lastLoginAt = new Date().toISOString();
                (users[userIndex] as any).isSessionActive = true;
                await db.school.update({
                    where: { matricule: matricule.trim() },
                    data: { users: JSON.stringify(users) }
                });
            }

            // Fetch staff profile if it exists to provide level info
            let profile = null;
            if (user.staffId) {
                profile = await db.staffProfile.findUnique({
                    where: { id: user.staffId }
                });
            }

            // Vérifier la validité de la licence avant d'ouvrir la session
            const licenseStatus = await checkLicense(matricule.trim());
            if (!licenseStatus.isValid) {
                return { success: false, error: licenseStatus.message || "Licence invalide. Contactez l'administration ODSM." };
            }

            await setSession({
                userId: user.id,
                matricule: school.matricule,
                role: user.role,
                name: user.name,
                accessSchedule: (user as any).accessSchedule,
            });

            return {
                success: true,
                schoolName: school.name,
                userName: user.name,
                user: {
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    profile: profile,
                    sessionTimeoutMinutes: (user as any).sessionTimeoutMinutes ?? 30,
                    accessSchedule: (user as any).accessSchedule,
                },
            };
        } else {
            return { success: false, error: "Mot de passe utilisateur incorrect." };
        }
    } catch (error: unknown) {
        console.error("[verifyLogin] Erreur :", error);
        return {
            success: false,
            error: "Une erreur serveur est survenue.",
        };
    }
}

/**
 * Verify 2FA code and finalize login
 */
export async function verify2FAAction(
    matricule: string,
    userId: string,
    code: string
) {
    const { verify2FACode } = await import("@/lib/2fa");
    
    const school = await db.school.findUnique({
        where: { matricule },
    });

    if (!school) return { success: false, error: "École non trouvée." };

    let users = JSON.parse(school.users || "[]");
    const user = users.find((u: any) => u.id === userId);

    if (!user || !user.twoFactorSecret) {
        return { success: false, error: "Configuration 2FA invalide." };
    }

    // CHECK FOR MULTIPLE SESSIONS (Final check before session creation)
    if (user.isSessionActive && !user.multipleSessionsEnabled) {
        return { 
            success: false, 
            error: "Une session est déjà active sur un autre appareil." 
        };
    }

    const isValid = await verify2FACode(code, user.twoFactorSecret);

    if (isValid) {
        // Vérifier la validité de la licence avant d'ouvrir la session
        const licenseStatus = await checkLicense(matricule);
        if (!licenseStatus.isValid) {
            return { success: false, error: licenseStatus.message || "Licence invalide. Contactez l'administration ODSM." };
        }

        await setSession({
            userId: user.id,
            matricule: school.matricule,
            role: user.role,
            name: user.name,
            accessSchedule: user.accessSchedule,
        });

        // Fetch staff profile for the response
        let profile = null;
        if (user.staffId) {
            profile = await db.staffProfile.findUnique({
                where: { id: user.staffId }
            });
        }

        return {
            success: true,
            user: {
                id: user.id,
                name: user.name,
                role: user.role,
                profile: profile,
                accessSchedule: user.accessSchedule,
            }
        };
    } else {
        return { success: false, error: "Code invalide." };
    }
}

export async function logout() {
    const { deleteSession } = await import("@/lib/auth");
    await deleteSession();
}
