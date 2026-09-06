// Re-generated after schema update - Force reload [2026-05-14T07:11] 🚀
import { PrismaClient } from '@prisma/client';
import path from 'path';

const prismaClientSingleton = () => {
    // 1. Mode CLOUD (Vercel/Netlify) : Si les identifiants Turso sont détectés
    const isCloud = process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL !== 'undefined' 
                 && process.env.TURSO_AUTH_TOKEN && process.env.TURSO_AUTH_TOKEN !== 'undefined';

    if (isCloud) {
        const { PrismaLibSql } = require('@prisma/adapter-libsql');
        
        // Prisma v7: adapter-libsql takes the config directly, not a client instance
        const adapter = new PrismaLibSql({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
        
        console.log('[ODSM DB] Connecté à Turso (Cloud SQLite) 🚀');
        return new PrismaClient({ adapter });
    } 
    // Sécurité : Sur Vercel/Netlify, on ne DOIT PAS utiliser le mode local
    if (process.env.NODE_ENV === 'production') {
        throw new Error("⚠️ VARIABLES D'ENVIRONNEMENT INVALIDES : TURSO_DATABASE_URL et/ou TURSO_AUTH_TOKEN sont manquantes ou égales à 'undefined' sur Netlify. Veuillez vérifier la configuration de votre site 'odsm-v2-test'.");
    }
    
    // 2. Mode LOCAL (Votre PC) : On garde better-sqlite3
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    let resolvedUrl = process.env.DATABASE_URL || 'file:./dev.db';
    
    if (resolvedUrl.startsWith('file:')) {
        const dbRelativePath = resolvedUrl.replace('file:', '');
        const absoluteDbPath = path.resolve(process.cwd(), dbRelativePath);
        resolvedUrl = `file:${absoluteDbPath.replace(/\\/g, '/')}`;
    }
    
    console.log('[ODSM DB] Connecté en Local:', resolvedUrl);
    const adapter = new PrismaBetterSqlite3({ url: resolvedUrl });
    return new PrismaClient({ adapter });
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const db = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = db
