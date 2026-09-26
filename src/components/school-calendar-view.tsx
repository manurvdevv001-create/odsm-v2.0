"use client";

import { CalendarDays, ChevronDown, Clock, Palmtree, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { AcademicLevel, sortAcademicLevels } from "@/lib/calendar-access";

type Period = { id: string; name: string; type?: string; startDate?: string; endDate?: string; isActive?: boolean };
type CalendarItem = { id: string; name: string; date?: string; startDate?: string; endDate?: string; status?: "off" | "working"; appliesTo?: AcademicLevel[] };

type SchoolCalendarViewProps = {
    calendar: Record<string, any>;
    levels: AcademicLevel[];
    readOnly?: boolean;
};

const LEVEL_LABELS: Record<AcademicLevel, string> = {
    maternelle: "Maternelle",
    primaire: "Primaire",
    secondaire: "Secondaire",
};

function dateRange(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return "Dates non définies";
    if (startDate && endDate) return `Du ${formatDate(startDate)} au ${formatDate(endDate)}`;
    return formatDate(startDate || endDate || "");
}

export function SchoolCalendarView({ calendar, levels }: SchoolCalendarViewProps) {
    const orderedLevels = sortAcademicLevels(levels);
    const itemsForLevel = (items: CalendarItem[] | undefined, level: AcademicLevel) =>
        (items || []).filter(item => item.appliesTo?.includes(level));

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Calendrier scolaire</h1>
                    <p className="text-muted-foreground">Année scolaire {calendar.schoolYear || "non définie"}</p>
                </div>
                {orderedLevels.length > 0 && (
                    <Badge variant="secondary" className="uppercase tracking-widest">
                        {orderedLevels.map(level => LEVEL_LABELS[level]).join(" · ")}
                    </Badge>
                )}
            </div>

            {orderedLevels.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Aucun niveau académique n&apos;est associé à vos assignations.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="space-y-4">
                        {orderedLevels.map(level => (
                            <details key={level} open className="group rounded-2xl border bg-card shadow-sm">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-black [&::-webkit-details-marker]:hidden">
                                    <span>{LEVEL_LABELS[level]}</span>
                                    <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="grid gap-4 border-t p-4 md:grid-cols-2 xl:grid-cols-4">
                                    <CalendarSection title="Périodes pédagogiques" icon={<CalendarDays className="h-4 w-4" />} items={calendar[level]?.periods} periodItems />
                                    <CalendarSection title="Vacances scolaires" icon={<Palmtree className="h-4 w-4" />} items={itemsForLevel(calendar.vacations, level)} />
                                    <CalendarSection title="Jours spéciaux" icon={<CalendarDays className="h-4 w-4" />} items={itemsForLevel(calendar.specialDays, level)} dateOnly />
                                    <CalendarSection title="Délibérations" icon={<Clock className="h-4 w-4" />} items={itemsForLevel(calendar.bufferPeriods, level)} />
                                </div>
                            </details>
                        ))}
                    </div>

                    <details open className="group rounded-2xl border bg-card shadow-sm">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-lg font-black [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2"><Sun className="h-5 w-5" /> Jours fériés</span>
                            <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="border-t p-4">
                            <CalendarSection title="Commun à tous les niveaux" items={calendar.holidays} dateOnly />
                        </div>
                    </details>
                </>
            )}
        </div>
    );
}

function CalendarSection({ title, icon, items, dateOnly = false, periodItems = false }: {
    title: string;
    icon?: React.ReactNode;
    items?: (CalendarItem | Period)[];
    dateOnly?: boolean;
    periodItems?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-muted/20 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">{icon}{title}</div>
            <div className="space-y-2">
                {!items?.length ? <p className="text-xs text-muted-foreground">Aucun élément configuré.</p> : items.map(item => (
                    <div key={item.id} className="rounded-xl border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{item.name || "Sans nom"}</span>
                            {!periodItems && "status" in item && item.status && (
                                <Badge variant={item.status === "off" ? "destructive" : "secondary"}>
                                    {item.status === "off" ? "Chômé" : "Ouvré"}
                                </Badge>
                            )}
                            {periodItems && "isActive" in item && item.isActive && <Badge variant="default">Active</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {periodItems
                                ? dateRange(item.startDate, item.endDate)
                                : dateOnly
                                    ? dateRange((item as CalendarItem).date, undefined)
                                    : dateRange(item.startDate, item.endDate)}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
