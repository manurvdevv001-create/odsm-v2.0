export const STAFF_CATEGORIES = {
    DIRECTION: "Direction",
    ENSEIGNANT: "Personnel enseignant",
    ADMINISTRATIF_TECHNIQUE: "Administratif/Technique",
    SOUTIEN: "Soutien"
} as const;

export const STAFF_FUNCTIONS = {
    [STAFF_CATEGORIES.DIRECTION]: [
        "Chef d'établissement (directeur/préfet)",
        "Directeur de discipline",
        "Directeur d'internat"
    ],
    [STAFF_CATEGORIES.ENSEIGNANT]: [
        "Maître/Maîtresse (mat)",
        "Maître/Maîtresse (prim)",
        "Professeur (sec)",
        "Stagiaire (mat)",
        "Stagiaire (prim)",
        "Stagiaire (sec)",
        "Maître soutien/appui"
    ],
    [STAFF_CATEGORIES.ADMINISTRATIF_TECHNIQUE]: [
        "Secrétaires et rédacteurs",
        "Comptables et intendants",
        "Exploitants (pédagogiques/informatiques)",
        "Administrateur Général",
        "Informaticiens"
    ],
    [STAFF_CATEGORIES.SOUTIEN]: [
        "Chauffeurs, huissiers, sentinelles",
        "Ouvriers et maintenanciers",
        "Employés de bureau"
    ]
} as const;

// Mapping to System Roles (ODSM Permissions)
export const FUNCTION_TO_ROLE_MAP: Record<string, string> = {
    "Chef d'établissement (directeur/préfet)": "SUPERVISOR",
    "Directeur de discipline": "PREFET",
    "Directeur d'internat": "SUPERVISOR",
    "Maître/Maîtresse (mat)": "TEACHER",
    "Maître/Maîtresse (prim)": "TEACHER",
    "Professeur (sec)": "TEACHER",
    "Stagiaire (mat)": "TEACHER",
    "Stagiaire (prim)": "TEACHER",
    "Stagiaire (sec)": "TEACHER",
    "Maître soutien/appui": "TEACHER",
    "Secrétaires et rédacteurs": "SECRETARY",
    "Comptables et intendants": "CASHIER",
    "Exploitants (pédagogiques/informatiques)": "SECRETARY",
    "Administrateur Général": "ADMIN",
    "Informaticiens": "ADMIN_SYSTEM"
};
