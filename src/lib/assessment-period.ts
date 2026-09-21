export type PeriodState = "past" | "active" | "future" | "unknown";

export function getPeriodState(calendar: Record<string, any>, classroom: Record<string, any>, periodId: string, periodName?: string): PeriodState {
    const level = String(classroom.level || "").toLowerCase();
    const periods = level ? calendar?.[level]?.periods || [] : [];
    const period = periods.find((candidate: any) => candidate.id === periodId || candidate.name === periodId || candidate.name === periodName);
    if (!period) return "unknown";
    if (period.isActive) return "active";

    const today = new Date().toISOString().slice(0, 10);
    if (period.startDate && today < period.startDate) return "future";
    if (period.endDate && today > period.endDate) return "past";
    return "future";
}
