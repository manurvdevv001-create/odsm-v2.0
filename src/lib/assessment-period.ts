export type PeriodState = "past" | "active" | "future" | "unknown";

export function getPeriodState(calendar: Record<string, any>, classroom: Record<string, any>, periodId: string, periodName?: string): PeriodState {
    const level = String(classroom?.level || "").toLowerCase();
    const periods = level ? calendar?.[level]?.periods || [] : [];
    let period = periods.find((candidate: any) => candidate.id === periodId || candidate.name === periodId || candidate.name === periodName);

    // Fallback: if not found under classroom.level, search across all academic levels in calendar
    if (!period && calendar) {
        for (const l of ['primaire', 'secondaire', 'maternelle']) {
            if (l === level) continue;
            const fallbackPeriods = calendar?.[l]?.periods || [];
            const found = fallbackPeriods.find((candidate: any) => candidate.id === periodId || candidate.name === periodId || candidate.name === periodName);
            if (found) {
                period = found;
                break;
            }
        }
    }

    if (!period) return "unknown";
    if (period.isActive) return "active";

    const today = new Date().toISOString().slice(0, 10);
    if (period.startDate && today < period.startDate) return "future";
    if (period.endDate && today > period.endDate) return "past";
    return "future";
}
