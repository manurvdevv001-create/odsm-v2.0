// src/types/post-cteb-types.ts

export interface OptionClass {
    id: string;
    grade: string;          // "1ère Humanité", "2ème Professionnelle", etc.
    gradeNumber: number;    // 1, 2, 3, 4
    code: string;           // Legacy field
    classrooms: number;     // Number of classrooms for this grade
    assignedCodes?: string[]; // Assigned codes after generation (e.g., ["1A", "1B"])
}

export interface ConfiguredOption {
    id: string;
    optionId: string;       // Unique identifier for the option (e.g., "1")
    optionName: string;     // Display name (e.g., "Latin-Philosophie")
    sectionName: string;    // Parent section (e.g., "Littéraire")
    type: 'humanite' | 'professionnel';
    classes: OptionClass[]; // 4 classes for humanité, 2 for professionnel
    sequenceOrder?: number; // Order for code assignment
}
