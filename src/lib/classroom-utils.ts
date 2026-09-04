/**
 * Classroom utility functions for generating classroom names
 * from school structure data.
 */

// Keys in structure[level] that are metadata, not grade names
export const STRUCTURE_META_KEYS = ['classrooms', 'options', 'postCTEB', 'config'];

/**
 * Résout le champ assignedClassroom d'un profil personnel en liste de références.
 * Le champ peut contenir : un nom simple, un UUID, ou une chaîne JSON
 * (tableau de noms ou d'UUID) selon la façon dont le profil a été enregistré.
 */
export function parseAssignedClassrooms(assignedClassroom: string | null | undefined): string[] {
    if (!assignedClassroom) return [];
    const raw = String(assignedClassroom).trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((v: any) => String(v)).filter(Boolean);
        }
        return [String(parsed)];
    } catch {
        return [raw];
    }
}

/**
 * Normalise une liste de références de classes (noms ou UUID) en noms de classes,
 * en résolvant les UUID via la liste des classes fournie.
 */
export function resolveClassroomNames(refs: string[], classrooms: { id: string; name: string }[]): string[] {
    const byId = new Map(classrooms.map(c => [c.id, c.name]));
    const names: string[] = [];
    for (const ref of refs) {
        const resolved = byId.get(ref) || ref;
        if (resolved && !names.includes(resolved)) names.push(resolved);
    }
    return names;
}

/**
 * Generates classroom names with A/B/C suffixes for multi-section grades.
 * e.g. count=1 → ["1ère"], count=3 → ["1ère A", "1ère B", "1ère C"]
 */
export function generateClassroomNames(className: string, count: number): string[] {
    if (!count || count <= 0) return [];
    if (count === 1) return [className];
    return Array.from({ length: count }, (_, i) =>
        `${className} ${String.fromCharCode(65 + i)}`
    );
}

/**
 * Returns all classroom names for a given school data object.
 * Handles maternelle, primaire, and secondaire (including Post CTEB).
 */
import { assignPostCTEBCodes, getPostCTEBFullName } from './post-cteb-nomenclature';

export function getAllClassrooms(schoolData: Record<string, unknown>): string[] {
    const classrooms: string[] = [];
    const levels = schoolData.levels as Record<string, boolean> | undefined;
    const structure = schoolData.structure as Record<string, Record<string, number>> | undefined;
    const config = schoolData.configuration as Record<string, any> | undefined;
    const configuredOptions = config?.configuredOptions as any[] | undefined;
    const postCTEB = config?.postCTEB as boolean | undefined;

    if (!levels || !structure) return classrooms;

    for (const level of ['maternelle', 'primaire', 'secondaire'] as const) {
        if (!levels[level]) continue;
        const levelStructure = structure[level];
        if (!levelStructure) continue;

        for (const [gradeName, count] of Object.entries(levelStructure)) {
            if (STRUCTURE_META_KEYS.includes(gradeName)) continue;
            if (typeof count === 'number' && count > 0) {
                classrooms.push(...generateClassroomNames(gradeName, count));
            }
        }
    }

    // Handle Post CTEB classrooms for secondaire
    if (postCTEB && configuredOptions && Array.isArray(configuredOptions)) {
        const assignments = assignPostCTEBCodes(configuredOptions);
        for (const option of configuredOptions) {
            if (option.classes && Array.isArray(option.classes)) {
                for (const cls of option.classes) {
                    const codes = assignments.get(cls.id) || [];
                    codes.forEach(code => {
                        classrooms.push(getPostCTEBFullName(cls.grade, option.optionName, code, cls.classrooms));
                    });
                }
            }
        }
    }

    return classrooms;
}

/**
 * Returns all grade names (unique) for a given school data object.
 * Optionally filters by level.
 */
