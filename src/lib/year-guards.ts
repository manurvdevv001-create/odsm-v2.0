import { db } from '@/lib/db';

export async function getActiveYearForSchool(matricule: string): Promise<string | null> {
    const school = await db.school.findUnique({ where: { matricule }, select: { calendar: true } });
    if (!school) return null;
    try {
        const calendar = JSON.parse(school.calendar || '{}');
        return calendar.schoolYear || null;
    } catch (e) {
        return null;
    }
}

export async function assertSchoolYearIsActive(matricule: string, yearToCheck: string | null | undefined) {
    const active = await getActiveYearForSchool(matricule);
    if (!active) throw new Error("Aucune année scolaire active configurée pour cette école.");
    if (!yearToCheck) throw new Error("Année scolaire non fournie.");
    if (yearToCheck !== active) throw new Error("Action interdite : cette opération ne peut être effectuée que pour l'année scolaire active.");
}

export async function assertStudentInActiveYear(matricule: string, studentId: string) {
    const active = await getActiveYearForSchool(matricule);
    if (!active) throw new Error("Aucune année scolaire active configurée pour cette école.");
    const student = await db.student.findUnique({ where: { id: studentId }, select: { schoolYear: true } });
    if (!student) throw new Error("Élève non trouvé !");
    if (!student.schoolYear) throw new Error("L'année scolaire de l'élève est indéterminée.");
    if (student.schoolYear !== active) throw new Error("Action interdite : cet élève appartient à une année scolaire archivée et ne peut pas être modifié/supprimé.");
}
