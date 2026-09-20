"use client";

import { CalendarDays, Clock, Palmtree, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    const visibleItems = (items: CalendarItem[] | undefined) =>
        (items || []).filter(item => !item.appliesTo?.length || item.appliesTo.some(level => orderedLevels.includes(level)));

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Calendrier scolaire</h1>
                    <p className="text-muted-foreground">Année scolaire {calendar.schoolYear || "non définie"}</p>
                </div>
                <Badge variant="secondary" className="uppercase tracking-widest">
                    {orderedLevels.map(level => LEVEL_LABELS[level]).join(" · ")}
                </Badge>
            </div>

            {orderedLevels.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Aucun niveau académique n&apos;est associé à vos assignations.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                        {orderedLevels.map(level => (
                            <Card key={level}>
                                <CardHeader>
                                    <CardTitle>{LEVEL_LABELS[level]}</CardTitle>
                                    <CardDescription>Périodes pédagogiques</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(calendar[level]?.periods || []).map((period: Period) => (
                                        <div key={period.id} className="rounded-xl border p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold">{period.name}</span>
                                                {period.isActive && <Badge variant="default">Active</Badge>}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{dateRange(period.startDate, period.endDate)}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <CalendarItemsCard title="Jours fériés" icon={<Sun className="h-5 w-5" />} items={calendar.holidays} dateOnly />
                        <CalendarItemsCard title="Vacances scolaires" icon={<Palmtree className="h-5 w-5" />} items={visibleItems(calendar.vacations)} />
                        <CalendarItemsCard title="Jours spéciaux" icon={<CalendarDays className="h-5 w-5" />} items={visibleItems(calendar.specialDays)} dateOnly />
                        <CalendarItemsCard title="Délibérations" icon={<Clock className="h-5 w-5" />} items={visibleItems(calendar.bufferPeriods)} />
                    </div>
                </>
            )}
        </div>
    );
}

function CalendarItemsCard({ title, icon, items, dateOnly = false }: { title: string; icon: React.ReactNode; items?: CalendarItem[]; dateOnly?: boolean }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {!items?.length ? <p className="text-sm text-muted-foreground">Aucun élément configuré.</p> : items.map(item => (
                    <div key={item.id} className="rounded-xl border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{item.name || "Sans nom"}</span>
                            {item.status && <Badge variant={item.status === "off" ? "destructive" : "secondary"}>{item.status === "off" ? "Chômé" : "Ouvré"}</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{dateOnly ? dateRange(item.date, undefined) : dateRange(item.startDate, item.endDate)}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
