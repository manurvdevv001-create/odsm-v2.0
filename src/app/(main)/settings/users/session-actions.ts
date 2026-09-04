'use server';

import { db } from '@/lib/db';
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
    createdAt: string;
    updatedAt?: string;
    lastLoginAt?: string;
    lastLogoutAt?: string;
    lastSessionDuration?: number;
    isSessionActive?: boolean;
    sessionTimeoutMinutes?: number;
    multipleSessionsEnabled?: boolean;
}

/**
 * Record user login — sets lastLoginAt and isSessionActive
 */
export async function recordLogin(schoolId: string, userId: string): Promise<{ success: boolean; error?: string }> {
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

        users[index].lastLoginAt = new Date().toISOString();
        users[index].isSessionActive = true;

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        return { success: true };
    } catch (error: any) {
        console.error('[recordLogin] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Record user logout — sets lastLogoutAt, calculates duration, clears isSessionActive
 */
export async function recordLogout(schoolId: string, userId: string): Promise<{ success: boolean; error?: string }> {
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

        const now = new Date();
        const logoutTime = now.toISOString();
        const loginTime = users[index].lastLoginAt;

        let duration = 0;
        if (loginTime) {
            duration = Math.floor((now.getTime() - new Date(loginTime).getTime()) / 1000);
        }

        users[index].lastLogoutAt = logoutTime;
        users[index].lastSessionDuration = duration;
        users[index].isSessionActive = false;

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        return { success: true };
    } catch (error: any) {
        console.error('[recordLogout] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Force terminate a user's active session
 */
export async function forceTerminateSession(schoolId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!schoolId || !userId) return { success: false, error: 'Paramètres manquants' };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true, configuration: true }
        });
        if (!school) return { success: false, error: 'École non trouvée' };

        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return { success: false, error: 'Utilisateur non trouvé' };

        const now = new Date();
        const loginTime = users[index].lastLoginAt;
        let duration = 0;
        if (loginTime) {
            duration = Math.floor((now.getTime() - new Date(loginTime).getTime()) / 1000);
        }

        users[index].lastLogoutAt = now.toISOString();
        users[index].lastSessionDuration = duration;
        users[index].isSessionActive = false;

        // Add to forcedLogoutUserIds so the client-side can detect and force logout
        const config = JSON.parse(school.configuration || '{}');
        const forcedLogoutIds: string[] = config.forcedLogoutUserIds || [];
        if (!forcedLogoutIds.includes(userId)) {
            forcedLogoutIds.push(userId);
        }
        config.forcedLogoutUserIds = forcedLogoutIds;

        await db.school.update({
            where: { matricule: schoolId },
            data: {
                users: JSON.stringify(users),
                configuration: JSON.stringify(config)
            }
        });

        revalidatePath('/settings/users');
        return { success: true };
    } catch (error: any) {
        console.error('[forceTerminateSession] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Clear the forced logout flag for a user (called after forced logout is acknowledged)
 */
export async function clearForcedLogout(schoolId: string, userId: string): Promise<{ success: boolean }> {
    if (!schoolId || !userId) return { success: false };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { configuration: true }
        });
        if (!school) return { success: false };

        const config = JSON.parse(school.configuration || '{}');
        const forcedLogoutIds: string[] = config.forcedLogoutUserIds || [];
        config.forcedLogoutUserIds = forcedLogoutIds.filter((id: string) => id !== userId);

        await db.school.update({
            where: { matricule: schoolId },
            data: { configuration: JSON.stringify(config) }
        });

        return { success: true };
    } catch (error: any) {
        console.error('[clearForcedLogout] Error:', error);
        return { success: false };
    }
}
