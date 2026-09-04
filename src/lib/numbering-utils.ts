
// SHARED TYPES
export interface NumberingPolicy {
    format: string;
    sequenceStart: number;
    currentSequence: number;
    resetYearly: boolean;
}

// STUDENT TYPES
export type NumberingToken = '{YY}' | '{YYYY}' | '{LEVEL}' | '{####}' | '{PREFIX}' | '{A}' | '{AA}';

export interface StudentNumberingConfig {
    mode: 'default' | 'per-level';
    default: NumberingPolicy;
    maternelle?: NumberingPolicy;
    primaire?: NumberingPolicy;
    secondaire?: NumberingPolicy;
}

export const DEFAULT_NUMBERING_POLICY: NumberingPolicy = {
    format: 'ST-{YY}-{####}',
    sequenceStart: 1,
    currentSequence: 0,
    resetYearly: true,
};

export const DEFAULT_STUDENT_NUMBERING: StudentNumberingConfig = {
    mode: 'default',
    default: DEFAULT_NUMBERING_POLICY,
    maternelle: { ...DEFAULT_NUMBERING_POLICY, format: 'MAT-{YY}-{####}' },
    primaire: { ...DEFAULT_NUMBERING_POLICY, format: 'PRI-{YY}-{####}' },
    secondaire: { ...DEFAULT_NUMBERING_POLICY, format: 'SEC-{YY}-{####}' }
};

// STAFF TYPES
export type StaffNumberingToken = '{YY}' | '{YYYY}' | '{CAT}' | '{####}' | '{PREFIX}' | '{A}' | '{AA}';

export interface StaffNumberingConfig {
    mode: 'default' | 'per-profile';
    default: NumberingPolicy;
    direction?: NumberingPolicy;
    enseignant?: NumberingPolicy;
    administratif?: NumberingPolicy;
    technique?: NumberingPolicy;
    autre?: NumberingPolicy;
    informaticien?: NumberingPolicy;
}

export const DEFAULT_STAFF_NUMBERING_POLICY: NumberingPolicy = {
    format: 'STF-{YY}-{####}',
    sequenceStart: 1,
    currentSequence: 0,
    resetYearly: false,
};

export const DEFAULT_STAFF_NUMBERING: StaffNumberingConfig = {
    mode: 'default',
    default: DEFAULT_STAFF_NUMBERING_POLICY,
    direction: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'DIR-{YY}-{####}' },
    enseignant: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'PRF-{YY}-{####}' },
    administratif: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'ADM-{YY}-{####}' },
    technique: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'TEC-{YY}-{####}' },
    autre: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'AUT-{YY}-{####}' },
    informaticien: { ...DEFAULT_STAFF_NUMBERING_POLICY, format: 'SYS-{YY}-{####}' }
};

// ─── PREVIEW / FORMAT UTILS (powered by token engine) ────────────────

import { generateFromFormat } from './token-engine';

export function previewStudentNumber(
    policy: NumberingPolicy,
    level: string = 'PRIMAIRE',
    schoolPrefix: string = 'ECO',
    activeYear?: number
): string {
    const nextSeq = (policy.currentSequence || 0) + 1;
    return generateFromFormat(policy.format, nextSeq, {
        level,
        prefix: schoolPrefix,
        activeYear: activeYear ?? new Date().getFullYear(),
    });
}

export function formatStaffNumber(
    format: string,
    sequence: number,
    category: string,
    schoolMatricule: string,
    year: number = new Date().getFullYear()
): string {
    return generateFromFormat(format, sequence, {
        activeYear: year,
        category,
        prefix: schoolMatricule,
    });
}

export function previewStaffNumber(policy: NumberingPolicy, category: string, schoolMatricule: string): string {
    return formatStaffNumber(policy.format, (policy.currentSequence || 0) + 1, category, schoolMatricule);
}
