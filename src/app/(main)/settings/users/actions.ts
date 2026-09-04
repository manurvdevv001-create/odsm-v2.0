'use server';

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { logActivity, formatLogEntity } from '@/lib/activity-logger';

export interface AppUser {
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
    // Session tracking
    lastLoginAt?: string;
    lastLogoutAt?: string;
    lastSessionDuration?: number; // in seconds
    isSessionActive?: boolean;
    // Inactivity timeout (minutes). 0 = never. Default: 30
    sessionTimeoutMinutes?: number;
    // 2FA Security
    twoFactorEnabled?: boolean;
    twoFactorSecret?: string;
    // Multiple Sessions
    multipleSessionsEnabled?: boolean;
    // Access Schedule
    accessSchedule?: {
        start: string; // HH:mm
        end: string;   // HH:mm
        days: number[]; // 0=Sunday, 1=Monday...
    };
}

/**
 * Initiates 2FA setup for a user
 */
export async function setup2FA(matricule: string, userId: string, email: string): Promise<{ success: boolean; qrCode?: string; secret?: string; error?: string }> {
    const { generate2FASecret, generateQRCode } = await import('@/lib/2fa');
    
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { name: true }
        });
        
        if (!school) return { success: false, error: "École non trouvée" };
        
        const secret = generate2FASecret();
        const qrCode = await generateQRCode(email, school.name, secret);
        
        return { success: true, qrCode, secret };
    } catch (e) {
        return { success: false, error: "Erreur lors de la génération du QR Code" };
    }
}

/**
 * Verifies and enables 2FA for a user
 */
export async function enable2FA(matricule: string, userId: string, secret: string, code: string): Promise<{ success: boolean; error?: string }> {
    const { verify2FACode } = await import('@/lib/2fa');
    
    try {
        const isValid = await verify2FACode(code, secret);
        if (!isValid) return { success: false, error: "Code de vérification invalide" };
        
        const school = await db.school.findUnique({
            where: { matricule },
            select: { users: true }
        });
        
        if (!school) return { success: false, error: "École non trouvée" };
        
        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);
        
        if (index === -1) return { success: false, error: "Utilisateur non trouvé" };
        
        users[index].twoFactorEnabled = true;
        users[index].twoFactorSecret = secret;
        
        await db.school.update({
            where: { matricule },
            data: { users: JSON.stringify(users) }
        });
        
        revalidatePath('/settings/users');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Erreur lors de l'activation du 2FA" };
    }
}

/**
 * Disables 2FA for a user
 */
export async function disable2FA(matricule: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { users: true }
        });
        
        if (!school) return { success: false, error: "École non trouvée" };
        
        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);
        
        if (index === -1) return { success: false, error: "Utilisateur non trouvé" };
        
        users[index].twoFactorEnabled = false;
        users[index].twoFactorSecret = undefined;
        
        await db.school.update({
            where: { matricule },
            data: { users: JSON.stringify(users) }
        });
        
        revalidatePath('/settings/users');
        return { success: true };
    } catch (e) {
        return { success: false, error: "Erreur lors de la désactivation du 2FA" };
    }
}

export async function getUsers(schoolId: string): Promise<AppUser[]> {
    if (!schoolId) return [];
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });
        if (!school) return [];
        return JSON.parse(school.users || '[]') as AppUser[];
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function createUser(schoolId: string, userData: any): Promise<{ success: boolean; error?: string; user?: AppUser }> {
    if (!schoolId) return { success: false, error: "Matricule manquant" };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });

        if (!school) return { success: false, error: "École non trouvée" };

        const users: AppUser[] = JSON.parse(school.users || '[]');

        // Check if login already exists
        if (users.find(u => u.login === userData.login)) {
            return { success: false, error: "Ce nom d'utilisateur est déjà utilisé." };
        }

        // Check if staff member already has a user account (1:1 relationship)
        if (users.find(u => u.staffId === userData.staffId)) {
            return { success: false, error: "Ce membre du personnel a déjà un compte utilisateur." };
        }

        const hashedPassword = await hashPassword(userData.password);

        const newUser: AppUser = {
            id: randomUUID(),
            staffId: userData.staffId,
            name: userData.name,
            login: userData.login,
            password: hashedPassword,
            role: userData.role,
            isTitulaire: userData.isTitulaire || false,
            titulaireClassId: userData.titulaireClassId,
            multipleSessionsEnabled: false,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        revalidatePath('/settings/users');
        await logActivity(schoolId, `Nouveau compte utilisateur créé : ${newUser.name} (${newUser.login}) - Rôle: ${newUser.role}`, 'Administrateur', 'success', undefined, { userId: newUser.id, role: newUser.role });
        return { success: true, user: newUser };
    } catch (error: any) {
        console.error("Error creating user:", error);
        return { success: false, error: error.message || "Une erreur est survenue." };
    }
}

