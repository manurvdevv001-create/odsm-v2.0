'use server';

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { revalidatePath } from 'next/cache';

interface AppUser {
    id: string;
    staffId: string;
    name: string;
    login: string;
    password: string;
    role: string;
    isTitulaire: boolean;
    titulaireClassId?: string;
    // 2FA Security
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string;
    // Multiple Sessions
    multipleSessionsEnabled?: boolean;
    // Access Schedule
    accessSchedule?: {
        enabled: boolean;
        rules: { day: number; start: string; end: string }[];
    };
    createdAt: string;
    updatedAt?: string;
    lastLoginAt?: string;
    lastLogoutAt?: string;
    lastSessionDuration?: number;
    isSessionActive?: boolean;
    sessionTimeoutMinutes?: number;
}

/**
 * Get a single user by ID
 */
export async function getUserById(schoolId: string, userId: string): Promise<AppUser | null> {
    if (!schoolId || !userId) return null;
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });
        if (!school) return null;

        const users: AppUser[] = JSON.parse(school.users || '[]');
        return users.find(u => u.id === userId) || null;
    } catch (error) {
        console.error('[getUserById] Error:', error);
        return null;
    }
}

/**
 * Update user profile (without password)
 */
export async function updateUserProfile(
    schoolId: string,
    userId: string,
    data: {
        name?: string;
        login?: string;
        role?: string;
        isTitulaire?: boolean;
        titulaireClassId?: string;
        sessionTimeoutMinutes?: number;
        multipleSessionsEnabled?: boolean;
        accessSchedule?: any;
    }
): Promise<{ success: boolean; error?: string }> {
    if (!schoolId || !userId) return { success: false, error: 'Paramètres manquants' };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });
        if (!school) return { success: false, error: 'École non trouvée' };

        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: 'Utilisateur non trouvé' };

        // Check login uniqueness if changed
        if (data.login && data.login !== users[index].login) {
            if (users.find(u => u.login === data.login && u.id !== userId)) {
                return { success: false, error: "Ce nom d'utilisateur est déjà utilisé." };
            }
        }

        // Apply updates (excluding password)
        if (data.name !== undefined) users[index].name = data.name;
        if (data.login !== undefined) users[index].login = data.login;
        if (data.role !== undefined) users[index].role = data.role;
        if (data.isTitulaire !== undefined) users[index].isTitulaire = data.isTitulaire;
        if (data.titulaireClassId !== undefined) users[index].titulaireClassId = data.titulaireClassId;
        if (data.sessionTimeoutMinutes !== undefined) users[index].sessionTimeoutMinutes = data.sessionTimeoutMinutes;
        if (data.multipleSessionsEnabled !== undefined) users[index].multipleSessionsEnabled = data.multipleSessionsEnabled;
        if (data.accessSchedule !== undefined) users[index].accessSchedule = data.accessSchedule;
        users[index].updatedAt = new Date().toISOString();

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        // LOG ACTIVITY
        try {
            const { logActivity, formatLogEntity } = await import("@/lib/activity-logger");
            const targetUserName = formatLogEntity(data.name || users[index].name, userId);
            await logActivity(
                schoolId,
                `Mise à jour du profil de l'utilisateur : ${targetUserName}`,
                "Administrateur",
                "info",
                undefined,
                { userId, updatedFields: Object.keys(data) }
            );
        } catch (e) {}

        revalidatePath('/settings/users');
        revalidatePath(`/settings/users/${userId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[updateUserProfile] Error:', error);
        return { success: false, error: error.message || 'Une erreur est survenue.' };
    }
}

/**
 * Reset user password
 */
export async function resetUserPassword(
    schoolId: string,
    userId: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    if (!schoolId || !userId) return { success: false, error: 'Paramètres manquants' };
    if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Le mot de passe doit avoir au moins 6 caractères.' };
    }
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });
        if (!school) return { success: false, error: 'École non trouvée' };

        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: 'Utilisateur non trouvé' };

        users[index].password = await hashPassword(newPassword);
        users[index].updatedAt = new Date().toISOString();

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        // LOG ACTIVITY
        try {
            const { logActivity, formatLogEntity } = await import("@/lib/activity-logger");
            const targetUserName = formatLogEntity(users[index].name, userId);
            await logActivity(
                schoolId,
                `Réinitialisation du mot de passe de l'utilisateur : ${targetUserName}`,
                "Administrateur",
                "warning",
                undefined,
                { userId }
            );
        } catch (e) {}

        revalidatePath('/settings/users');
        revalidatePath(`/settings/users/${userId}`);
        return { success: true };
    } catch (error: any) {
        console.error('[resetUserPassword] Error:', error);
        return { success: false, error: error.message || 'Une erreur est survenue.' };
    }
}
