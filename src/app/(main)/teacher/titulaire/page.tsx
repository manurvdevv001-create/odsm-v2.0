"use client";

import { useEffect, useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Users, 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    BookOpen, 
    Loader2,
    BarChart3,
    Send,
    Lock,
    FileSpreadsheet,
    ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHelp } from "@/components/page-help";

export default function TitulairePage() {
    const { schoolData, user, isLoading } = useSchoolData();
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isPeriodClosed, setIsPeriodClosed] = useState(false);

    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = useMemo(() => {
        if (!rawClassroomId) return "";
        return (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId;
    }, [rawClassroomId, schoolData]);
    
    const level = user?.profile?.level?.toLowerCase() || "";
    const isSecondary = level === "secondaire";

    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    const periods = useMemo(() => {
        // Resolve the true calendar level from the assigned classroom name
        // to avoid mixing primaire/maternelle calendars when the profile level
        // is the combined string "primaire/maternelle".
        let calLevel = level;
        if (assignedClassroomName) {
            const cn = assignedClassroomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cn.includes("maternelle")) calLevel = "maternelle";
            else if (cn.includes("primaire")) calLevel = "primaire";
            else calLevel = level.includes("primaire") ? "primaire" : level;
        } else {
            calLevel = level.includes("primaire") ? "primaire" : level;
        }
        if (!schoolData?.calendar || !calLevel) return [];
        const levelCalendar = (schoolData.calendar as any)[calLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, level, assignedClassroomName]);

    const activePeriod = useMemo(() => {
        if (!periods || periods.length === 0) return null;
        let active = periods.find((p: any) => p.isActive);
        if (!active) {
            const today = new Date().toISOString().split('T')[0];
            active = periods.find((p: any) => p.startDate && p.endDate && today >= p.startDate && today <= p.endDate);
        }
        return active || periods[0];
    }, [periods]);

    const displayPeriod = useMemo(() => {
        if (selectedPeriodId) {
            return periods.find((p: any) => p.id === selectedPeriodId) || activePeriod;
        }
        return activePeriod;
    }, [selectedPeriodId, activePeriod, periods]);

    // Identify courses from timetable with exact normalized key lookup
    const classroomCourses = useMemo(() => {
        if (!rawClassroomId || !schoolData?.timetables) return [];
        const timetables = schoolData.timetables as Record<string, any>;
        const slots = timetables[rawClassroomId] || {};
        const courseNames = new Set<string>();
        Object.values(slots).forEach((slot: any) => {
            if (slot.course) courseNames.add(slot.course);
        });
        return Array.from(courseNames).sort();
    }, [assignedClassroomName, schoolData]);


    const studentCount = useMemo(() => {
        return (schoolData?.students as any[])?.filter(
            (s: any) => s.classroomName === assignedClassroomName
        )?.length || 0;
    }, [schoolData, assignedClassroomName]);

    useEffect(() => {
        const fetchSubmissions = async () => {
            if (!rawClassroomId || !schoolData?.matricule) return;
            setIsFetching(true);
            try {
                let url = `/api/teacher/grades/close?classroomId=${encodeURIComponent(rawClassroomId)}&matricule=${schoolData.matricule}`;
                if (displayPeriod) {
                    url += `&periodId=${displayPeriod.id}`;
                }
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setSubmissions(data.submissions || []);
                }
            } catch (error) {
                console.error("Failed to fetch submissions", error);
            } finally {
                setIsFetching(false);
            }
        };

        const fetchPeriodClosure = async () => {
            if (!rawClassroomId || !displayPeriod?.id || !schoolData?.matricule) return;
            try {
                const res = await fetch(`/api/teacher/period/closure?classroomId=${encodeURIComponent(rawClassroomId)}&periodId=${displayPeriod.id}&schoolMatricule=${encodeURIComponent(schoolData.matricule)}`);
                if (res.ok) {
                    const data = await res.json();
                    setIsPeriodClosed(data.isClosed || false);
                }
            } catch (e) {
                console.error("Failed to check period closure", e);
            }
        };

        if (!isLoading) {
            fetchSubmissions();
            fetchPeriodClosure();
        }
    }, [assignedClassroomName, schoolData, isLoading, displayPeriod, isSecondary]);

    const handleUnlock = async (submissionId: string) => {
        if (!confirm("Voulez-vous vraiment libérer cette période pour ce cours ? Les totaux disparaîtront de votre vue panoramique et l'enseignant récupérera l'accès.")) {
            return;
        }

        try {
            const res = await fetch(`/api/teacher/grades/close/unlock?id=${submissionId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Cours libéré avec succès.");
                setSubmissions(prev => prev.filter(s => s.id !== submissionId));
            } else {
                toast.error("Erreur lors de la libération du cours.");
            }
        } catch {
            toast.error("Erreur réseau.");
        }
    };

    if (isLoading || isFetching) {
        return <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!assignedClassroomName) {
        return (
            <div className="glass-card py-16 flex flex-col items-center justify-center text-center">
                <Users className="h-14 w-14 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-bold text-foreground mb-1">Aucun local assigné</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Vous n&apos;avez pas encore de local de classe assigné dans votre profil.
                </p>
            </div>
        );
    }

    const submittedCourseNames = new Set(
        submissions.map(s => s.course?.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim())
    );

    // Courses with REVISION_REQUESTED status
    const revisionRequestedCourses = submissions.filter(s => s.status === "REVISION_REQUESTED");
    const revisionCourseNames = new Set(
        revisionRequestedCourses.map(s => s.course?.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim())
    );

    const totalCourses = classroomCourses.length;
    const submittedCount = classroomCourses.filter(c => {
        const norm = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return submittedCourseNames.has(norm);
    }).length;
    const pendingCount = totalCourses - submittedCount;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="glass-card p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-primary/5 -translate-y-1/4 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-primary/3 translate-y-1/2 -translate-x-1/4" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <Badge className="bg-primary/10 text-primary border-none text-xs font-extrabold uppercase tracking-widest py-1 px-3">
                            TITULAIRE DE CLASSE
                        </Badge>
                        {periods.length > 0 && (
                            <Select
                                value={selectedPeriodId || activePeriod?.id || ""}
                                onValueChange={(value) => setSelectedPeriodId(value === activePeriod?.id ? "" : value)}
                            >
                                <SelectTrigger className="h-6 w-auto border-none bg-muted text-muted-foreground hover:bg-muted/80 transition-colors shadow-none rounded-full px-3 py-1 text-[10px] font-bold uppercase focus:ring-0 focus:ring-offset-0">
                                    <SelectValue placeholder="Sélectionner une période" />
                                </SelectTrigger>
                                <SelectContent>
                                    {periods.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">
                                            {p.name} {p.id === activePeriod?.id && "(Active)"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <PageHelp pageId="titulaire" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase mb-2">{assignedClassroomName}</h1>
                    <p className="text-muted-foreground text-sm">
                        Gestion des performances et consolidation des résultats de votre classe.
                    </p>
                </div>
            </div>

            {/* Revision Request Banner */}
            {revisionRequestedCourses.length > 0 && (
                <div className="bg-orange-50 border border-orange-300 text-orange-800 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                    <ShieldAlert className="h-6 w-6 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold mb-1">⚠️ L&apos;administration a demandé la révision de {revisionRequestedCourses.length} cours</p>
                        <p className="text-sm mb-2">Veuillez libérer les cahiers concernés pour permettre les modifications :</p>
                        <div className="flex flex-wrap gap-1.5">
                            {revisionRequestedCourses.map(s => (
                                <Badge key={s.id} className="bg-orange-200/60 text-orange-900 border-orange-300 text-xs font-bold">
                                    {s.course?.name || "Cours"}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Period Closed Banner */}
            {isPeriodClosed && revisionRequestedCourses.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3">
                    <Lock className="h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold">Période clôturée</p>
                        <p className="text-sm">Les résultats ont été transmis à l&apos;administration. Les cahiers de cotes ne peuvent plus être modifiés.</p>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="stat-card text-center">
                    <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-black">{studentCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Élèves</p>
                </div>
                <div className="stat-card text-center">
                    <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-black">{totalCourses}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Cours</p>
                </div>
                <div className="stat-card text-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{submittedCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Clôturés</p>
                </div>
                <div className="stat-card text-center">
                    <Clock className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">En Attente</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <Link href="/teacher/panoramic">
                    <div className="glass-card glass-card-hover p-5 flex items-center gap-4 cursor-pointer h-full">
                        <div className="p-3 rounded-xl bg-primary/10">
                            <BarChart3 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm mb-0.5">Vue Panoramique</h3>
                            <p className="text-xs text-muted-foreground">Tableau croisé des moyennes par matière</p>
                        </div>
                    </div>
                </Link>
                <Link href="/teacher/performance">
                    <div className="glass-card glass-card-hover p-5 flex items-center gap-4 cursor-pointer h-full">
                        <div className="p-3 rounded-xl bg-emerald-500/10">
                            <Send className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm mb-0.5">Consolidation</h3>
                            <p className="text-xs text-muted-foreground">Palmarès et statistiques de la classe</p>
                        </div>
                    </div>
                </Link>
                <Link href="/teacher/performance/bulletins">
                    <div className="glass-card glass-card-hover p-5 flex items-center gap-4 cursor-pointer h-full">
                        <div className="p-3 rounded-xl bg-blue-500/10">
                            <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm mb-0.5 text-blue-600 dark:text-blue-400">Bulletins</h3>
                            <p className="text-xs text-muted-foreground">Génération et impression des bulletins</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Submissions Status */}
            {true && (
                <div className="glass-card overflow-hidden p-0">
                    <div className="px-5 py-4 tonal-surface-raised flex items-center gap-2">
                        <Lock className="h-4 w-4 text-primary" />
                        <h3 className="font-extrabold text-sm">Statut des Soumissions</h3>
                        <Badge className="ml-auto bg-muted text-muted-foreground border-none text-[10px] font-bold">
                            {submittedCount} / {totalCourses}
                        </Badge>
                    </div>
                    <div className="space-y-0">
                        {classroomCourses.map((courseName) => {
                            const norm = courseName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                            const isSubmitted = submittedCourseNames.has(norm);
                            const isRevisionRequested = revisionCourseNames.has(norm);
                            const sub = submissions.find(s => {
                                const subNorm = s.course?.name?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                return subNorm === norm;
                            });

                            return (
                                <div key={courseName} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {isRevisionRequested ? (
                                            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                                            </div>
                                        ) : isSubmitted ? (
                                            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            </div>
                                        ) : (
                                            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                                <Clock className="h-4 w-4 text-amber-500" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-sm">{courseName}</p>
                                            {sub && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Clôturé le {new Date(sub.submittedAt).toLocaleDateString('fr-FR')}
                                                    {sub.teacher?.name && ` par ${sub.teacher.name}`}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={cn(
                                            "text-[10px] uppercase font-extrabold border-none",
                                            isRevisionRequested
                                                ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                                : isSubmitted
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {isRevisionRequested ? "Révision demandée" : isSubmitted ? "Transmis" : "En Cours"}
                                        </Badge>
                                        {isSubmitted && sub && !isPeriodClosed && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleUnlock(sub.id)}
                                                className="h-6 text-[10px] px-2 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent bg-destructive/5"
                                                title="Libérer ce cahier des cotes pour l'enseignant"
                                            >
                                                Libérer
                                            </Button>
                                        )}
                                        {isRevisionRequested && sub && isPeriodClosed && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleUnlock(sub.id)}
                                                className="h-6 text-[10px] px-2 font-bold text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 border-orange-200 bg-orange-50"
                                                title="Libérer pour correction"
                                            >
                                                Libérer pour correction
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
