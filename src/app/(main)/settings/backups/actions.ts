"use server";

import fs from 'fs';
import path from 'path';
import { createBackup, listBackupFiles, restoreBackup, BackupFileInfo } from '@/lib/backup';

/**
 * Runs a backup for the admin's school
 * The schoolMatricule and schoolName are passed from the client (from session context)
 */
export async function runAdminBackup(schoolMatricule: string, schoolName: string) {
    if (!schoolMatricule) {
        return { success: false, error: 'Matricule de l\'établissement requis.' };
    }

    try {
        const result = await createBackup('school', schoolMatricule, schoolName);
        return result;
    } catch (error: any) {
        console.error('[Admin Backup] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Lists backup files owned by the admin's school
 */
export async function listAdminBackups(schoolMatricule: string): Promise<{ success: boolean; files?: BackupFileInfo[]; error?: string }> {
    if (!schoolMatricule) {
        return { success: false, error: 'Matricule requis.' };
    }

    try {
        const files = listBackupFiles(schoolMatricule);
        return { success: true, files };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Restores a backup for the admin's school (ownership-restricted)
 */
export async function restoreAdminBackup(filename: string, schoolMatricule: string) {
    if (!filename || !schoolMatricule) {
        return { success: false, error: 'Données manquantes.' };
    }

    try {
        const result = await restoreBackup(filename, 'admin', schoolMatricule);
        return result;
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Gets the backup guide content
 */
export async function getBackupGuide() {
    const guidePath = path.join(process.cwd(), 'docs', 'BACKUP_GUIDE.md');

    try {
        if (fs.existsSync(guidePath)) {
            const content = fs.readFileSync(guidePath, 'utf8');
            return { success: true, content };
        }
        return { success: false, error: 'Guide introuvable' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