export async function updateUser(schoolId: string, userId: string, userData: any): Promise<{ success: boolean; error?: string; user?: AppUser }> {
    if (!schoolId) return { success: false, error: "Matricule manquant" };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });

        if (!school) return { success: false, error: "École non trouvée" };

        const users: AppUser[] = JSON.parse(school.users || '[]');
        const index = users.findIndex(u => u.id === userId);

        if (index === -1) return { success: false, error: "Utilisateur non trouvé" };

        const updatedUser: AppUser = { ...users[index], ...userData };

        if (userData.password && userData.password.length > 0) {
            updatedUser.password = await hashPassword(userData.password);
        }

        updatedUser.updatedAt = new Date().toISOString();
        users[index] = updatedUser;

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(users) }
        });

        revalidatePath('/settings/users');
        await logActivity(schoolId, `Compte utilisateur modifié : ${updatedUser.name} (${updatedUser.login})`, 'Administrateur', 'info', undefined, { userId, updatedFields: Object.keys(userData) });
        return { success: true, user: updatedUser };
    } catch (error: any) {
        console.error("Error updating user:", error);
        return { success: false, error: error.message || "Une erreur est survenue." };
    }
}

export async function deleteUser(schoolId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    if (!schoolId) return { success: false, error: "Matricule manquant" };
    try {
        const school = await db.school.findUnique({
            where: { matricule: schoolId },
            select: { users: true }
        });

        if (!school) return { success: false, error: "École non trouvée" };

        const users: AppUser[] = JSON.parse(school.users || '[]');
        const deletedUser = users.find(u => u.id === userId);
        const filteredUsers = users.filter(u => u.id !== userId);

        if (users.length === filteredUsers.length) return { success: false, error: "Utilisateur non trouvé" };

        await db.school.update({
            where: { matricule: schoolId },
            data: { users: JSON.stringify(filteredUsers) }
        });

        revalidatePath('/settings/users');
        if (deletedUser) {
            await logActivity(schoolId, `Compte utilisateur supprimé : ${deletedUser.name} (${deletedUser.login})`, 'Administrateur', 'warning', undefined, { userId, role: deletedUser.role });
        }
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, error: error.message || "Une erreur est survenue." };
    }
}

export async function updateUserManagementConfig(matricule: string, config: { useStaffNumberAsLogin: boolean; resetUsers?: boolean }): Promise<{ success: boolean; error?: string }> {
    if (!matricule) return { success: false, error: "Matricule manquant" };
    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { configuration: true, users: true }
        });

        if (!school) return { success: false, error: "École non trouvée" };

        const currentConfig = JSON.parse(school.configuration || '{}');

        const newConfig = {
            ...currentConfig,
            userManagement: {
                ...currentConfig.userManagement,
                useStaffNumberAsLogin: config.useStaffNumberAsLogin
            }
        };

        const updateData: any = {
            configuration: JSON.stringify(newConfig)
        };

        if (config.resetUsers) {
            updateData.users = "[]";
        }

        await db.school.update({
            where: { matricule },
            data: updateData
        });

        revalidatePath('/settings/users');
        return { success: true };
    } catch (error: any) {
        console.error("Error updating user management config:", error);
        return { success: false, error: error.message || "Erreur lors de la mise à jour de la configuration." };
    }
}
