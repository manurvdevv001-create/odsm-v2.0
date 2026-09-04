// src/constants/sections.ts

export interface SectionCategory {
    section_cat_id: number;
    section_cat_name: string;
    cycle_id: number;
}

export interface Section {
    section_id: number;
    section_name: string;
    section_cat_id: number;
}

export interface Option {
    option_id: number;
    specialty: string;
    section_id: number;
}

export interface Cycle {
    cycle_id: number;
    cycle_term: 'Long' | 'Court';
}

export const cycles: Cycle[] = [
    { cycle_id: 1, cycle_term: 'Long' },
    { cycle_id: 2, cycle_term: 'Court' }
];

export const sectionCategories: SectionCategory[] = [
    { section_cat_id: 1, section_cat_name: 'Générale', cycle_id: 1 },
    { section_cat_id: 2, section_cat_name: 'Pédagogique', cycle_id: 1 },
    { section_cat_id: 3, section_cat_name: 'Technique', cycle_id: 1 },
    { section_cat_id: 4, section_cat_name: 'Industrielle', cycle_id: 1 },
    { section_cat_id: 5, section_cat_name: 'Professionnel', cycle_id: 2 },
    { section_cat_id: 6, section_cat_name: 'Langues et Sciences Sociales', cycle_id: 1 }
];

export const sections: Section[] = [
    { section_id: 1, section_name: 'Littéraire', section_cat_id: 1 },
    { section_id: 2, section_name: 'Scientifique', section_cat_id: 1 },
    { section_id: 3, section_name: 'Pédagogique', section_cat_id: 2 },
    { section_id: 4, section_name: 'Commerciale', section_cat_id: 3 },
    { section_id: 5, section_name: 'Sociale', section_cat_id: 3 },
    { section_id: 6, section_name: 'Arts', section_cat_id: 3 },
    { section_id: 7, section_name: 'Coupe et Couture', section_cat_id: 3 },
    { section_id: 8, section_name: 'Hôtellerie', section_cat_id: 3 },
    { section_id: 9, section_name: 'Agricole', section_cat_id: 3 },
    { section_id: 10, section_name: 'Mécanique', section_cat_id: 4 },
    { section_id: 11, section_name: 'Électricité/Électronique', section_cat_id: 4 },
    { section_id: 12, section_name: 'Construction', section_cat_id: 4 },
    { section_id: 13, section_name: 'Chimie/Mines', section_cat_id: 4 },
    { section_id: 14, section_name: 'Autres spécialités', section_cat_id: 4 },
    { section_id: 15, section_name: 'Professionnelle', section_cat_id: 5 },
    { section_id: 16, section_name: 'Langues et Sciences Sociales', section_cat_id: 6 }
];

