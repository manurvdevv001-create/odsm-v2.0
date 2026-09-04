// src/lib/post-cteb-nomenclature.ts
/**
 * Post CTEB Nomenclature System
 * 
 * Implements intelligent class naming for Post CTEB:
 * - Global sequential codes per grade (1A, 1B, 1C... across all options)
 * - Single-class options: no letter (e.g., "1ere Humanité - Latin-Philo")
 * - Multi-class options: with letters (e.g., "1ere Humanité - Sciences A", "...Sciences B")
 */

import type { ConfiguredOption } from '@/types/post-cteb-types';

export interface GradeClassInfo {
    optionId: string;
    optionName: string;
    sectionName: string;
    type: 'humanite' | 'professionnel';
    classId: string;
    grade: string;
    gradeNumber: number;
    classrooms: number;
    sequenceOrder: number;
}

/**
 * Collect all classes grouped by grade number
 */
function collectClassesByGrade(
    configuredOptions: ConfiguredOption[]
): Record<number, GradeClassInfo[]> {
    const byGrade: Record<number, GradeClassInfo[]> = {};

    configuredOptions.forEach((option, optionIndex) => {
        option.classes.forEach(cls => {
            if (!byGrade[cls.gradeNumber]) {
                byGrade[cls.gradeNumber] = [];
            }

            byGrade[cls.gradeNumber].push({
                optionId: option.id,
                optionName: option.optionName,
                sectionName: option.sectionName,
                type: option.type,
                classId: cls.id,
                grade: cls.grade,
                gradeNumber: cls.gradeNumber,
                classrooms: cls.classrooms,
                sequenceOrder: option.sequenceOrder ?? optionIndex,
            });
        });
    });

    return byGrade;
}

/**
 * Assign sequential global codes per grade
 * Grade 1: OPTION1 (3 classes), OPTION2 (2 classes) → 1A, 1B, 1C, 1D, 1E
 */
export function assignPostCTEBCodes(
    configuredOptions: ConfiguredOption[]
): Map<string, string[]> {
    const assignments = new Map<string, string[]>();
    const classesByGrade = collectClassesByGrade(configuredOptions);

    Object.entries(classesByGrade).forEach(([gradeNumStr, classes]) => {
        const sorted = classes.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        let letterIndex = 0;

        sorted.forEach(classInfo => {
            const codes: string[] = [];
            for (let i = 0; i < classInfo.classrooms; i++) {
                const letter = String.fromCharCode(65 + letterIndex);
                codes.push(`${gradeNumStr}${letter}`);
                letterIndex++;
            }
            assignments.set(classInfo.classId, codes);
        });
    });

    return assignments;
}

/**
 * Generate full class name for Post CTEB
 * Single classroom: "1ERE HUMANITÉ - LATIN-PHILOSOPHIE"
 * Multiple classrooms: "1ERE HUMANITÉ - SCIENCES A", "1ERE HUMANITÉ - SCIENCES B"
 */
export function getPostCTEBFullName(
    grade: string,
    optionName: string,
    code: string,
    totalClassesForOption: number
): string {
    if (totalClassesForOption === 1) {
        return `${grade} - ${optionName}`.toUpperCase();
    }
    const letter = code.slice(1);
    return `${grade} - ${optionName} ${letter}`.toUpperCase();
}

/**
 * Generate short class name for compact display
 */
export function getPostCTEBShortName(
    code: string,
    optionName: string,
    _totalClassesForOption: number
): string {
    const shortOption = optionName.length > 15
        ? optionName.substring(0, 12) + '...'
        : optionName;
    return `${code} - ${shortOption}`.toUpperCase();
}

/**
 * Reorder options and reassign codes
 */
export function reorderOptions(
    configuredOptions: ConfiguredOption[],
    newOrder: string[]
): ConfiguredOption[] {
    const optionsMap = new Map(
        configuredOptions.map(opt => [opt.id, opt])
    );

    const reordered: ConfiguredOption[] = [];
    newOrder.forEach((id, index) => {
        const option = optionsMap.get(id);
        if (option) {
            reordered.push({ ...option, sequenceOrder: index });
        }
    });

    return reordered;
}

/**
 * Validate Post CTEB configuration
 */
export function validatePostCTEBConfiguration(
    configuredOptions: ConfiguredOption[]
): string[] {
    const errors: string[] = [];
    const classesByGrade = collectClassesByGrade(configuredOptions);

    Object.entries(classesByGrade).forEach(([gradeNum, classes]) => {
        const totalClasses = classes.reduce((sum, cls) => sum + cls.classrooms, 0);
        if (totalClasses > 26) {
            errors.push(`Grade ${gradeNum}: ${totalClasses} classes configurées (maximum 26 - A à Z)`);
        }
    });

    configuredOptions.forEach(option => {
        option.classes.forEach(cls => {
            if (cls.classrooms <= 0) {
                errors.push(`${option.optionName} - ${cls.grade}: Nombre de locaux invalide (${cls.classrooms})`);
            }
        });
    });

    return errors;
}

/**
 * Nomenclature preview for UI display
 */
export interface NomenclaturePreview {
    grade: string;
    gradeNumber: number;
    classes: Array<{
        code: string;
        fullName: string;
        shortName: string;
        optionName: string;
    }>;
}

export function generateNomenclaturePreview(
    configuredOptions: ConfiguredOption[]
): NomenclaturePreview[] {
    const classesByGrade = collectClassesByGrade(configuredOptions);
    const codeAssignments = assignPostCTEBCodes(configuredOptions);
    const previews: NomenclaturePreview[] = [];

    Object.entries(classesByGrade).forEach(([gradeNumStr, classes]) => {
        const gradeNum = parseInt(gradeNumStr);
        const sorted = classes.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
        const gradeClasses: NomenclaturePreview['classes'] = [];

        sorted.forEach(classInfo => {
            const codes = codeAssignments.get(classInfo.classId) || [];
            codes.forEach(code => {
                gradeClasses.push({
                    code,
                    fullName: getPostCTEBFullName(classInfo.grade, classInfo.optionName, code, classInfo.classrooms),
                    shortName: getPostCTEBShortName(code, classInfo.optionName, classInfo.classrooms),
                    optionName: classInfo.optionName,
                });
            });
        });

        if (gradeClasses.length > 0) {
            previews.push({
                grade: sorted[0].grade,
                gradeNumber: gradeNum,
                classes: gradeClasses,
            });
        }
    });

    return previews.sort((a, b) => a.gradeNumber - b.gradeNumber);
}
