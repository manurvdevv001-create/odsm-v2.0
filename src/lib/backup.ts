// src/lib/backup.ts
// Core backup & restore utilities for ODSM v2
// Uses Node.js native crypto for AES-256-CBC encryption of dev.db snapshots

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const BACKUP_DIR = 'C:\\ODSM_Backups';
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const ODSM_MAGIC = 'ODSM_BKP'; // 8-byte magic number to identify .odsm files
const FILE_VERSION = '2.0';

// Secret seeds for key derivation (combined with matricule/password for uniqueness)
const SCHOOL_SECRET = 'odsm-school-backup-secret-2025';
const GLOBAL_SECRET = 'odsm-global-backup-superadmin-2025';

export interface BackupHeader {
    magic: string;
    version: string;
    type: 'school' | 'global';
    matricule: string | null;   // null for global backups
    schoolName: string | null;
    timestamp: string;          // ISO date
    dbSizeBytes: number;
    salt: string;               // hex-encoded salt for key derivation
}

export interface BackupFileInfo {
    filename: string;
    type: 'school' | 'global';
    matricule: string | null;
    schoolName: string | null;
    timestamp: string;
    sizeBytes: number;
    dbSizeBytes: number;
}

/**
 * Ensures the backup directory exists
 */
function ensureBackupDir(): void {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Derives an encryption key from a seed (matricule or global secret)
 */
function deriveKey(seed: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(seed, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Gets the seed for key derivation based on backup type
 */
function getKeySeed(type: 'school' | 'global', matricule?: string): string {
    if (type === 'global') {
        return `${GLOBAL_SECRET}`;
    }
    return `${SCHOOL_SECRET}_${matricule}`;
}

/**
 * Gets the path to dev.db
 */
function getDbPath(): string {
    return path.join(process.cwd(), 'dev.db');
}

/**
 * Creates a backup of the database
 * 
 * @param type - 'school' for school-specific, 'global' for full system
 * @param matricule - Required for school backups, identifies the owner
 * @param schoolName - Display name of the school
 * @returns The filename of the created backup
 */
export async function createBackup(
    type: 'school' | 'global',
    matricule?: string,
    schoolName?: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
        ensureBackupDir();

        const dbPath = getDbPath();
        if (!fs.existsSync(dbPath)) {
            return { success: false, error: `Base de données introuvable: ${dbPath}` };
        }

        // Read the raw database file
        const dbData = fs.readFileSync(dbPath);

        // Compress the data
        const compressed = zlib.gzipSync(dbData, { level: 9 });

        // Generate salt and IV
        const salt = crypto.randomBytes(SALT_LENGTH);
        const iv = crypto.randomBytes(IV_LENGTH);

        // Derive key
        const keySeed = getKeySeed(type, matricule);
        const key = deriveKey(keySeed, salt);

        // Encrypt compressed data
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);

        // Build header
        const timestamp = new Date().toISOString();
        const header: BackupHeader = {
            magic: ODSM_MAGIC,
            version: FILE_VERSION,
            type,
            matricule: matricule || null,
            schoolName: schoolName || null,
            timestamp,
            dbSizeBytes: dbData.length,
            salt: salt.toString('hex'),
        };

        const headerJson = JSON.stringify(header);
        const headerBuf = Buffer.from(headerJson, 'utf-8');
        const headerLenBuf = Buffer.alloc(4);
        headerLenBuf.writeUInt32LE(headerBuf.length, 0);

        // Assemble file: [4 bytes header length][header JSON][16 bytes IV][encrypted data]
        const fileData = Buffer.concat([headerLenBuf, headerBuf, iv, encrypted]);

        // Generate filename
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        const prefix = type === 'global' ? 'ODSM_GLOBAL' : matricule;
        const filename = `${prefix}_${dateStr}.odsm`;

        const filePath = path.join(BACKUP_DIR, filename);
        fs.writeFileSync(filePath, fileData);

        return { success: true, filename };
    } catch (error: any) {
        console.error('[Backup] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Reads the header of a backup file without decrypting it
 */
export function readBackupHeader(filename: string): BackupHeader | null {
    try {
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) return null;

        const fd = fs.openSync(filePath, 'r');
        
        // Read header length (4 bytes)
        const lenBuf = Buffer.alloc(4);
        fs.readSync(fd, lenBuf, 0, 4, 0);
        const headerLen = lenBuf.readUInt32LE(0);

        // Read header
        const headerBuf = Buffer.alloc(headerLen);
        fs.readSync(fd, headerBuf, 0, headerLen, 4);
        fs.closeSync(fd);

        const header = JSON.parse(headerBuf.toString('utf-8')) as BackupHeader;
        
        if (header.magic !== ODSM_MAGIC) return null;
        
        return header;
    } catch {
        return null;
    }
}

/**
 * Lists all backup files, optionally filtered by matricule ownership
 */
export function listBackupFiles(ownerMatricule?: string): BackupFileInfo[] {
    try {
        ensureBackupDir();
        
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.odsm'))
            .sort((a, b) => b.localeCompare(a)); // newest first

        const results: BackupFileInfo[] = [];

        for (const filename of files) {
            const header = readBackupHeader(filename);
            if (!header) continue;

            // Ownership filter for admin users
            if (ownerMatricule) {
                // Admin can only see their own school's backups
                if (header.type === 'global') continue;
                if (header.matricule !== ownerMatricule) continue;
            }

            const filePath = path.join(BACKUP_DIR, filename);
            const stat = fs.statSync(filePath);

            results.push({
                filename,
                type: header.type,
                matricule: header.matricule,
                schoolName: header.schoolName,
                timestamp: header.timestamp,
                sizeBytes: stat.size,
                dbSizeBytes: header.dbSizeBytes,
            });
        }

        return results;
    } catch {
        return [];
    }
}

/**
 * Restores a backup file to the database
 * 
 * @param filename - The backup file to restore
 * @param requesterRole - 'superadmin' or 'admin'
 * @param requesterMatricule - The matricule of the requesting school (for admin role)
 */
export async function restoreBackup(
    filename: string,
    requesterRole: 'superadmin' | 'admin',
    requesterMatricule?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const filePath = path.join(BACKUP_DIR, filename);
        if (!fs.existsSync(filePath)) {
            return { success: false, error: 'Fichier de backup introuvable.' };
        }

        // Read full file
        const fileData = fs.readFileSync(filePath);

        // Parse header
        const headerLen = fileData.readUInt32LE(0);
        const headerJson = fileData.subarray(4, 4 + headerLen).toString('utf-8');
        const header = JSON.parse(headerJson) as BackupHeader;

        if (header.magic !== ODSM_MAGIC) {
            return { success: false, error: 'Fichier invalide : format non reconnu.' };
        }

        // Ownership verification
        if (requesterRole === 'admin') {
            if (!requesterMatricule) {
                return { success: false, error: 'Matricule de l\'établissement requis.' };
            }
            if (header.type === 'global') {
                return { success: false, error: 'Accès refusé : les sauvegardes globales sont réservées au superadmin.' };
            }
            if (header.matricule !== requesterMatricule) {
                return { 
                    success: false, 
                    error: `Accès refusé : ce fichier appartient à l'établissement ${header.matricule}. Vous ne pouvez restaurer que les sauvegardes de votre propre établissement.` 
                };
            }
        }

        // Determine decryption key
        const salt = Buffer.from(header.salt, 'hex');
        const keySeed = getKeySeed(header.type, header.matricule || undefined);
        const key = deriveKey(keySeed, salt);

        // Extract IV and encrypted data
        const dataOffset = 4 + headerLen;
        const iv = fileData.subarray(dataOffset, dataOffset + IV_LENGTH);
        const encrypted = fileData.subarray(dataOffset + IV_LENGTH);

        // Decrypt
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        let decrypted: Buffer;
        try {
            decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        } catch {
            return { success: false, error: 'Erreur de déchiffrement : fichier corrompu ou clé invalide.' };
        }

        // Decompress
        let dbData: Buffer;
        try {
            dbData = zlib.gunzipSync(decrypted);
        } catch {
            return { success: false, error: 'Erreur de décompression : fichier corrompu.' };
        }

        // Safety: create a pre-restore backup
        const preRestoreBackup = path.join(BACKUP_DIR, `PRE_RESTORE_${Date.now()}.db`);
        const dbPath = getDbPath();
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, preRestoreBackup);
        }

        // Write the restored database
        fs.writeFileSync(dbPath, dbData);

        return { success: true };
    } catch (error: any) {
        console.error('[Restore] Error:', error);
        return { success: false, error: `Erreur de restauration: ${error.message}` };
    }
}
