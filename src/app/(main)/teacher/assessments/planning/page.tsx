"use client";

import { useState } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Button } from "@/components/ui/button";
import { 
    Calendar as CalendarIcon, 
    Plus, 
    Clock, 
    BookOpen,
    ListTodo
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHelp } from "@/components/page-help";

export default function AssessmentPlanningPage() {
    const { user, schoolData } = useSchoolData();
    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId || "Général";

    const [plannedAssessments] = useState([
        { id: 1, title: "Calcul Mental", date: "2026-03-20", type: "Interro", course: "Mathématiques" },
        { id: 2, title: "Dictée de mots", date: "2026-03-22", type: "Devoir", course: "Français" },
    ]);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                        Planification des Épreuves
                        <PageHelp pageId="planning" />
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">Préparez vos prochaines évaluations</p>
                </div>
                <button className="gradient-btn gap-2 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center cursor-pointer">
                    <Plus className="h-4 w-4" />
                    Planifier
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Calendar Placeholder */}
                <div className="glass-card md:col-span-1 p-0 overflow-hidden">
                    <div className="px-5 py-4 tonal-surface-raised">
                        <h3 className="font-extrabold text-sm flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-primary" />
                            Calendrier
                        </h3>
                    </div>
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-20 px-5">
                        <CalendarIcon className="h-20 w-20 mb-4" />
                        <p className="text-sm font-bold">Vue Calendrier bientôt disponible</p>
                    </div>
                </div>

                {/* List View */}
                <div className="glass-card md:col-span-2 p-0 overflow-hidden">
                    <div className="px-5 py-4 tonal-surface-raised flex flex-row items-center justify-between">
                        <div>
                            <h3 className="font-extrabold text-sm flex items-center gap-2">
                                <ListTodo className="h-4 w-4 text-primary" />
                                Épreuves prévues
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Local : {assignedClassroomName || "Général"}</p>
                        </div>
                    </div>
                    <div className="space-y-0">
                        {plannedAssessments.map((a) => (
                            <div key={a.id} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{a.title}</span>
                                        <Badge className="text-[10px] uppercase bg-muted text-muted-foreground border-none font-extrabold">{a.type}</Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {a.course}</span>
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(a.date).toLocaleDateString('fr-FR')}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" className="rounded-xl text-xs">Modifier</Button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
