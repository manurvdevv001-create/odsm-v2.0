
import { cookies } from "next/headers";
import { encrypt, decrypt } from "./crypto";

const SESSION_COOKIE_NAME = "odsm_session";
const SESSION_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionData {
    userId: string;
    matricule: string;
    role: string;
    name: string;
    expiresAt: number;
    accessSchedule?: {
        start: string;
        end: string;
        days: number[];
    };
}

/**
 * Creates and sets a secure HTTP-only session cookie
 */
export async function setSession(data: Omit<SessionData, "expiresAt">) {
    const expiresAt = Date.now() + SESSION_EXPIRY * 1000;
    const sessionData: SessionData = { ...data, expiresAt };
    
    const encryptedSession = await encrypt(JSON.stringify(sessionData));
    
    (await cookies()).set(SESSION_COOKIE_NAME, encryptedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
    });
}

/**
 * Retrieves and decrypts the session from the cookie
 */
export async function getSession(): Promise<SessionData | null> {
    const cookieStore = await cookies();
    
    // Check for superadmin impersonation
    const impersonationCookie = cookieStore.get("impersonated_matricule");
    if (impersonationCookie) {
        return {
            userId: "superadmin-impersonation",
            matricule: impersonationCookie.value,
            role: "ADMIN",
            name: "Superadmin (Impersonation)",
            expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour buffer
        };
    }

    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    
    if (!sessionCookie) return null;
    
    try {
        const decrypted = await decrypt(sessionCookie.value);
        const session = JSON.parse(decrypted) as SessionData;
        
        if (Date.now() > session.expiresAt) {
            await deleteSession();
            return null;
        }
        
        return session;
    } catch (error) {
        console.error("Session verification failed:", error);
        return null;
    }
}

/**
 * Deletes the session cookie (logout)
 */
export async function deleteSession() {
    (await cookies()).delete(SESSION_COOKIE_NAME);
    (await cookies()).delete("impersonated_matricule");
}

/**
 * Server-side check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const session = await getSession();
    return !!session;
}
