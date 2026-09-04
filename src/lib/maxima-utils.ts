/**
 * Logic for calculating course maxima based on the core "max" points
 * defined during course configuration (the "abusive" max, which is the 
 * maximum score for an ordinary period).
 */

export type PeriodType = 'normal' | 'exam' | 'extra' | 'buffer';

/**
 * Calculates the maximum score for a course in a given period or aggregation level.
 * 
 * @param baseMax The "max" score configured for a standard ordinary period.
 * @param type The type of period or level of aggregation.
 * @returns The calculated maximum score.
 */
export function calculateMaxPoints(baseMax: number, type: PeriodType | 'term' | 'annual'): number {
  switch (type) {
    case 'normal':
      return baseMax;
    case 'exam':
      return baseMax * 2;
    case 'term':
      // Trimestre or Semestre = (Ordinary1 + Ordinary2 + Exam) 
      // where Ordinary = baseMax and Exam = baseMax * 2
      // Total = baseMax + baseMax + (baseMax * 2) = 4 * baseMax
      return baseMax * 4;
    case 'annual':
      // Typically 300% for secondary if 2 semesters (4*2 = 8), 
      // but user said "Somme des trimestres/semestres".
      // Let's assume most schools have either 3 trimestres or 2 semestres.
      // This might need context of how many terms exist.
      // For now, let's provide a way to sum them.
      return baseMax * 4; // Placeholder for a single term; annual will sum these.
    case 'extra':
    case 'buffer':
      return 0; // Buffer/extra periods usually don't have course marks
    default:
      return baseMax;
  }
}

/**
 * Gets a human-readable label for the calculated max.
 */
export function getMaxLabel(type: PeriodType | 'term' | 'annual'): string {
  switch (type) {
    case 'normal': return "Période Ordinaire";
    case 'exam': return "Examen";
    case 'term': return "Total Trimestre/Semestre";
    case 'annual': return "Total Annuel";
    case 'buffer': return "Délibération";
    default: return type;
  }
}
