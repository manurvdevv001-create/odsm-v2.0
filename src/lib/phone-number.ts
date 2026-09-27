import { parsePhoneNumber } from "libphonenumber-js";

export type NormalizedPhone = {
    e164: string;
    international: string;
};

export function normalizePhoneNumber(input: string, defaultCountry: "CD" = "CD"): NormalizedPhone | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const internationalInput = trimmed.replace(/^00\s*/, "+");
    try {
        const parsed = parsePhoneNumber(internationalInput, defaultCountry);
        if (!parsed.isValid()) return null;
        return {
            e164: parsed.number,
            international: parsed.formatInternational(),
        };
    } catch {
        return null;
    }
}