export function getAllGrades(schoolData: Record<string, unknown>, targetLevel?: string): string[] {
    const grades: string[] = [];
    const levels = schoolData.levels as Record<string, boolean> | undefined;
    const structure = schoolData.structure as Record<string, Record<string, number>> | undefined;
    const config = schoolData.configuration as Record<string, any> | undefined;
    const configuredOptions = config?.configuredOptions as any[] | undefined;
    const postCTEB = config?.postCTEB as boolean | undefined;

    if (!levels || !structure) return grades;

    const levelsToIterate = targetLevel 
        ? [targetLevel] 
        : ['maternelle', 'primaire', 'secondaire'] as const;

    for (const level of levelsToIterate) {
        // If no targetLevel, only process enabled levels
        if (!targetLevel && !levels[level]) continue;
        
        const levelStructure = structure[level];
        if (!levelStructure) continue;

        for (const [gradeName, count] of Object.entries(levelStructure)) {
            if (STRUCTURE_META_KEYS.includes(gradeName)) continue;
            if (typeof count === 'number' && count > 0 && !grades.includes(gradeName)) {
                grades.push(gradeName);
            }
        }

        // Handle Post CTEB grades for secondary level
        if (level === 'secondaire' && postCTEB && configuredOptions && Array.isArray(configuredOptions)) {
            for (const option of configuredOptions) {
                if (option.classes && Array.isArray(option.classes)) {
                    for (const cls of option.classes) {
                        if (cls.grade && !grades.includes(cls.grade)) {
                            grades.push(cls.grade);
                        }
                    }
                }
            }
        }
    }

    return grades;
}

/**
 * Returns classroom names for a specific academic level.
 */
export function getClassroomsByLevel(level: string, schoolData: Record<string, unknown>): string[] {
    const classrooms: string[] = [];
    const structure = schoolData.structure as Record<string, Record<string, number>> | undefined;
    const config = schoolData.configuration as Record<string, any> | undefined;

    if (!structure) return classrooms;

    const levelStructureKey = Object.keys(structure).find(k => k.toLowerCase() === level.toLowerCase());
    const levelStructure = levelStructureKey ? structure[levelStructureKey] : undefined;
    if (!levelStructure) return classrooms;

    for (const [gradeName, count] of Object.entries(levelStructure)) {
        if (STRUCTURE_META_KEYS.includes(gradeName)) continue;
        if (typeof count === 'number' && count > 0) {
            classrooms.push(...generateClassroomNames(gradeName, count));
        }
    }

    // Handle Post CTEB for secondaire
    if (level === 'secondaire' && config) {
        const configuredOptions = config.configuredOptions as any[] | undefined;
        const postCTEB = config.postCTEB as boolean | undefined;
        if (postCTEB && configuredOptions && Array.isArray(configuredOptions)) {
            const assignments = assignPostCTEBCodes(configuredOptions);
            for (const option of configuredOptions) {
                if (option.classes && Array.isArray(option.classes)) {
                    for (const cls of option.classes) {
                        const codes = assignments.get(cls.id) || [];
                        codes.forEach(code => {
                            classrooms.push(getPostCTEBFullName(cls.grade, option.optionName, code, cls.classrooms));
                        });
                    }
                }
            }
        }
    }

    return classrooms;
}

const formatOrdinal = (label: string) => {
    const numMatch = label.match(/\d+/);
    if (!numMatch) return label.toUpperCase();
    const num = parseInt(numMatch[0], 10);
    if (num === 1) return "1ERE";
    return `${num}EME`;
};

/**
 * Maps UI classroom names (e.g., "7e CTEB A") to internal database course keys (e.g., "7EME EDUCATION DE BASE A").
 */
export function getCourseDBKeyMap(schoolData: Record<string, unknown>): Record<string, string> {
    const map: Record<string, string> = {};
    const structure = schoolData.structure as Record<string, Record<string, number>> | undefined;
    const config = schoolData.configuration as Record<string, any> | undefined;
    const levels = schoolData.levels as Record<string, boolean> | undefined;

    if (!structure || !levels) return map;

    for (const level of ['maternelle', 'primaire', 'secondaire'] as const) {
        if (!levels[level]) continue;
        const levelStructure = structure[level];
        if (!levelStructure) continue;

        for (const [gradeName, count] of Object.entries(levelStructure)) {
            if (STRUCTURE_META_KEYS.includes(gradeName)) continue;
            if (typeof count === 'number' && count > 0) {
                const uiNames = generateClassroomNames(gradeName, count);

                const parts = gradeName.split(" ");
                const nominal = parts[0];
                const ordinal = formatOrdinal(nominal);
                const rest = parts.slice(1).join(" ").toUpperCase();

                for (let i = 0; i < count; i++) {
                    const letter = count > 1 ? ` ${String.fromCharCode(65 + i)}` : "";
                    let longName = "";
                    if (gradeName.includes("CTEB")) {
                        longName = `${ordinal} EDUCATION DE BASE${letter}`;
                    } else {
                        longName = `${ordinal} ${rest}${letter}`;
                    }

                    const dbKey = longName.toUpperCase().replace(/\s+/g, " ").trim();
                    map[uiNames[i]] = dbKey;
                }
            }
        }
    }

    // Handled above. Post CTEB uses the exact same name for UI and DB.
    if (config?.postCTEB && config.configuredOptions) {
        const configuredOptions = config.configuredOptions as any[];
        const assignments = assignPostCTEBCodes(configuredOptions);

        for (const option of configuredOptions) {
            for (const cls of option.classes || []) {
                const codes = assignments.get(cls.id) || [];
                codes.forEach(code => {
                    const fullName = getPostCTEBFullName(cls.grade, option.optionName, code, cls.classrooms);
                    map[fullName] = fullName;
                });
            }
        }
    }

    return map;
}

