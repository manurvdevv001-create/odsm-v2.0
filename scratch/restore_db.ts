import { restoreBackup } from '../src/lib/backup';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

async function main() {
    console.log("=== RESTAURATION SÉCURISÉE DE LA BASE DE DONNÉES ODSM ===");
    
    const dbPath = path.resolve(process.cwd(), 'dev.db');
    const walPath = path.resolve(process.cwd(), 'dev.db-wal');
    const shmPath = path.resolve(process.cwd(), 'dev.db-shm');
    const backupDir = 'C:\\ODSM_Backups';
    
    // 1. Sauvegarder l'état corrompu actuel au cas où
    const timestamp = Date.now();
    const backupSubdir = path.join(backupDir, 'corrupted_snapshots', String(timestamp));
    fs.mkdirSync(backupSubdir, { recursive: true });
    
    console.log("Sauvegarde des fichiers corrompus dans :", backupSubdir);
    if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(backupSubdir, 'dev.db'));
        console.log("- dev.db sauvegardé.");
    }
    if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, path.join(backupSubdir, 'dev.db-wal'));
        console.log("- dev.db-wal sauvegardé.");
    }
    if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, path.join(backupSubdir, 'dev.db-shm'));
        console.log("- dev.db-shm sauvegardé.");
    }

    // 2. Supprimer les fichiers WAL et SHM existants pour éviter d'appliquer un journal corrompu
    console.log("Nettoyage des fichiers temporaires SQLite WAL/SHM...");
    try {
        if (fs.existsSync(walPath)) {
            fs.unlinkSync(walPath);
            console.log("✓ dev.db-wal supprimé.");
        }
        if (fs.existsSync(shmPath)) {
            fs.unlinkSync(shmPath);
            console.log("✓ dev.db-shm supprimé.");
        }
    } catch (e: any) {
        console.error("Impossible de supprimer les fichiers WAL/SHM (le serveur tourne peut-être encore):", e.message);
    }

    // 3. Choix du fichier de backup
    // On prend le backup de l'école le plus récent qui contient l'état sain
    const backupFile = "67AM3C_2026-05-16T21-52.odsm";
    console.log(`Tentative de restauration du fichier : ${backupFile}`);

    // Restauration via la clé d'école
    const result = await restoreBackup(backupFile, 'admin', '67AM3C');
    
    if (result.success) {
        console.log("✓ Restauration réussie du fichier principal dev.db !");
        
        // Supprimer à nouveau le WAL/SHM s'il a été recréé pendant l'opération
        try {
            if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
            if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        } catch {}

        // 4. Tester la connexion et la santé de la nouvelle base de données
        console.log("Test de santé de la nouvelle base de données...");
        try {
            const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
            const prisma = new PrismaClient({ adapter });
            await prisma.$connect();
            const schoolCount = await prisma.school.count();
            console.log(`✓ Base de données connectée. Nombre d'écoles : ${schoolCount}`);
            if (schoolCount > 0) {
                const school = await prisma.school.findFirst();
                console.log(`✓ Première école trouvée : ${school?.name} (Matricule: ${school?.matricule})`);
            }
            await prisma.$disconnect();
            console.log("=== TOUT EST RÉTABLI AVEC SUCCÈS ! ===");
        } catch (error: any) {
            console.error("❌ La restauration a réussi mais le test de lecture Prisma a échoué :", error.message);
        }
    } else {
        console.error("❌ Échec de la restauration :", result.error);
    }
}

main();
