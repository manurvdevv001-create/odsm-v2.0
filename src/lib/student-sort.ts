/**
 * Utilitaires pour le tri et le formatage des listes d'élèves
 */

export type StudentSortOption = 'alpha-asc' | 'alpha-desc' | 'matricule-asc' | 'matricule-desc';

export interface BaseStudentInfo {
    id?: string;
    firstName?: string;
    lastName?: string;
    middleName?: string;
    postName?: string;
    matricule?: string;
    studentNumber?: string;
    name?: string; // pour les objets où le nom est déjà combiné
}

/**
 * Normalise une chaîne pour le tri (sans accents, minuscules)
 */
function normStr(str: string | null | undefined): string {
    if (!str) return '';
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Trie une liste d'élèves selon l'option choisie
 */
export function sortStudentList<T extends BaseStudentInfo>(
    students: T[],
    sortOption: StudentSortOption
): T[] {
    if (!students || students.length === 0) return [];

    return [...students].sort((a, b) => {
        const getStudentLastName = (s: T) => s.lastName || s.name || '';
        const getStudentFirstName = (s: T) => s.firstName || '';
        const getMatricule = (s: T) => s.matricule || s.studentNumber || '';

        switch (sortOption) {
            case 'alpha-asc': {
                const nameA = normStr(`${getStudentLastName(a)} ${getStudentFirstName(a)}`);
                const nameB = normStr(`${getStudentLastName(b)} ${getStudentFirstName(b)}`);
                return nameA.localeCompare(nameB, 'fr');
            }
            case 'alpha-desc': {
                const nameA = normStr(`${getStudentLastName(a)} ${getStudentFirstName(a)}`);
                const nameB = normStr(`${getStudentLastName(b)} ${getStudentFirstName(b)}`);
                return nameB.localeCompare(nameA, 'fr');
            }
            case 'matricule-asc': {
                const matA = getMatricule(a);
                const matB = getMatricule(b);
                return matA.localeCompare(matB, undefined, { numeric: true, sensitivity: 'base' });
            }
            case 'matricule-desc': {
                const matA = getMatricule(a);
                const matB = getMatricule(b);
                return matB.localeCompare(matA, undefined, { numeric: true, sensitivity: 'base' });
            }
            default:
                return 0;
        }
    });
}