/**
 * Compares two classroom names, handling formatting and naming convention differences.
 * e.g., "8e CTEB A" matches "8EME EDUCATION DE BASE A".
 */
export function classroomNamesMatch(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;

    // Robust normalization function
    const norm = (s: string) => s
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ')
        .replace(/e(me|re)/g, 'e') // Normalize 2eme/2ème/2e to 2e
        .replace(/1(ere|re)/g, '1e'); // Normalize 1ere/1ère to 1e

    const n1 = norm(name1);
    const n2 = norm(name2);

    // 1. Exact match after robust normalization
    if (n1 === n2) return true;

    // 2. Handle the CTEB format difference specifically
    const isCTEB = (s: string) => s.includes('cteb') || s.includes('education de base');
    if (isCTEB(n1) && isCTEB(n2)) {
        const getGradeNum = (s: string) => s.match(/^\d+/)?.[0] || '';
        const getLetter = (s: string) => s.match(/\s+([a-z])$/)?.[1] || '';
        return getGradeNum(n1) === getGradeNum(n2) && getLetter(n1) === getLetter(n2);
    }

    return false;
}

/**
 * Returns all secondary classroom names (CTEB and Post CTEB).
 */
export function getSecondaireClassNames(schoolData: Record<string, unknown>): string[] {
    return getClassroomsByLevel('secondaire', schoolData);
}

/**
 * Checks if a classroom belongs to the secondary level.
 */
export function isSecondaireClass(
    classroomName: string,
    schoolData: Record<string, unknown>
): boolean {
    const secondaryClasses = getClassroomsByLevel('secondaire', schoolData);
    return secondaryClasses.some(c => classroomNamesMatch(c, classroomName));
}

/**
 * Checks if a classroom belongs to the maternelle level.
 */
export function isMaternelleClass(
    classroomName: string,
    schoolData: Record<string, unknown>
): boolean {
    const maternelleClasses = getClassroomsByLevel('maternelle', schoolData);
    return maternelleClasses.some(c => classroomNamesMatch(c, classroomName));
}

/**
 * Récupère les noms des classes correspondant à un grade spécifique.
 * Gère le mapping spécial pour le CTEB au secondaire.
 */
export function getClassroomsByGrade(
    level: string,
    gradeName: string,
    schoolData: Record<string, unknown>
): string[] {
    const allClassrooms = getClassroomsByLevel(level, schoolData);
    if (!gradeName) return [];

    const normalizedGrade = gradeName.toUpperCase().trim();

    // Special handling for secondaire CTEB mapping
    if (level === 'secondaire' && (normalizedGrade.includes('CTEB') || normalizedGrade.startsWith('7E') || normalizedGrade.startsWith('8E'))) {
        const ctebMapping: Record<string, string> = {
            '7E CTEB': '7EME EDUCATION DE BASE',
            '8E CTEB': '8EME EDUCATION DE BASE',
            '7E': '7EME EDUCATION DE BASE',
            '8E': '8EME EDUCATION DE BASE'
        };

        const mappedGrade = ctebMapping[normalizedGrade] || normalizedGrade;

        return allClassrooms.filter(name => {
            const upperName = name.toUpperCase();
            return upperName.includes(mappedGrade) || upperName.includes(normalizedGrade);
        });
    }

    // For Maternelle and Primaire, we want to match the grade name more loosely but accurately.
    // Usually, gradeName is "1ère" or "1ère Année" etc.
    // We check if the classroom name starts with the grade name (case insensitive).
    return allClassrooms.filter(name => {
        const upperName = name.toUpperCase();

        // Try exact start match first
        if (upperName.startsWith(normalizedGrade)) return true;

        // Handle common variations (like "1ère" vs "1ERE")
        const simplifiedGrade = normalizedGrade.replace('È', 'E').replace('RE', '');
        const simplifiedName = upperName.replace('È', 'E').replace('RE', '');

        return simplifiedName.startsWith(simplifiedGrade);
    });
}

