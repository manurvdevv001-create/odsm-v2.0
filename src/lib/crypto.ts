import bcrypt from 'bcryptjs';

// In production, this key should be in an environment variable (.env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'odsm-local-secret-key-32-chars-long!!!';
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // GCM standard IV length

/**
 * Helper to get the crypto key from the secret string
 */
async function getCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    return crypto.subtle.importKey(
        'raw',
        keyData,
        ALGORITHM,
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Hashes a password (irreversible)
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}

/**
 * Verifies a password against its hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Encrypts a string (reversible with key)
 * Works in both Node.js and Edge Runtime
 */
export async function encrypt(text: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await getCryptoKey();
    const encoder = new TextEncoder();
    
    const encrypted = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        key,
        encoder.encode(text)
    );

    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);

    // Using base64 for cleaner storage in cookies
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a string
 * Works in both Node.js and Edge Runtime
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
    try {
        const combined = new Uint8Array(
            atob(encryptedBase64).split('').map(char => char.charCodeAt(0))
        );
        
        const iv = combined.slice(0, IV_LENGTH);
        const data = combined.slice(IV_LENGTH);
        const key = await getCryptoKey();

        const decrypted = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (e) {
        console.error("Decryption failed:", e);
        return ""; 
    }
}
