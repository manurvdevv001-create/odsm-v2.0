"use server";

import { db } from "@/lib/db";

/**
 * Vérifie si la base de données est accessible.
 * Effectue une requête simple 'SELECT 1' pour tester la connexion.
 */
export async function checkDatabaseHealth() {
    try {
        // Tentative de requête simple
        await db.$queryRaw`SELECT 1`;
        return { 
            success: true, 
            status: "connected",
            message: "Base de données connectée." 
        };
    } catch (error: any) {
        console.error("[DB Health Check Failure]:", error);
        
        let errorType = "unknown";
        if (error.message?.includes("P2010") || error.message?.includes("database is locked")) {
            errorType = "locked";
        } else if (error.message?.includes("P1003") || error.message?.includes("does not exist")) {
            errorType = "not_found";
        }

        return { 
            success: false, 
            status: "disconnected",
            errorType,
            message: "La connexion à SQLite a échoué.",
            details: error.message
        };
    }
}

/**
 * Tente de forcer une reconnexion ou de vérifier l'état du fichier.
 */
export async function attemptDatabaseRepair() {
    try {
        // Force le checkpoint WAL pour libérer les verrous et synchroniser le fichier
        await db.$executeRawUnsafe('PRAGMA wal_checkpoint(FULL);');
        
        await db.$connect();
        const health = await checkDatabaseHealth();
        return health;
    } catch (error: any) {
        console.error("[DB Repair Failure]:", error);
        return { 
            success: false, 
            message: "Impossible de restaurer la connexion : " + error.message 
        };
    }
}