/**
 * Robust secondary level detector based on school data structure and naming conventions.
 */
export function isSecondaryClassroom(classroomName: string, schoolData: any): boolean {
    if (!classroomName) return false;
    
    const normalize = (str: string) => str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
    const normalizedName = normalize(classroomName);

    // 1. Check exact configuration from schoolData structure
    if (schoolData?.structure?.classrooms && Array.isArray(schoolData.structure.classrooms)) {
        const room = schoolData.structure.classrooms.find((c: any) => normalize(c.name) === normalizedName);
        if (room?.level) {
            const lvl = room.level.toLowerCase();
            return lvl.includes('secondaire') || lvl.includes('education de base') || lvl.includes('cteb') || lvl.includes('humanite');
        }
    }

    // 2. Check if it exists in the calculated secondary classes
    if (isSecondaireClass(classroomName, schoolData)) {
        return true;
    }

    // 3. Robust Keyword-based fallback
    const secondaryKeywords = [
        'cteb', 'humanite', 'secondaire', 'litter', 'scienti', 'commercial', 
        'pedagogi', 'techni', 'coupe', 'couture', 'bio', 'meca', 'elec',
        '7e ', '8e ', '7eme', '8eme', '7ème', '8ème', 'education de base'
    ];
    
    return secondaryKeywords.some(kw => normalizedName.includes(normalize(kw)));
}

/**
 * Robust maternelle level detector based on school data structure and naming conventions.
 */
export function isMaternelleClassroom(classroomName: string, schoolData: any): boolean {
    if (!classroomName) return false;
    
    const normalize = (str: string) => str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
    const normalizedName = normalize(classroomName);

    // 1. Check exact configuration from schoolData structure
    if (schoolData?.structure?.classrooms && Array.isArray(schoolData.structure.classrooms)) {
        const room = schoolData.structure.classrooms.find((c: any) => normalize(c.name) === normalizedName);
        if (room?.level) {
            const lvl = room.level.toLowerCase();
            return lvl.includes('maternelle');
        }
    }

    // 2. Check if it exists in the calculated maternelle classes
    if (isMaternelleClass(classroomName, schoolData)) {
        return true;
    }

    // 3. Robust Keyword-based fallback
    const maternelleKeywords = [
        'maternelle', 'accueil'
    ];
    
    return maternelleKeywords.some(kw => normalizedName.includes(normalize(kw)));
}

/**
 * Determines the academic level of a given classroom.
 * Returns 'maternelle', 'primaire', 'secondaire', or null if not found.
 */
export function getClassroomLevel(classroomName: string, schoolData: any): 'maternelle' | 'primaire' | 'secondaire' | null {
    if (!classroomName) return null;
    
    // Quick specific checks
    if (isSecondaryClassroom(classroomName, schoolData)) return 'secondaire';
    if (isMaternelleClassroom(classroomName, schoolData)) return 'maternelle';
    
    // Since it's not secondary and not maternelle, check if it's explicitly in primaire
    const primaireClasses = getClassroomsByLevel('primaire', schoolData);
    if (primaireClasses.some(c => classroomNamesMatch(c, classroomName))) {
        return 'primaire';
    }
    
    // Fallback heuristic: assume primaire if it has "e" or "ere" but not CTEB/secondaire keywords
    const normalize = (str: string) => str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
    const norm = normalize(classroomName);
    if (norm.match(/^\d+[a-z]*/) && !norm.includes('cteb') && !norm.includes('humanite')) {
        return 'primaire';
    }
    
    return null;
}
