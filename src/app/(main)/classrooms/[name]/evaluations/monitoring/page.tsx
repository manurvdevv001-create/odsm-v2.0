"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    Clock,
    AlertTriangle,
    RefreshCw,
    Loader2,
    Shield,
    Lock,
    Unlock,
    Check,
    GraduationCap,
    Gavel,
    Settings,
    Plus,
    Trash2,
    BarChart3
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { isSecondaryClassroom } from "@/lib/classroom-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function PeriodMonitoringPage() {
    const params = useParams();
    const router = useRouter();
    const classroomName = decodeURIComponent(params.name as string);
    const { schoolData, isLoading } = useSchoolData();

    const [submissions, setSubmissions] = useState<any[]>([]);
    const [periodClosure, setPeriodClosure] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(true);
    const [revisionLoading, setRevisionLoading] = useState<string | null>(null);
    const [isUnlockingPeriod, setIsUnlockingPeriod] = useState(false);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    // Details console states
    const [detailsStudents, setDetailsStudents] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [savingDetails, setSavingDetails] = useState(false);
    const [activeConsoleTab, setActiveConsoleTab] = useState<"conduct" | "exams" | "repechage" | "endyear">("conduct");
    const [mentionsList, setMentionsList] = useState<string[]>(["E", "TB", "B", "ME", "MA"]);
    const [newMentionInput, setNewMentionInput] = useState("");

    const normalize = (str: string) => {
        if (!str) return "";
        let norm = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
        norm = norm.replace(/([2-9])eme/g, '$1e');
        norm = norm.replace(/education de base/g, 'cteb');
        return norm.replace(/\s+/g, ' ');
    };

    const isSecondary = useMemo(() => {
        return isSecondaryClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const allPeriods = useMemo(() => {
        if (!schoolData?.calendar) return [];
        // Resolve true level from classroom name to distinguish maternelle vs primaire
        let rawLevel = isSecondary ? "secondaire" : "primaire";
        if (!isSecondary) {
            const cn = classroomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cn.includes("maternelle")) rawLevel = "maternelle";
            else rawLevel = "primaire";
        }
        const levelCalendar = (schoolData.calendar as any)[rawLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, isSecondary, classroomName]);

    const activePeriod = useMemo(() => {
        return allPeriods.find((p: any) => p.isActive) || allPeriods[0];
    }, [allPeriods]);

    const displayPeriod = useMemo(() => {
        if (selectedPeriodId) {
            return allPeriods.find((p: any) => p.id === selectedPeriodId) || activePeriod;
        }
        return activePeriod;
    }, [selectedPeriodId, activePeriod, allPeriods]);

    // Courses from timetable + config
    const courses = useMemo(() => {
        const coursesObj = (schoolData?.courses as any) || {};
        const classroomStr = normalize(classroomName);
        // Exact match first, then prefix match — never partial first-word to avoid cross-level contamination
        const gradeKey = Object.keys(coursesObj).find(k => normalize(k) === classroomStr)
            || Object.keys(coursesObj).find(k => {
                const kLower = normalize(k);
                return classroomStr.startsWith(kLower) || kLower.startsWith(classroomStr);
            });
        const clCourses = gradeKey ? coursesObj[gradeKey] : [];
        // Use normalized key lookup for timetable to avoid wrong classroom match
        const timetableData = (schoolData?.timetables as Record<string, any>) || {};
        const matchedTbKey = Object.keys(timetableData).find(k => normalize(k) === classroomStr) || classroomName;
        const timetableSlots = timetableData[matchedTbKey] || {};
        const placedNames = new Set<string>();
        Object.values(timetableSlots).forEach((slot: any) => { if (slot.course) placedNames.add(slot.course); });

        const finalCourses: string[] = [];
        Array.from(placedNames).forEach(name => {
            if (!finalCourses.find(fc => normalize(fc) === normalize(name))) {
                finalCourses.push(name);
            }
        });
        if (Array.isArray(clCourses)) {
            clCourses.forEach((c: any) => {
                if (!finalCourses.find(fc => normalize(fc) === normalize(c.name))) {
                    finalCourses.push(c.name);
                }
            });
        }
        return finalCourses.sort();
    }, [schoolData, classroomName]);

    const fetchMonitoringData = async () => {
        if (!classroomName) return;
        setIsFetching(true);
        try {
            const url = `/api/admin/period-monitoring?classroomId=${encodeURIComponent(classroomName)}${displayPeriod?.id ? `&periodId=${displayPeriod.id}` : ""}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setSubmissions(data.submissions || []);
                setPeriodClosure(data.periodClosure || null);
            }
        } catch (error) {
            console.error("Failed to fetch monitoring data", error);
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        if (!isLoading) fetchMonitoringData();
    }, [isLoading, classroomName, displayPeriod]);

    const fetchDetails = async () => {
        if (!classroomName || !displayPeriod?.id) return;
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/admin/period-monitoring/details?classroomId=${encodeURIComponent(classroomName)}&periodId=${displayPeriod.id}`);
            if (res.ok) {
                const data = await res.json();
                setDetailsStudents(data.students || []);
            }
        } catch (e) {
            console.error("Error fetching details", e);
        } finally {
            setDetailsLoading(false);
        }
    };

    useEffect(() => {
        if (periodClosure && displayPeriod?.id) {
            fetchDetails();
        }
    }, [periodClosure, displayPeriod]);

    const handleSaveDetails = async () => {
        if (!displayPeriod?.id) return;
        setSavingDetails(true);
        try {
            const res = await fetch("/api/admin/period-monitoring/details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    periodId: displayPeriod.id,
                    classroomId: classroomName,
                    updates: detailsStudents.map(s => ({
                        studentId: s.id,
                        conduct: s.conduct,
                        application: s.application,
                        comment: s.comment,
                        enafepScore: s.enafepScore !== null && s.enafepScore !== "" ? Number(s.enafepScore) : null,
                        stateExamScore: s.stateExamScore !== null && s.stateExamScore !== "" ? Number(s.stateExamScore) : null,
                        jurySchoolScore: s.jurySchoolScore !== null && s.jurySchoolScore !== "" ? Number(s.jurySchoolScore) : null,
                        juryExamScore: s.juryExamScore !== null && s.juryExamScore !== "" ? Number(s.juryExamScore) : null,
                        juryLesson1: s.juryLesson1 !== null && s.juryLesson1 !== "" ? Number(s.juryLesson1) : null,
                        juryLesson2: s.juryLesson2 !== null && s.juryLesson2 !== "" ? Number(s.juryLesson2) : null,
                        repechageCourses: s.repechageCourses
                    }))
                })
            });
            if (res.ok) {
                toast.success("Décisions et mentions enregistrées avec succès.");
                fetchDetails();
            } else {
                toast.error("Erreur lors de l'enregistrement.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setSavingDetails(false);
        }
    };

    const updateStudentField = (studentId: string, field: string, value: any) => {
        setDetailsStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const handleUnlockPeriod = async () => {
        if (!periodClosure?.id) return;
        if (!confirm(`Voulez-vous vraiment débloquer la période "${displayPeriod?.name}" pour ce local ? Le titulaire pourra à nouveau clôturer la période.`)) return;
        setIsUnlockingPeriod(true);
        try {
            const res = await fetch(`/api/teacher/period/closure?id=${periodClosure.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Période débloquée avec succès.");
                setPeriodClosure(null);
                fetchMonitoringData();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors du déblocage.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setIsUnlockingPeriod(false);
        }
    };

    const handleRequestRevision = async (submissionId: string, courseName: string) => {
        if (!confirm(`Voulez-vous demander la révision du cours "${courseName}" ? Le titulaire sera notifié et pourra libérer le cahier de cotes.`)) return;
        setRevisionLoading(submissionId);
        try {
            const res = await fetch("/api/admin/period-monitoring", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    submissionIds: [submissionId],
                    requestedBy: "admin"
                })
            });
            if (res.ok) {
                toast.success(`Révision demandée pour "${courseName}".`);
                fetchMonitoringData();
            } else {
                toast.error("Erreur lors de la demande.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setRevisionLoading(null);
        }
    };

    // Course status map
    const courseStatusMap = useMemo(() => {
        const map: Record<string, { status: string; submission?: any }> = {};
        courses.forEach(courseName => {
            const courseNorm = normalize(courseName);
            const sub = submissions.find(s => {
                const subNorm = normalize(s.courseName || "");
                return subNorm === courseNorm || subNorm.includes(courseNorm) || courseNorm.includes(subNorm);
            });
            if (sub) {
                map[courseName] = { status: sub.status, submission: sub };
            } else {
                map[courseName] = { status: "PENDING" };
            }
        });
        return map;
    }, [courses, submissions]);

    const stats = useMemo(() => {
        const entries = Object.values(courseStatusMap);
        return {
            submitted: entries.filter(e => e.status === "SUBMITTED" || e.status === "VALIDATED").length,
            revision: entries.filter(e => e.status === "REVISION_REQUESTED").length,
            pending: entries.filter(e => e.status === "PENDING").length,
            total: entries.length
        };
    }, [courseStatusMap]);

    if (isLoading || isFetching) {
        return <div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            <div className="flex flex-col gap-4 mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-fit text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                        <h1 className="text-3xl font-headline font-bold text-foreground flex items-center gap-3">
                            <div className="neuglass-light-icon p-2 rounded-xl bg-primary/10">
                                <Shield className="h-7 w-7 text-primary" />
                            </div>
                            Suivi Périodique
                        </h1>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            <span>Local <span className="font-semibold text-foreground uppercase">{classroomName}</span></span>
                            <span>—</span>
                            <div className="flex items-center gap-2">
                                <span>Période :</span>
                                <Select
                                    value={selectedPeriodId || activePeriod?.id || ""}
                                    onValueChange={(value) => setSelectedPeriodId(value === activePeriod?.id ? "" : value)}
                                >
                                    <SelectTrigger className="h-6 w-auto border-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-none rounded-sm px-2 text-xs font-bold uppercase focus:ring-0 focus:ring-offset-0">
                                        <SelectValue placeholder="Sélectionner" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allPeriods.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs font-bold uppercase">
                                                {p.name} {p.id === activePeriod?.id && "(Active)"}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center items-center gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 rounded-xl font-bold gap-2"
                            onClick={() => {
                                if (displayPeriod?.id) {
                                    router.push(`/classrooms/${encodeURIComponent(classroomName)}/evaluations/monitoring/stats?mode=general&periodId=${displayPeriod.id}`);
                                } else {
                                    toast.error("Veuillez sélectionner une période d'abord.");
                                }
                            }}
                        >
                            <BarChart3 className="h-4 w-4" />
                            Stats Générales
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 rounded-xl font-bold gap-2 bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => {
                                router.push(`/classrooms/${encodeURIComponent(classroomName)}/evaluations/monitoring/stats?mode=cumulative`);
                            }}
                        >
                            <BarChart3 className="h-4 w-4" />
                            Stats Générales Cumulées
                        </Button>
                    </div>

                    <div className="flex-1 flex flex-wrap items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl font-bold gap-2"
                            onClick={fetchMonitoringData}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Actualiser
                        </Button>
                        {periodClosure ? (
                            <div className="flex items-center gap-2">
                                <Badge className="h-9 rounded-xl font-bold gap-2 bg-emerald-100 text-emerald-700 border-emerald-200 px-4">
                                    <Lock className="h-4 w-4" />
                                    Période Clôturée
                                </Badge>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleUnlockPeriod}
                                    disabled={isUnlockingPeriod}
                                    className="h-9 rounded-xl font-bold gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 bg-red-50/50"
                                    title="Débloquer la période (action administrateur)"
                                >
                                    {isUnlockingPeriod ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Unlock className="h-4 w-4" />
                                    )}
                                    Débloquer la Période
                                </Button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                <div className="glass-card text-center p-4">
                    <BookOpen className="h-5 w-5 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-black">{stats.total}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Cours Total</p>
                </div>
                <div className="glass-card text-center p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-2" />
                    <p className="text-2xl font-black text-emerald-600">{stats.submitted}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Clôturés</p>
                </div>
                <div className="glass-card text-center p-4">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-black text-orange-600">{stats.revision}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">En Révision</p>
                </div>
                <div className="glass-card text-center p-4">
                    <Clock className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">En Attente</p>
                </div>
            </div>

            {/* Revision Banner */}
            {stats.revision > 0 && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm mb-6 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold mb-0.5">{stats.revision} cours en attente de modification</p>
                        <p>Le titulaire a été notifié. Les bulletins seront mis à jour automatiquement après les corrections.</p>
                    </div>
                </div>
            )}

            {/* Course List */}
            <div className="glass-card overflow-hidden p-0">
                <div className="px-5 py-4 tonal-surface-raised flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <h3 className="font-extrabold text-sm">Cahiers de Cotes — {displayPeriod?.name || "Période"}</h3>
                    <Badge className="ml-auto bg-muted text-muted-foreground border-none text-[10px] font-bold">
                        {stats.submitted + stats.revision} / {stats.total} soumis
                    </Badge>
                </div>

                <div className="divide-y divide-border/30">
                    {courses.map((courseName) => {
                        const entry = courseStatusMap[courseName];
                        const status = entry?.status || "PENDING";
                        const sub = entry?.submission;

                        const statusConfig = {
                            SUBMITTED: {
                                icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                                bgIcon: "bg-emerald-500/10",
                                badge: "bg-emerald-500/10 text-emerald-600",
                                label: "Clôturé"
                            },
                            VALIDATED: {
                                icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                                bgIcon: "bg-emerald-500/10",
                                badge: "bg-emerald-500/10 text-emerald-600",
                                label: "Validé"
                            },
                            REVISION_REQUESTED: {
                                icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
                                bgIcon: "bg-orange-500/10",
                                badge: "bg-orange-500/10 text-orange-600",
                                label: "En attente de modification"
                            },
                            PENDING: {
                                icon: <Clock className="h-4 w-4 text-amber-500" />,
                                bgIcon: "bg-amber-500/10",
                                badge: "bg-amber-500/10 text-amber-600",
                                label: "En Attente"
                            }
                        }[status] || { icon: <Clock className="h-4 w-4" />, bgIcon: "bg-muted", badge: "bg-muted", label: status };

                        return (
                            <div key={courseName} className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", statusConfig.bgIcon)}>
                                        {statusConfig.icon}
                                    </div>
                                    <div>
                                        {(status === "SUBMITTED" || status === "VALIDATED") && sub ? (
                                            <p 
                                                className="font-bold text-sm text-primary hover:underline cursor-pointer"
                                                onClick={() => router.push(`/classrooms/${encodeURIComponent(classroomName)}/evaluations/monitoring/stats?mode=course&submissionId=${sub.id}`)}
                                            >
                                                {courseName}
                                            </p>
                                        ) : (
                                            <p className="font-semibold text-sm">{courseName}</p>
                                        )}
                                        {sub?.submittedAt && (
                                            <p className="text-[10px] text-muted-foreground">
                                                Soumis le {new Date(sub.submittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                {sub.revisionRequestedAt && ` · Révision demandée le ${new Date(sub.revisionRequestedAt).toLocaleDateString('fr-FR')}`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className={cn(
                                        "text-[10px] uppercase font-extrabold border-none whitespace-nowrap",
                                        statusConfig.badge
                                    )}>
                                        {statusConfig.label}
                                    </Badge>
                                    {(status === "SUBMITTED" || status === "VALIDATED") && sub && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRequestRevision(sub.id, courseName)}
                                            disabled={revisionLoading === sub.id}
                                            className="h-7 text-[10px] px-3 font-bold text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 border-orange-200 bg-orange-50"
                                        >
                                            {revisionLoading === sub.id ? (
                                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            ) : (
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                            )}
                                            Demander Révision
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {courses.length === 0 && (
                        <div className="p-10 text-center text-muted-foreground">
                            <p>Aucun cours configuré pour ce local.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
