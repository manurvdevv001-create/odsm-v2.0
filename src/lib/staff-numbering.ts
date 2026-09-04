import { db } from "@/lib/db";
import {
    StaffNumberingConfig,
    DEFAULT_STAFF_NUMBERING,
    formatStaffNumber,
    NumberingPolicy
} from "./numbering-utils";

function buildFormatRegex(format: string): RegExp {
    let pattern = "^" + format
        .replace(/{PREFIX}/g, "(.+)")
        .replace(/{YY}/g, "(\\d{2})")
        .replace(/{YYYY}/g, "(\\d{4})")
        .replace(/{CAT}/g, "(.{1,3})")
        .replace(/{####}/g, "(\\d+)")
        .replace(/{A}/g, "(.)")
        .replace(/{AA}/g, "(.{1,2})")
        .replace(/\|/g, "\\|")
        .replace(/\./g, "\\.")
        .replace(/\-/g, "\\-")
    + "$";
    return new RegExp(pattern);
}

async function seedSequenceFromDB(
    tx: any,
    schoolMatricule: string,
    policy: NumberingPolicy,
    policyKey: string,
    category: string,
    staffNumbering: StaffNumberingConfig,
    config: any
): Promise<number> {
    if ((policy.currentSequence || 0) > 0) {
        return policy.currentSequence;
    }

    const regex = buildFormatRegex(policy.format);
    const allStaff = await tx.staffProfile.findMany({
        where: { schoolMatricule },
        select: { staffNumber: true }
    });

    let maxSeq = 0;
    for (const s of allStaff) {
        if (!s.staffNumber) continue;
        const match = s.staffNumber.match(regex);
        if (match) {
            const seq = parseInt(match[match.length - 1], 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
    }

    policy.currentSequence = maxSeq;
    if (staffNumbering[policyKey as keyof StaffNumberingConfig]) {
        (staffNumbering[policyKey as keyof StaffNumberingConfig] as NumberingPolicy).currentSequence = maxSeq;
    } else {
        staffNumbering.default.currentSequence = maxSeq;
    }
    config.staffNumbering = staffNumbering;

    return maxSeq;
}

export async function generateStaffNumber(
    schoolMatricule: string,
    category: string,
    staffFunction?: string
): Promise<{ success: boolean; staffNumber?: string; error?: string }> {
    try {
        return await db.$transaction(async (tx) => {
            const school = await tx.school.findUnique({
                where: { matricule: schoolMatricule },
                select: { configuration: true }
            });

            if (!school) throw new Error("École non trouvée");

            const config = school.configuration ? JSON.parse(school.configuration) : {};
            const staffNumbering: StaffNumberingConfig = config.staffNumbering || JSON.parse(JSON.stringify(DEFAULT_STAFF_NUMBERING));

            let policyKey: keyof StaffNumberingConfig = 'default';

            // Mode 'per-profile' : résolution par catégorie/fonction
            // Mode 'default'     : toujours utiliser la politique universelle
            if (staffNumbering.mode === 'per-profile') {
                const catLower = category.toLowerCase();
                const funcLower = staffFunction ? staffFunction.toLowerCase() : '';

                if (funcLower.includes('informaticien') || funcLower.includes('système')) policyKey = 'informaticien';
                else if (catLower === 'direction' || catLower.includes('chef') || catLower.includes('préfet')) policyKey = 'direction';
                else if (catLower.includes('enseignant') || catLower.includes('prof') || catLower.includes('personnel enseignant')) policyKey = 'enseignant';
                else if (catLower.includes('administratif') || catLower.includes('admin')) policyKey = 'administratif';
                else if (catLower.includes('technique') || catLower.includes('ouvrier')) policyKey = 'technique';
                else if (catLower.includes('soutien')) policyKey = 'autre';
            }

            let policy = staffNumbering[policyKey] || staffNumbering.default;

            await seedSequenceFromDB(tx, schoolMatricule, policy, policyKey, category, staffNumbering, config);

            const nextSeq = (policy.currentSequence || 0) + 1;
            const staffNumber = formatStaffNumber(policy.format, nextSeq, category, schoolMatricule);

            policy.currentSequence = nextSeq;
            if (staffNumbering[policyKey]) {
                (staffNumbering[policyKey] as NumberingPolicy).currentSequence = nextSeq;
            } else {
                staffNumbering.default.currentSequence = nextSeq;
            }

            config.staffNumbering = staffNumbering;
            await tx.school.update({
                where: { matricule: schoolMatricule },
                data: { configuration: JSON.stringify(config) }
            });

            return { success: true, staffNumber };
        });
    } catch (error: any) {
        console.error("Error generating staff number:", error);
        return { success: false, error: error.message };
    }
}