export const options: Option[] = [
    { option_id: 1, specialty: 'Latin-Philosophie', section_id: 1 },
    { option_id: 2, specialty: 'Latin-Grec', section_id: 1 },
    { option_id: 3, specialty: 'Latin-Mathématique', section_id: 1 },
    { option_id: 4, specialty: 'Sciences', section_id: 2 },
    { option_id: 5, specialty: 'Pédagogie générale', section_id: 3 },
    { option_id: 6, specialty: 'Éducation Physique et sportive', section_id: 3 },
    { option_id: 7, specialty: 'Normale', section_id: 3 },
    { option_id: 8, specialty: 'Pédagogie maternelle', section_id: 3 },
    { option_id: 9, specialty: 'Pédagogie pré-scolaire', section_id: 3 },
    { option_id: 10, specialty: 'Commerciale et gestion', section_id: 4 },
    { option_id: 11, specialty: 'Secrétariat-administration', section_id: 4 },
    { option_id: 12, specialty: 'Sociale', section_id: 5 },
    { option_id: 13, specialty: 'Art plastique', section_id: 6 },
    { option_id: 14, specialty: 'Art dramatique', section_id: 6 },
    { option_id: 15, specialty: 'Musique', section_id: 6 },
    { option_id: 16, specialty: 'Esthétique et coiffure', section_id: 6 },
    { option_id: 17, specialty: 'Coiffure', section_id: 6 },
    { option_id: 18, specialty: 'Coupe et couture', section_id: 7 },
    { option_id: 19, specialty: "Hôtesse d'accueil", section_id: 8 },
    { option_id: 20, specialty: 'Hôtellerie et restauration', section_id: 8 },
    { option_id: 21, specialty: 'Hébergement', section_id: 8 },
    { option_id: 22, specialty: 'Tourisme', section_id: 8 },
    { option_id: 23, specialty: 'Agriculture générale', section_id: 9 },
    { option_id: 24, specialty: 'Pêche et navigation', section_id: 9 },
    { option_id: 25, specialty: 'Vétérinaire', section_id: 9 },
    { option_id: 26, specialty: 'Industries agricoles', section_id: 9 },
    { option_id: 27, specialty: 'Nutrition', section_id: 9 },
    { option_id: 28, specialty: 'Foresterie', section_id: 9 },
    { option_id: 29, specialty: 'Mécanique générale', section_id: 10 },
    { option_id: 30, specialty: 'Mécanique machines-outils', section_id: 10 },
    { option_id: 31, specialty: 'Mécanique dessin', section_id: 10 },
    { option_id: 32, specialty: 'Hydro-pneumatique', section_id: 10 },
    { option_id: 33, specialty: 'Mécanique automobile', section_id: 10 },
    { option_id: 34, specialty: 'Construction métallique', section_id: 10 },
    { option_id: 35, specialty: 'Menuiserie', section_id: 10 },
    { option_id: 36, specialty: 'Électricité', section_id: 11 },
    { option_id: 37, specialty: 'Électronique industrielle', section_id: 11 },
    { option_id: 38, specialty: 'Commutation', section_id: 10 },
    { option_id: 39, specialty: 'Radio transmission', section_id: 11 },
    { option_id: 40, specialty: 'Construction', section_id: 12 },
    { option_id: 41, specialty: 'Dessin de bâtiment', section_id: 12 },
    { option_id: 42, specialty: 'Plomberie (installation sanitaire)', section_id: 12 },
    { option_id: 43, specialty: 'Chimie industrielle', section_id: 12 },
    { option_id: 44, specialty: 'Pétrochimie', section_id: 12 },
    { option_id: 45, specialty: 'Mine et géologie', section_id: 13 },
    { option_id: 46, specialty: 'Métallurgie', section_id: 13 },
    { option_id: 47, specialty: 'Mines et carrières', section_id: 13 },
    { option_id: 48, specialty: 'Géologie', section_id: 13 },
    { option_id: 49, specialty: 'Imprimerie', section_id: 14 },
    { option_id: 50, specialty: 'Météorologie', section_id: 14 },
    { option_id: 51, specialty: 'Aviation civile', section_id: 14 },
    { option_id: 52, specialty: 'Mécanique auto', section_id: 15 },
    { option_id: 53, specialty: 'Électricité', section_id: 15 },
    { option_id: 54, specialty: 'Techniques commerciales', section_id: 15 },
    { option_id: 55, specialty: 'Soins infirmiers', section_id: 15 },
    { option_id: 56, specialty: 'Accoucheuses', section_id: 15 },
    { option_id: 57, specialty: 'Coiffure', section_id: 15 },
    { option_id: 58, specialty: 'Esthétique et coiffure', section_id: 15 },
    { option_id: 59, specialty: 'Secourisme', section_id: 15 },
    { option_id: 60, specialty: 'Anglais', section_id: 16 },
    { option_id: 61, specialty: 'Français', section_id: 16 },
    { option_id: 62, specialty: 'Histoire-géographie', section_id: 16 },
    { option_id: 63, specialty: 'Géopolitique', section_id: 16 },
    { option_id: 64, specialty: 'Sciences politiques', section_id: 16 },
    { option_id: 65, specialty: 'Sociologie africaine', section_id: 16 },
    { option_id: 66, specialty: 'Droit', section_id: 16 }
];
