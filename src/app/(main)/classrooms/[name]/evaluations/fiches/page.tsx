"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    Loader2,
    Shield,
    Lock,
    Check,
    GraduationCap,
    Settings,
    Plus,
    Users,
    AlertTriangle,
    BookOpen,
    LockKeyhole,
    CheckCircle2,
    XCircle,
    ArrowUpDown,
    RotateCcw,
    Minus
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isSecondaryClassroom, isMaternelleClassroom } from "@/lib/classroom-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

export default function FichesDeSuiviPage() {
    const params = useParams();
    const router = useRouter();
    const classroomName = decodeURIComponent(params.name as string);
    const { schoolData, isLoading } = useSchoolData();

    const [periodClosure, setPeriodClosure] = useState<any>(null);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    const [detailsStudents, setDetailsStudents] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [savingDetails, setSavingDetails] = useState(false);
    const [activeConsoleTab, setActiveConsoleTab] = useState<"conduct" | "exams" | "repechage" | "endyear">("conduct");
    const [mentionsConfig, setMentionsConfig] = useState<any>(null);
    const [finalDecisionsConfig, setFinalDecisionsConfig] = useState<string[]>([]);

    // Annual decisions state
    const [annualStudents, setAnnualStudents] = useState<any[]>([]);
    const [annualGrades, setAnnualGrades] = useState<any[]>([]);
    const [annualDecisionsMap, setAnnualDecisionsMap] = useState<Record<string, { decision: string; targetGradeId?: string }>>({});
    const [annualClosure, setAnnualClosure] = useState<any>(null);
    const [annualLoading, setAnnualLoading] = useState(false);
    const [savingAnnual, setSavingAnnual] = useState(false);
    const [closingAnnual, setClosingAnnual] = useState(false);
    const [showClosureConfirm, setShowClosureConfirm] = useState(false);
    const [classroomDbId, setClassroomDbId] = useState<string>("");

    const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";

    const isMaternelle = useMemo(() => {
        return isMaternelleClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const isSecondary = useMemo(() => {
        return isSecondaryClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const levelKey = isMaternelle ? "maternelle" : isSecondary ? "secondaire" : "primaire";

    useEffect(() => {
        if (schoolData?.configuration) {
            const config = schoolData.configuration as any;
            // Prefer level-specific config; if absent for secondaire, fallback to primaire when available
            let rawConfig = config.qualitativeMentions?.[levelKey];
            if (!rawConfig && levelKey === 'secondaire' && config.qualitativeMentions?.primaire) {
                rawConfig = config.qualitativeMentions.primaire;
            }
            if (rawConfig) {
                if (Array.isArray(rawConfig)) {
                    // Legacy array config
                    setMentionsConfig({
                        applicationMentions: rawConfig.map((m, i) => ({ name: m, min: 100 - (i * 20), max: 100 - (i * 20) + 19 })),
                        conductMode: "COTATION",
                        conductMaxScore: 20,
                        conductMentions: rawConfig.map((m, i) => ({ name: m, min: 20 - (i * 4), max: 20 - (i * 4) + 3, weight: 20 - (i * 4) }))
                    });
                } else {
                    setMentionsConfig(rawConfig);
                }
            }
            if (config.finalDecisions?.[levelKey]) {
                setFinalDecisionsConfig(config.finalDecisions[levelKey]);
            }
        }
    }, [schoolData, levelKey]);

    const allPeriods = useMemo(() => {
        if (!schoolData?.calendar) return [];
        const rawLevel = isSecondary ? "secondaire" : "primaire";
        const levelCalendar = (schoolData.calendar as any)[rawLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, isSecondary]);

    const activePeriod = useMemo(() => {
        return allPeriods.find((p: any) => p.isActive) || allPeriods[0];
    }, [allPeriods]);

    const displayPeriod = useMemo(() => {
        if (selectedPeriodId) {
            return allPeriods.find((p: any) => p.id === selectedPeriodId) || activePeriod;
        }
        return activePeriod;
    }, [selectedPeriodId, activePeriod, allPeriods]);

    useEffect(() => {
        const fetchMonitoringData = async () => {
            if (!classroomName) return;
            try {
                const url = `/api/admin/period-monitoring?classroomId=${encodeURIComponent(classroomName)}${displayPeriod?.id ? `&periodId=${displayPeriod.id}` : ""}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setPeriodClosure(data.periodClosure || null);
                }
            } catch (error) {
                console.error("Failed to fetch monitoring data", error);
            }
        };
        if (!isLoading) fetchMonitoringData();
    }, [isLoading, classroomName, displayPeriod]);

    const fetchDetails = async () => {
        if (!classroomName || !displayPeriod?.id) return;
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/admin/period-monitoring/details?classroomId=${encodeURIComponent(classroomName)}&periodId=${displayPeriod.id}`);
            if (res.ok) {
                const data = await res.json();
                
                // Auto-calculate application mentions if we have config
                const updatedStudents = (data.students || []).map((s: any) => {
                    let autoApplication = s.application;
                    let autoFinalApplication = s.finalApplication;
                    if (mentionsConfig) {
                        if (s.currentPeriodAverage !== null && s.currentPeriodAverage !== undefined) {
                            const found = mentionsConfig.applicationMentions.find(
                                (m: any) => s.currentPeriodAverage >= m.min && s.currentPeriodAverage <= m.max
                            );
                            if (found) autoApplication = found.name;
                        }
                        if (s.annualAverage !== null && s.annualAverage !== undefined) {
                            const found = mentionsConfig.applicationMentions.find(
                                (m: any) => s.annualAverage >= m.min && s.annualAverage <= m.max
                            );
                            if (found) autoFinalApplication = found.name;
                        }
                    }
                    return {
                        ...s,
                        application: autoApplication,
                        finalApplication: autoFinalApplication
                    };
                });
                
                setDetailsStudents(updatedStudents);
            }
        } catch (e) {
            console.error("Error fetching details", e);
        } finally {
            setDetailsLoading(false);
        }
    };

    useEffect(() => {
        if (activeConsoleTab === "conduct") {
            if (periodClosure && displayPeriod?.id) {
                fetchDetails();
            } else {
                setDetailsStudents([]);
            }
        } else if (activeConsoleTab === "endyear") {
            fetchAnnualDecisions();
        } else {
            // For global tabs, we can fetch students directly without waiting for period closure.
            if (displayPeriod?.id) {
                fetchDetails();
            }
        }
    }, [periodClosure, displayPeriod, activeConsoleTab]);

    // --- ANNUAL DECISIONS ---
    const fetchAnnualDecisions = useCallback(async () => {
        if (!classroomName) return;
        setAnnualLoading(true);
        try {
            const res = await fetch(`/api/admin/annual-decisions?classroomId=${encodeURIComponent(classroomName)}`);
            if (res.ok) {
                const data = await res.json();
                setAnnualStudents(data.students || []);
                setAnnualGrades(data.grades || []);
                setClassroomDbId(data.classroomId || "");
                const map: Record<string, { decision: string; targetGradeId?: string }> = {};
                (data.students || []).forEach((s: any) => {
                    if (s.annualDecision) {
                        map[s.id] = { decision: s.annualDecision.decision, targetGradeId: s.annualDecision.targetGradeId || "" };
                    }
                });
                setAnnualDecisionsMap(map);

                // Fetch closure status
                if (data.classroomId) {
                    const closureRes = await fetch(`/api/admin/annual-closures?classroomId=${encodeURIComponent(data.classroomId)}`);
                    if (closureRes.ok) {
                        const closureData = await closureRes.json();
                        setAnnualClosure(closureData.closure || null);
                    }
                }
            }
        } catch (e) {
            console.error("Error fetching annual decisions", e);
        } finally {
            setAnnualLoading(false);
        }
    }, [classroomName]);

    const handleSaveAnnualDecisions = async () => {
        setSavingAnnual(true);
        try {
            const decisions = Object.entries(annualDecisionsMap).map(([studentId, dec]) => ({
                studentId,
                decision: dec.decision,
                targetGradeId: dec.targetGradeId || null
            }));
            const res = await fetch("/api/admin/annual-decisions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ classroomId: classroomName, decisions })
            });
            if (res.ok) {
                toast.success("Décisions annuelles enregistrées avec succès.");
                fetchAnnualDecisions();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de l'enregistrement.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setSavingAnnual(false);
        }
    };

    const handleAnnualClosure = async () => {
        if (!classroomDbId) return;
        setClosingAnnual(true);
        try {
            const res = await fetch("/api/admin/annual-closures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityType: "CLASSROOM",
                    entityId: classroomDbId,
                    closedByUserId: "admin",
                    closedByName: "Administrateur"
                })
            });
            if (res.ok) {
                toast.success(`Local ${classroomName} clôturé pour l'année scolaire.`);
                setShowClosureConfirm(false);
                fetchAnnualDecisions();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la clôture.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setClosingAnnual(false);
        }
    };

    const updateAnnualDecision = (studentId: string, decision: string, targetGradeId?: string) => {
        setAnnualDecisionsMap(prev => ({
            ...prev,
            [studentId]: { decision, targetGradeId: targetGradeId ?? prev[studentId]?.targetGradeId ?? "" }
        }));
    };

    const annualDecisionStats = useMemo(() => {
        const vals = Object.values(annualDecisionsMap);
        return {
            total: annualStudents.length,
            withDecision: vals.length,
            promus: vals.filter(d => d.decision === 'PROMU').length,
            maintenus: vals.filter(d => d.decision === 'MAINTENU').length,
            demis: vals.filter(d => d.decision === 'DEMIS').length,
            exclus: vals.filter(d => d.decision === 'EXCLU' || d.decision === 'RETIRE').length,
            allHaveDecisions: annualStudents.length > 0 && vals.length === annualStudents.length
        };
    }, [annualDecisionsMap, annualStudents]);

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
                        repechageCourses: s.repechageCourses,
                        finalDecision: s.finalDecision,
                        finalConduct: s.finalConduct,
                        finalApplication: s.finalApplication
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

    if (isLoading) {
        return <div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <>
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

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-headline font-bold text-foreground flex items-center gap-3">
                            <div className="neuglass-light-icon p-2 rounded-xl bg-blue-500/10">
                                <Users className="h-7 w-7 text-blue-600" />
                            </div>
                            Fiches de Suivi
                        </h1>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            <span>Local <span className="font-semibold text-foreground uppercase">{classroomName}</span></span>
                            {activeConsoleTab === "conduct" && (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>
                    {activeConsoleTab === "conduct" && (
                        <div className="flex items-center gap-2">
                            {periodClosure ? (
                                <Badge className="h-9 rounded-xl font-bold gap-2 bg-emerald-100 text-emerald-700 border-emerald-200 px-4">
                                    <Lock className="h-4 w-4" />
                                    Période Clôturée
                                </Badge>
                            ) : (
                                <Badge className="h-9 rounded-xl font-bold gap-2 bg-amber-100 text-amber-700 border-amber-200 px-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    Période Non Clôturée
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Top Level Navigation Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 bg-muted/30 p-1.5 rounded-xl w-fit">
                <button
                    onClick={() => setActiveConsoleTab("conduct")}
                    className={cn(
                        "px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all",
                        activeConsoleTab === "conduct"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Suivi Périodique (Conduite)
                </button>
                
                {/* Tab Examen de Fin d'Année */}
                <button
                    onClick={() => setActiveConsoleTab("exams")}
                    className={cn(
                        "px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all",
                        activeConsoleTab === "exams"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Examens Officiels & Jury
                </button>

                {/* Tab Repêchage */}
                {isSecondary && (
                    <button
                        onClick={() => setActiveConsoleTab("repechage")}
                        className={cn(
                            "px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all",
                            activeConsoleTab === "repechage"
                                ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Délibération de Repêchage
                    </button>
                )}

                {/* Tab Fin d'Année */}
                <button
                    onClick={() => setActiveConsoleTab("endyear")}
                    className={cn(
                        "px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all",
                        activeConsoleTab === "endyear"
                            ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Délibération de Fin d'Année
                </button>
            </div>

            {activeConsoleTab === "conduct" && !periodClosure ? (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <Lock className="h-12 w-12 text-muted-foreground/30" />
                    <h3 className="text-xl font-black text-foreground">Période Non Clôturée</h3>
                    <p className="text-muted-foreground max-w-md">
                        Les fiches de suivi et mentions de conduite ne sont accessibles qu'une fois la période clôturée pour ce local.
                    </p>
                </div>
            ) : (
                <div className="glass-card p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-4 mb-6">
                        <div>
                            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-600 animate-pulse" />
                                {activeConsoleTab === "conduct" && "Console d'Administration & Mentions"}
                                {activeConsoleTab === "exams" && "Saisie des Examens Officiels & Jury"}
                                {activeConsoleTab === "repechage" && "Délibération de Repêchage (Annuelle)"}
                                {activeConsoleTab === "endyear" && "Délibération de Fin d'Année"}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                {activeConsoleTab === "conduct" && "Appliquez les mentions qualitatives pour la période sélectionnée."}
                                {activeConsoleTab === "exams" && "Saisissez les résultats des examens officiels et jurys (données annuelles)."}
                                {activeConsoleTab === "repechage" && "Gérez les matières à repêcher pour les élèves en échec (données annuelles)."}
                                {activeConsoleTab === "endyear" && "Prenez les décisions finales de délibération pour l'année académique."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeConsoleTab === "endyear" ? (
                                !annualClosure && (
                                    <Button
                                        size="sm"
                                        disabled={savingAnnual}
                                        onClick={handleSaveAnnualDecisions}
                                        className="h-9 px-4 font-bold rounded-xl gap-2 shadow-sm bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        {savingAnnual ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Check className="h-4 w-4" />
                                        )}
                                        {savingAnnual ? "Enregistrement..." : "Enregistrer les décisions"}
                                    </Button>
                                )
                            ) : (
                                <Button
                                    size="sm"
                                    disabled={savingDetails}
                                    onClick={handleSaveDetails}
                                    className="h-9 px-4 font-bold rounded-xl gap-2 shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    {savingDetails ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                    {savingDetails ? "Enregistrement..." : "Enregistrer les modifications"}
                                </Button>
                            )}
                        </div>

                    </div>

                    {detailsLoading ? (
                        <div className="flex py-10 justify-center items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : (
                        <div>
                            {/* TAB 1: Conduite & Application */}
                            {activeConsoleTab === "conduct" && (
                                <div className="space-y-6">
                                    <div className="bg-muted/10 border border-border/30 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">Configuration Actuelle</h4>
                                            <Link href="/settings/school-setup" className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-1">
                                                <Settings className="h-3 w-3" />
                                                Configurer
                                            </Link>
                                        </div>
                                        {mentionsConfig ? (
                                            <div className="flex flex-col gap-2 text-xs">
                                                <div>
                                                    <span className="font-bold text-muted-foreground">Application : </span>
                                                    Calculée automatiquement selon le pourcentage de la période.
                                                </div>
                                                <div>
                                                    <span className="font-bold text-muted-foreground">Conduite : </span>
                                                    {mentionsConfig.conductMode === "COTATION" ? `Saisie de points (Max: ${mentionsConfig.conductMaxScore})` : "Sélection manuelle d'une mention"}
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Aucune mention configurée.</span>
                                        )}
                                    </div>

                                    {/* Grid list of students */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border/30 text-[10px] uppercase text-muted-foreground font-black tracking-wider">
                                                    <th className="pb-3 pr-4 font-black">Élève</th>
                                                    <th className="pb-3 px-4 font-black">Moyenne Période</th>
                                                    <th className="pb-3 px-4 font-black">Application (Auto)</th>
                                                    <th className="pb-3 px-4 font-black">Conduite (Disciplinaire)</th>
                                                    <th className="pb-3 pl-4 font-black">Observation / Commentaire</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20">
                                                {detailsStudents.map(student => (
                                                    <tr key={student.id} className="hover:bg-muted/5 transition-colors">
                                                        <td className="py-3 pr-4">
                                                            <div className="font-semibold text-sm">{student.lastName} {student.firstName}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{student.matricule}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-sm font-medium">
                                                            {student.currentPeriodAverage !== null ? `${student.currentPeriodAverage}%` : "-"}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {student.application ? (
                                                                <Badge variant="outline" className="font-bold text-xs bg-muted/20">
                                                                    {student.application}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground italic">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {mentionsConfig?.conductMode === "COTATION" ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        max={mentionsConfig.conductMaxScore}
                                                                        min="0"
                                                                        value={student.conduct || ""}
                                                                        onChange={(e) => updateStudentField(student.id, "conduct", e.target.value)}
                                                                        className="h-8 w-20 text-xs font-bold"
                                                                        placeholder={`/${mentionsConfig.conductMaxScore}`}
                                                                    />
                                                                    {student.conduct && (
                                                                        <span className="text-[10px] font-bold text-muted-foreground">
                                                                            {mentionsConfig.conductMentions.find((m: any) => Number(student.conduct) >= m.min && Number(student.conduct) <= m.max)?.name || "?"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <Select
                                                                    value={student.conduct || "none_val"}
                                                                    onValueChange={(val) => updateStudentField(student.id, "conduct", val === "none_val" ? "" : val)}
                                                                >
                                                                    <SelectTrigger className="h-8 w-28 text-xs font-bold">
                                                                        <SelectValue placeholder="Aucune" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="none_val">Aucune</SelectItem>
                                                                        {mentionsConfig?.conductMentions?.map((m: any) => (
                                                                            <SelectItem key={m.name} value={m.name} className="font-bold">{m.name}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pl-4">
                                                            <Input
                                                                placeholder="Saisir un commentaire libre..."
                                                                value={student.comment || ""}
                                                                onChange={(e) => updateStudentField(student.id, "comment", e.target.value)}
                                                                className="h-8 text-xs"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: Examens Officiels & Jury */}
                            {activeConsoleTab === "exams" && (
                                <div className="space-y-6">
                                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex items-center gap-3">
                                        <GraduationCap className="h-5 w-5 text-primary flex-shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-primary mb-0.5">Saisie des résultats d'examens officiels et de jurys</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Pour les classes terminales, ces notes s'affichent dans des zones spécifiques de synthèse sur le bulletin.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border/30 text-[10px] uppercase text-muted-foreground font-black tracking-wider">
                                                    <th className="pb-3 pr-4 font-black">Élève</th>
                                                    
                                                    {/* Detect 6e Primaire (ENAFEP) */}
                                                    {(!isSecondary && (classroomName.includes("6") || classroomName.toLowerCase().includes("six"))) ? (
                                                        <th className="pb-3 px-4 font-black">ENAFEP (Note / 100)</th>
                                                    ) : (isSecondary && (classroomName.includes("4") || classroomName.toLowerCase().includes("quatrieme"))) ? (
                                                        <th className="pb-3 px-4 font-black">Examen d'État (Diplôme %)</th>
                                                    ) : (isSecondary && (classroomName.includes("2") || classroomName.toLowerCase().includes("deuxieme"))) ? (
                                                        <>
                                                            <th className="pb-3 px-4 font-black">Jury Leçon 1 (/50)</th>
                                                            <th className="pb-3 px-4 font-black">Jury Leçon 2 (/50)</th>
                                                            <th className="pb-3 px-4 font-black">École Max (/50)</th>
                                                            <th className="pb-3 px-4 font-black">Jury Max (/50)</th>
                                                        </>
                                                    ) : (
                                                        <th className="pb-3 px-4 font-black text-muted-foreground font-medium italic">Aucun examen officiel pour cette classe</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20">
                                                {detailsStudents.map(student => (
                                                    <tr key={student.id} className="hover:bg-muted/5 transition-colors">
                                                        <td className="py-3 pr-4">
                                                            <div className="font-semibold text-sm">{student.lastName} {student.firstName}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{student.matricule}</div>
                                                        </td>
                                                        
                                                        {(!isSecondary && (classroomName.includes("6") || classroomName.toLowerCase().includes("six"))) ? (
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Input
                                                                        type="number"
                                                                        max="100"
                                                                        min="0"
                                                                        value={student.enafepScore === null ? "" : student.enafepScore}
                                                                        onChange={(e) => updateStudentField(student.id, "enafepScore", e.target.value)}
                                                                        className="h-8 w-24 text-xs font-bold text-center"
                                                                        placeholder="Max 100"
                                                                    />
                                                                    {student.enafepScore !== null && student.enafepScore !== "" && (
                                                                        <span className="text-[10px] font-bold text-muted-foreground">
                                                                            ({(Number(student.enafepScore) / 2).toFixed(1)} / 50)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        ) : (isSecondary && (classroomName.includes("4") || classroomName.toLowerCase().includes("quatrieme"))) ? (
                                                            <td className="py-3 px-4">
                                                                <Input
                                                                    type="number"
                                                                    max="100"
                                                                    min="0"
                                                                    value={student.stateExamScore === null ? "" : student.stateExamScore}
                                                                    onChange={(e) => updateStudentField(student.id, "stateExamScore", e.target.value)}
                                                                    className="h-8 w-28 text-xs font-bold text-center"
                                                                    placeholder="Ex: 62 %"
                                                                />
                                                            </td>
                                                        ) : (isSecondary && (classroomName.includes("2") || classroomName.toLowerCase().includes("deuxieme"))) ? (
                                                            <>
                                                                <td className="py-3 px-4">
                                                                    <Input
                                                                        type="number"
                                                                        max="50"
                                                                        min="0"
                                                                        value={student.juryLesson1 === null ? "" : student.juryLesson1}
                                                                        onChange={(e) => updateStudentField(student.id, "juryLesson1", e.target.value)}
                                                                        className="h-8 w-24 text-xs font-bold text-center"
                                                                        placeholder="/50"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <Input
                                                                        type="number"
                                                                        max="50"
                                                                        min="0"
                                                                        value={student.juryLesson2 === null ? "" : student.juryLesson2}
                                                                        onChange={(e) => updateStudentField(student.id, "juryLesson2", e.target.value)}
                                                                        className="h-8 w-24 text-xs font-bold text-center"
                                                                        placeholder="/50"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <Input
                                                                        type="number"
                                                                        max="50"
                                                                        min="0"
                                                                        value={student.jurySchoolScore === null ? "" : student.jurySchoolScore}
                                                                        onChange={(e) => updateStudentField(student.id, "jurySchoolScore", e.target.value)}
                                                                        className="h-8 w-24 text-xs font-bold text-center"
                                                                        placeholder="/50"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <Input
                                                                        type="number"
                                                                        max="50"
                                                                        min="0"
                                                                        value={student.juryExamScore === null ? "" : student.juryExamScore}
                                                                        onChange={(e) => updateStudentField(student.id, "juryExamScore", e.target.value)}
                                                                        className="h-8 w-24 text-xs font-bold text-center"
                                                                        placeholder="/50"
                                                                    />
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <td className="py-3 px-4 text-xs text-muted-foreground italic">
                                                                Cette classe ne comporte aucun examen officiel.
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: Délibération de Repêchage */}
                            {activeConsoleTab === "repechage" && (
                                <div className="space-y-6">
                                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex gap-3 text-xs">
                                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-bold mb-1">Workflow de Repêchage automatique</p>
                                            <p className="text-muted-foreground leading-relaxed">
                                                Le tableau ci-dessous liste uniquement les cours dont la moyenne annuelle de l'élève est inférieure à 50%.
                                                Cochez les matières que l'élève devra obligatoirement repêcher. Les enseignants concernés recevront une notification
                                                pour saisir les cotes de la période `REP` (Repêchage).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-border/30 text-[10px] uppercase text-muted-foreground font-black tracking-wider">
                                                    <th className="pb-3 pr-4 font-black">Élève</th>
                                                    <th className="pb-3 px-4 font-black">Matières en Échec (Moyenne &lt; 50%)</th>
                                                    <th className="pb-3 pl-4 font-black">Sélectionnées pour Repêchage</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/20">
                                                {detailsStudents.map(student => (
                                                    <tr key={student.id} className="hover:bg-muted/5 transition-colors">
                                                        <td className="py-3 pr-4">
                                                            <div className="font-semibold text-sm">{student.lastName} {student.firstName}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase">{student.matricule}</div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {student.failingCourses?.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {student.failingCourses.map((fc: any) => (
                                                                        <Badge key={fc.courseName} variant="outline" className="text-[10px] font-bold border-rose-200 bg-rose-50/50 text-rose-700">
                                                                            {fc.courseName} ({fc.average}%)
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs font-bold text-emerald-600">Aucun échec (Passage direct !)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 pl-4">
                                                            {student.failingCourses?.length > 0 ? (
                                                                <div className="flex flex-wrap gap-3">
                                                                    {student.failingCourses.map((fc: any) => {
                                                                        const isSelected = student.repechageCourses?.includes(fc.courseName);
                                                                        return (
                                                                            <label key={fc.courseName} className="flex items-center gap-1.5 cursor-pointer select-none">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isSelected}
                                                                                    onChange={(e) => {
                                                                                        const isChecked = e.target.checked;
                                                                                        let current = [...(student.repechageCourses || [])];
                                                                                        if (isChecked) {
                                                                                            if (!current.includes(fc.courseName)) current.push(fc.courseName);
                                                                                        } else {
                                                                                            current = current.filter(c => c !== fc.courseName);
                                                                                        }
                                                                                        updateStudentField(student.id, "repechageCourses", current);
                                                                                    }}
                                                                                    className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                                                />
                                                                                <span className="text-xs font-bold">{fc.courseName}</span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: Délibération de Fin d'Année — Nouvelle logique AnnualDecision */}
                            {activeConsoleTab === "endyear" && (
                                <div className="space-y-6">
                                    {/* Stats banner */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                        {[
                                            { label: "Total", value: annualDecisionStats.total, color: "bg-blue-50 text-blue-700 border-blue-200" },
                                            { label: "Promus", value: annualDecisionStats.promus, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                                            { label: "Maintenus", value: annualDecisionStats.maintenus, color: "bg-amber-50 text-amber-700 border-amber-200" },
                                            { label: "Démis", value: annualDecisionStats.demis, color: "bg-orange-50 text-orange-700 border-orange-200" },
                                            { label: "Exclus", value: annualDecisionStats.exclus, color: "bg-rose-50 text-rose-700 border-rose-200" },
                                        ].map(stat => (
                                            <div key={stat.label} className={cn("rounded-xl border p-3 text-center", stat.color)}>
                                                <div className="text-2xl font-black">{stat.value}</div>
                                                <div className="text-xs font-bold uppercase opacity-70">{stat.label}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Closure banner */}
                                    {annualClosure ? (
                                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-bold text-emerald-800 text-sm">Local clôturé pour l'année</p>
                                                <p className="text-xs text-emerald-700">Clôturé le {new Date(annualClosure.closedAt).toLocaleDateString('fr-FR')}. Les décisions sont verrouillées.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                                            <div className="flex-1">
                                                <p className="font-bold text-amber-800 text-sm">Local non clôturé</p>
                                                <p className="text-xs text-amber-700">
                                                    {annualDecisionStats.allHaveDecisions
                                                        ? "Tous les élèves ont une décision. Vous pouvez clôturer ce local."
                                                        : `${annualDecisionStats.total - annualDecisionStats.withDecision} élève(s) sans décision.`
                                                    }
                                                </p>
                                            </div>
                                            {annualDecisionStats.allHaveDecisions && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => setShowClosureConfirm(true)}
                                                    className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1 flex-shrink-0"
                                                >
                                                    <LockKeyhole className="h-3.5 w-3.5" />
                                                    Clôturer le local
                                                </Button>
                                            )}
                                        </div>
                                    )}

                                    {/* Student decisions table */}
                                    {annualLoading ? (
                                        <div className="flex py-10 justify-center items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-border/30 text-[10px] uppercase text-muted-foreground font-black tracking-wider">
                                                        <th className="pb-3 pr-4 font-black">Élève</th>
                                                        <th className="pb-3 px-4 font-black">Classe Nominale Actuelle</th>
                                                        <th className="pb-3 px-4 font-black">Décision Annuelle</th>
                                                        <th className="pb-3 px-4 font-black">Classe Nominale Destination</th>
                                                        <th className="pb-3 px-4 font-black text-center">Statut</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/20">
                                                    {annualStudents.map(student => {
                                                        const dec = annualDecisionsMap[student.id];
                                                        const isLocked = !!annualClosure;
                                                        return (
                                                            <tr key={student.id} className="hover:bg-muted/5 transition-colors">
                                                                <td className="py-3 pr-4">
                                                                    <div className="font-semibold text-sm">{student.lastName} {student.firstName}</div>
                                                                    <div className="text-[10px] text-muted-foreground uppercase">{student.matricule}</div>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    <Badge variant="outline" className="font-bold text-xs">{student.gradeName}</Badge>
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    {isLocked ? (
                                                                        <Badge className={cn("font-bold text-xs",
                                                                            dec?.decision === 'PROMU' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                            dec?.decision === 'MAINTENU' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                            dec?.decision === 'DEMIS' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                                            'bg-rose-100 text-rose-700 border-rose-200'
                                                                        )}>
                                                                            {dec?.decision || '—'}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Select
                                                                            value={dec?.decision || "none_val"}
                                                                            onValueChange={(val) => updateAnnualDecision(student.id, val === 'none_val' ? '' : val)}
                                                                        >
                                                                            <SelectTrigger className={cn("h-8 w-36 text-xs font-bold",
                                                                                dec?.decision === 'PROMU' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                                                                dec?.decision === 'MAINTENU' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                                                                                dec?.decision === 'DEMIS' ? 'border-orange-300 bg-orange-50 text-orange-700' :
                                                                                dec?.decision ? 'border-rose-300 bg-rose-50 text-rose-700' : ''
                                                                            )}>
                                                                                <SelectValue placeholder="Choisir..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="none_val">— Aucune —</SelectItem>
                                                                                <SelectItem value="PROMU" className="text-emerald-700 font-bold">✓ Promu(e)</SelectItem>
                                                                                <SelectItem value="MAINTENU" className="text-amber-700 font-bold">↺ Maintenu(e)</SelectItem>
                                                                                <SelectItem value="DEMIS" className="text-orange-700 font-bold">↓ Démis(e)</SelectItem>
                                                                                <SelectItem value="EXCLU" className="text-rose-700 font-bold">✕ Exclu(e)</SelectItem>
                                                                                <SelectItem value="RETIRE" className="text-gray-600 font-bold">→ Retiré(e)</SelectItem>
                                                                                {finalDecisionsConfig.filter(d => !['PROMU','MAINTENU','DEMIS','EXCLU','RETIRE'].includes(d)).map(d => (
                                                                                    <SelectItem key={d} value={d} className="font-bold text-xs">{d}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4">
                                                                    {isLocked ? (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {dec?.targetGradeId ? annualGrades.find((g: any) => g.id === dec.targetGradeId)?.name || '—' : '—'}
                                                                        </span>
                                                                    ) : (
                                                                        dec?.decision && !['EXCLU', 'RETIRE'].includes(dec.decision) ? (
                                                                            <Select
                                                                                value={dec?.targetGradeId || "auto"}
                                                                                onValueChange={(val) => updateAnnualDecision(student.id, dec.decision, val === 'auto' ? '' : val)}
                                                                            >
                                                                                <SelectTrigger className="h-8 w-44 text-xs font-bold">
                                                                                    <SelectValue placeholder="Sélectionner..." />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="auto" className="text-xs italic text-muted-foreground">Automatique</SelectItem>
                                                                                    {annualGrades.map((g: any) => (
                                                                                        <SelectItem key={g.id} value={g.id} className="font-bold text-xs">{g.name}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        ) : (
                                                                            <span className="text-xs text-muted-foreground italic">—</span>
                                                                        )
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 text-center">
                                                                    {dec?.decision ? (
                                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                                                                    ) : (
                                                                        <XCircle className="h-4 w-4 text-rose-400 mx-auto" />
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Annual Closure Confirmation Dialog */}
        <AlertDialog open={showClosureConfirm} onOpenChange={setShowClosureConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <LockKeyhole className="h-5 w-5 text-amber-600" />
                        Confirmer la clôture du local
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                        <p>Vous êtes sur le point de clôturer le local <strong>{classroomName}</strong> pour l'année scolaire en cours.</p>
                        <p className="text-amber-700 font-medium">Cette action verrouillera les décisions de fin d'année pour tous les élèves de ce local. Elle est irréversible sans intervention de l'administrateur système.</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={closingAnnual}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleAnnualClosure}
                        disabled={closingAnnual}
                        className="bg-amber-600 hover:bg-amber-700"
                    >
                        {closingAnnual ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LockKeyhole className="h-4 w-4 mr-2" />}
                        Confirmer la clôture
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}

