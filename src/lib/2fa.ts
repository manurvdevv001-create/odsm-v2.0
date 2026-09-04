import { generateSecret, generateURI, verify } from "otplib";
import qrcode from "qrcode";

/**
 * Generates a unique secret for a user
 */
export function generate2FASecret() {
    return generateSecret();
}

/**
 * Generates a QR Code URL for the user to scan
 * @param email User's email or login
 * @param schoolName Name of the school for display in Authenticator app
 * @param secret The user's 2FA secret
 */
export async function generateQRCode(email: string, schoolName: string, secret: string) {
    const otpauth = generateURI({
        issuer: `ODSM: ${schoolName}`,
        label: email,
        secret
    });
    return qrcode.toDataURL(otpauth);
}

/**
 * Verifies a TOTP code against a secret
 */
export async function verify2FACode(token: string, secret: string): Promise<boolean> {
    try {
        const result = await verify({ token, secret });
        // In otplib v13, verify can return a VerifyResult object { valid: boolean }
        // or a boolean directly depending on the strategy.
        // We must ensure we return a primitive boolean.
        if (typeof result === 'boolean') {
            return result;
        }
        return !!(result as any)?.valid;
    } catch (error) {
        console.error("[2FA] Verification error:", error);
        return false;
    }
}
