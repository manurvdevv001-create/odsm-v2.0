"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, Pencil, Trash2, Calculator, TrendingUp, Scale, BookOpen, FileText, Users, Loader2, AlertCircle, Send, History, CheckCircle2, PauseCircle, PlayCircle, Grid3X3 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, matchTeacherName } from "@/lib/utils";

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { schoolData, user, isLoading, yearState } = useSchoolData();
    const [assessments, setAssessments] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [periods, setPeriods] = useState<any[]>([]);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("all");
    const [isClosed, setIsClosed] = useState(false);
    const [closureData, setClosureData] = useState<any>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [publishingId, setPublishingId] = useState<string | null>(null);

    // Contextual lock based on yearState
    const isYearLocked = yearState !== "active";
    const effectiveIsClosed = isClosed || isYearLocked;

    const courseId = params.courseId as string;

    const assignedCourses = useMemo(() => {
        try {
            return JSON.parse(user?.profile?.assignedCourses || "[]");
        } catch {
            return [];
        }
    }, [user]);

    const activePeriod = useMemo(() => {
        const rawLevel = user?.profile?.level?.toLowerCase() || "";
        const level = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        if (!schoolData?.calendar || !level) return null;
        const levelCalendar = (schoolData.calendar as any)[level];
        if (!levelCalendar?.periods) return null;
        const periods = levelCalendar.periods as any[];
        let active = periods.find((p: any) => p.isActive);
        if (!active) {
            const today = new Date().toISOString().split('T')[0];
            active = periods.find((p: any) => p.startDate && p.endDate && today >= p.startDate && today <= p.endDate);
        }
        return active;
    }, [schoolData, user]);

    useEffect(() => {
        const fetchPeriods = async () => {
            if (!schoolData?.matricule) return;
            try {
                const rawLevel = user?.profile?.level?.toLowerCase() || "secondaire";
                const level = rawLevel.includes("primaire") ? "primaire" : rawLevel;
                const res = await fetch(`/api/school/periods?matricule=${schoolData.matricule}&level=${level}`);
                if (res.ok) {
                    const data = await res.json();
                    setPeriods(data);
                    const active = data.find((p: any) => p.isActive);
                        if (active) setSelectedPeriodId(active.id);
                    else if (data.length > 0) setSelectedPeriodId(data[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch periods");
            }
        };
        fetchPeriods();
    }, [schoolData?.matricule, user?.profile?.level, activePeriod]);

    const isExamPeriod = activePeriod?.type === 'exam';
    const selectedPeriod = periods.find(period => period.id === selectedPeriodId);
    const isActiveSelectedPeriod = !!selectedPeriod?.isActive || selectedPeriod?.id === activePeriod?.id;
    const isReadOnlyPeriod = selectedPeriodId !== "all" && !isActiveSelectedPeriod;

    const courseInfo = useMemo(() => {
        if (!courseId || !schoolData) return null;
        const timetables = schoolData.timetables || {};
        const teacherProfileName = user?.name || "";
        const decodedCourseId = decodeURIComponent(courseId);
        
        const flattened: any[] = [];
        const addCourseToFlattened = (course: any) => {
            if (!flattened.some(f => f.id === course.id)) {
                flattened.push(course);
            }
        };

        assignedCourses.forEach((assignment: any) => {
            if (typeof assignment === 'object' && assignment !== null) {
                const classroomId = assignment.classroom || "Non assigné";
                (assignment.courses || []).forEach((courseName: string) => {
                    const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                    addCourseToFlattened({
                        name: courseName,
                        classroom: classroomId,
                        classroomName: cName,
                        grade: (assignment.grade || cName.split(' ')[0] || "").toUpperCase(),
                        id: `${classroomId}-${courseName}`.replace(/\s+/g, '-')
                    });
                });
            }
        });

        Object.entries(timetables).forEach(([classroomId, slots]: [string, any]) => {
            Object.values(slots || {}).forEach((slot: any) => {
                const sCourse = slot.course;
                if (sCourse && matchTeacherName(teacherProfileName, slot.teacher)) {
                    const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                    addCourseToFlattened({
                        name: sCourse,
                        classroom: classroomId,
                        classroomName: cName,
                        grade: (cName.split(' ')[0] || "").toUpperCase(),
                        id: `${classroomId}-${sCourse}`.replace(/\s+/g, '-')
                    });
                }
            });
        });

        const roleLevel = user?.profile?.level?.toLowerCase() || "";
        const isTitulaire = roleLevel === "primaire" || roleLevel === "maternelle" || roleLevel === "primaire/maternelle";
        const titulaireClassroom = user?.profile?.assignedClassroom ? String(user.profile.assignedClassroom) : "";

        if (isTitulaire && titulaireClassroom) {
            const classroomSlots = (timetables as Record<string, any>)[titulaireClassroom] || {};
            // Get the display name from schoolData.classrooms if available
            const classroomName = schoolData?.classrooms?.find((c: any) => c.id === titulaireClassroom)?.name || titulaireClassroom;
            const grade = (classroomName.split(' ')[0] || "").toUpperCase();

            Object.values(classroomSlots).forEach((slot: any) => {
                if (slot.course) {
                    addCourseToFlattened({
                        name: slot.course,
                        classroom: titulaireClassroom,
                        classroomName: classroomName,
                        grade: grade,
                        id: `${titulaireClassroom}-${slot.course}`.replace(/\s+/g, '-')
                    });
                }
            });
        }

        const match = flattened.find(c => c.id === courseId || c.id === decodedCourseId || c.id === decodedCourseId.replace(/\s+/g, '-'));

        if (match) {
            const coursesObj = schoolData?.courses as any || {};
            const normalizeGrade = (g: string) => {
                if (!g) return "";
                let norm = g.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
                norm = norm.replace(/([2-9])eme/g, '$1e');
                norm = norm.replace(/education de base/g, 'cteb');
                return norm.replace(/\s+/g, ' ');
            };
            const matchNameStr = match.name.trim().toLowerCase();
            const classroomStr = normalizeGrade(match.classroom);

            const gradeKey = Object.keys(coursesObj).find(k => {
                const kLower = normalizeGrade(k);
                return kLower === classroomStr;
            }) || Object.keys(coursesObj).find(k => {
                const kLower = normalizeGrade(k);
                return classroomStr.startsWith(kLower) || kLower.startsWith(classroomStr);
            });
            
            let courseDetail = null;
            if (gradeKey) {
                const gradeCourses = coursesObj[gradeKey];
                if (Array.isArray(gradeCourses)) {
                    courseDetail = gradeCourses.find((c: any) => c.name?.trim().toLowerCase() === matchNameStr);
                }
            }

            if (!courseDetail || (!courseDetail.domaine && !courseDetail.max && !courseDetail.maxPoints)) {
                for (const gKey of Object.keys(coursesObj)) {
                    const gradeCourses = coursesObj[gKey];
                    if (Array.isArray(gradeCourses)) {
                        const found = gradeCourses.find((c: any) => c.name?.trim().toLowerCase() === matchNameStr);
                        if (found && (found.domaine || found.max || found.maxPoints)) {
                            courseDetail = found;
                            break;
                        }
                    }
                }
            }

            const baseMaxPoints = courseDetail?.maxPoints ?? courseDetail?.max ?? 20;

            return {
                ...match,
                maxPoints: baseMaxPoints,
                domaine: courseDetail?.domaine,
                weightedMax: baseMaxPoints * (isExamPeriod ? 2 : 1)
            };
        }

        return null;
    }, [courseId, schoolData, user, assignedCourses, isExamPeriod]);

    const baseMax = useMemo(() => {
        return courseInfo?.weightedMax || 20;
    }, [courseInfo]);

    const fetchAssessments = useCallback(async () => {
        if (!courseId || !courseInfo?.classroom) return;
        setIsFetching(true);
        try {
            let url = `/api/teacher/grades?courseId=${courseId}&classroomId=${courseInfo.classroom}&matricule=${schoolData?.matricule}`;
            if (selectedPeriodId && selectedPeriodId !== "all") {
                url += `&periodId=${selectedPeriodId}`;
            }
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setAssessments(data.assessments || []);
                setIsClosed(data.isClosed || false);
                setClosureData(data.closure || null);
            }
        } catch (error) {
            console.error("Failed to fetch assessments");
        } finally {
            setIsFetching(false);
        }
    }, [courseId, courseInfo?.classroom, schoolData?.matricule, selectedPeriodId]);

    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    const handleDelete = async (assessmentId: string, title: string) => {
        if (effectiveIsClosed || isReadOnlyPeriod) {
            toast.error(isReadOnlyPeriod ? "Cette période est en lecture seule." : "Cette période est clôturée.");
            return;
        }
        try {
            const res = await fetch(`/api/teacher/grades?assessmentId=${assessmentId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success(`Épreuve "${title}" supprimée avec succès.`);
                fetchAssessments();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la suppression.");
            }
        } catch {
            toast.error("Erreur réseau lors de la suppression.");
        }
    };

    const handleToggleSuspend = async (assessmentId: string, currentStatus: boolean, title: string) => {
        if (effectiveIsClosed || isReadOnlyPeriod) {
            toast.error(isReadOnlyPeriod ? "Cette période est en lecture seule." : "Cette période est clôturée.");
            return;
        }
        try {
            const res = await fetch('/api/teacher/grades', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assessmentId, isSuspended: !currentStatus })
            });
            if (res.ok) {
                toast.success(`Épreuve "${title}" ${!currentStatus ? 'suspendue' : 'réactivée'}.`);
                fetchAssessments();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la modification du statut.");
            }
        } catch {
            toast.error("Erreur réseau.");
        }
    };

    const handlePublishAction = async (assessmentId: string, action: "PUBLISH" | "REVERT") => {
        setPublishingId(assessmentId);
        try {
            const res = await fetch("/api/teacher/grades/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assessmentId, action })
            });

            if (res.ok) {
                if (action === "PUBLISH") toast.success("Résultats publiés avec succès !");
                else if (action === "REVERT") toast.success("Retour aux résultats précédents effectué.");
                fetchAssessments();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la publication.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setPublishingId(null);
        }
    };

    const hasUnpublishedOrModifed = useMemo(() => {
        return assessments.some(a => !a.isPublished || a.hasPendingChanges);
    }, [assessments]);

    const handleClosePeriod = async () => {
        if (!selectedPeriodId || selectedPeriodId === "all" || isClosed || isReadOnlyPeriod || !isActiveSelectedPeriod) return;
        setIsClosing(true);
        try {
            const res = await fetch('/api/teacher/grades/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periodId: selectedPeriodId,
                    courseId: courseId,
                    classroomId: courseInfo.classroom,
                    teacherId: user?.id,
                    schoolMatricule: schoolData?.matricule,
                    data: assessments.map(a => ({ id: a.id, title: a.title }))
                })
            });
            if (res.ok) {
                toast.success("Période clôturée et transmise au Titulaire.");
                setIsClosed(true);
                fetchAssessments();
            } else {
                const err = await res.json();
                toast.error(`${err.error} - ${err.details ? JSON.stringify(err.details) : ''}`);
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setIsClosing(false);
        }
    };

    if (isLoading) return null;

    if (!courseInfo) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="p-4 rounded-2xl bg-muted/50">
                    <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <h2 className="text-xl font-bold">Cours introuvable</h2>
                <Button onClick={() => router.back()} className="gradient-btn rounded-xl px-6">Retour</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">{courseInfo.name}</h1>
                            {(effectiveIsClosed || isReadOnlyPeriod) && (
                                <Badge className={cn("bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none gap-1.5 py-1 px-3 font-bold", (isYearLocked || isReadOnlyPeriod) && "bg-amber-500/10 text-amber-600")}>
                                    {isYearLocked || isReadOnlyPeriod ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                                    {isYearLocked ? "ANNÉE EN LECTURE SEULE" : isReadOnlyPeriod ? "PÉRIODE EN LECTURE SEULE" : "PÉRIODE CLÔTURÉE"}
                                </Badge>
                            )}
                        </div>
                        <p className="text-muted-foreground font-medium uppercase text-sm mt-0.5">
                            {courseInfo.classroomName || courseInfo.classroom} — {courseInfo.domaine || "Branche principale"}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/teacher/courses/${courseId}/aggregates?classroom=${courseInfo.classroom}&courseName=${courseInfo.name}`}>
                        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50 hover:bg-muted/50">
                            <TrendingUp className="h-4 w-4" /> Agregats
                        </Button>
                    </Link>
                    <Link href={`/teacher/courses/${courseId}/grid?classroom=${courseInfo.classroom}&courseName=${courseInfo.name}&periodId=${selectedPeriodId}`}>
                        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-primary/20 hover:bg-primary/5">
                            <Grid3X3 className="h-4 w-4 text-primary" /> Grille
                        </Button>
                    </Link>
                    <Link href={`/teacher/courses/${courseId}/weights?classroom=${courseInfo.classroom}&courseName=${courseInfo.name}&periodId=${selectedPeriodId}`}>
                        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-border/50" disabled={effectiveIsClosed}>
                            <Scale className="h-4 w-4" /> Pondérations
                        </Button>
                    </Link>
                    <Link href={`/teacher/courses/${courseId}/totals?classroom=${courseInfo.classroom}&courseName=${courseInfo.name}&periodId=${selectedPeriodId}`}>
                        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-primary/20 hover:bg-primary/5">
                            <Calculator className="h-4 w-4 text-primary" /> Totaux
                        </Button>
                    </Link>
                    <Link href={effectiveIsClosed || isReadOnlyPeriod ? '#' : `/teacher/assessments/new?courseId=${courseId}&periodId=${selectedPeriodId}`} className={effectiveIsClosed || isReadOnlyPeriod ? 'pointer-events-none' : ''}>
                        <button className={cn("gradient-btn gap-2 font-bold px-5 py-2 rounded-xl text-sm flex items-center", (effectiveIsClosed || isReadOnlyPeriod) && "opacity-50 cursor-not-allowed")} disabled={effectiveIsClosed || isReadOnlyPeriod}>
                            <Plus className="h-4 w-4" />
                            {effectiveIsClosed ? 'Verrouillé' : 'Nouvelle Épreuve'}
                        </button>
                    </Link>
                    
                    {selectedPeriodId !== "all" && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant={effectiveIsClosed ? "outline" : "destructive"} 
                                    size="sm"
                                    className={cn("rounded-xl gap-2 font-bold", !effectiveIsClosed && "bg-amber-600 hover:bg-amber-700 border-none")}
                                    disabled={effectiveIsClosed || isReadOnlyPeriod || !isActiveSelectedPeriod}
                                >
                                    {effectiveIsClosed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Send className="h-4 w-4" />}
                                    {effectiveIsClosed ? "Clôturée" : "Clôturer"}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="flex items-center gap-2">
                                        <AlertCircle className="h-5 w-5 text-amber-600" />
                                        Confirmation de Clôture
                                    </AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                        <div>
                                            Voulez-vous clôturer la période <strong>{periods.find(p => p.id === selectedPeriodId)?.name}</strong> ? 
                                            <br /><br />
                                            Cette action est <strong>IRRÉVERSIBLE</strong> :
                                            <ul className="list-disc ml-6 mt-2 space-y-1">
                                                <li>Toutes les épreuves seront verrouillées.</li>
                                                <li>Vous ne pourrez plus modifier les notes ou ajouter d'épreuves.</li>
                                                <li>Les totaux seront officiellement transmis au Titulaire de classe.</li>
                                            </ul>
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handleClosePeriod}
                                        className="bg-amber-600 hover:bg-amber-700 rounded-xl"
                                        disabled={isClosing}
                                    >
                                        {isClosing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Confirmer la Clôture
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </div>

            {/* Warning Banner */}
            {hasUnpublishedOrModifed && (
                <div className="glass-card p-4 flex items-start gap-3 bg-amber-500/5 dark:bg-amber-500/10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Actions de publication requises</p>
                        <p className="text-xs text-amber-700/70 dark:text-amber-400/60 mt-0.5">
                            Certaines épreuves ont des modifications non publiées. Cliquez sur <strong>Modifier</strong> pour publier.
                        </p>
                    </div>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div className="stat-card flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/8">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Épreuves</p>
                        <p className="text-2xl font-black">{assessments.length}</p>
                    </div>
                </div>
                <div className="stat-card flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-emerald-500/8">
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Moyenne</p>
                        <p className="text-2xl font-black">-- / --</p>
                    </div>
                </div>
                <div className="stat-card flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/8">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Effectif</p>
                        <p className="text-2xl font-black">-- Élèves</p>
                    </div>
                </div>
            </div>

            {/* Period Selector */}
            <div className="flex justify-between items-center pt-4 flex-wrap gap-4">
                <h2 className="text-lg font-extrabold">Cahier des côtes : Épreuves</h2>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Période:</span>
                    <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                        <SelectTrigger className="w-[200px] h-9 rounded-xl border-border/50 bg-background text-sm">
                            <SelectValue placeholder="Toutes les périodes" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">Toutes les périodes</SelectItem>
                            {periods.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Assessment Table */}
            <div className="glass-card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <Table className="tonal-table">
                        <TableHeader>
                            <TableRow className="tonal-surface-raised hover:bg-transparent">
                                <TableHead className="text-xs font-extrabold uppercase">Titre</TableHead>
                                <TableHead className="text-xs font-extrabold uppercase">Type</TableHead>
                                <TableHead className="text-xs font-extrabold uppercase hidden sm:table-cell">Date</TableHead>
                                <TableHead className="text-center text-xs font-extrabold uppercase">Max</TableHead>
                                <TableHead className="text-center text-xs font-extrabold uppercase hidden sm:table-cell">Pond.</TableHead>
                                <TableHead className="text-center text-xs font-extrabold uppercase">Statut</TableHead>
                                <TableHead className="text-right text-xs font-extrabold uppercase">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isFetching ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                                    </TableCell>
                                </TableRow>
                            ) : assessments.length > 0 ? (
                                assessments.map((assessment) => (
                                    <TableRow key={assessment.id} className={cn("border-none", assessment.isSuspended && "opacity-50")}>
                                        <TableCell className="font-bold text-sm">
                                            {assessment.title}
                                            {assessment.results?.some((r: any) => r.isAbsent) && <span className="text-red-500 ml-1 font-black">*</span>}
                                            {assessment.isSuspended && (
                                                <Badge className="ml-2 text-[10px] bg-muted text-muted-foreground border-none">Suspendue</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="text-[10px] uppercase font-extrabold tracking-widest bg-muted text-muted-foreground border-none">
                                                {assessment.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                            {new Date(assessment.date).toLocaleDateString('fr-FR')}
                                        </TableCell>
                                        <TableCell className="text-center font-bold">{assessment.maxScore}</TableCell>
                                        <TableCell className="text-center hidden sm:table-cell">
                                            <span className={cn("font-semibold", assessment.pondere && assessment.pondere !== assessment.maxScore ? 'text-primary' : 'text-muted-foreground')}>
                                                {assessment.pondere ?? assessment.maxScore}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!assessment.isPublished ? (
                                                <Badge className="bg-muted text-muted-foreground border-none gap-1 text-[10px]">
                                                    <History className="h-3 w-3" /> Brouillon
                                                </Badge>
                                            ) : assessment.hasPendingChanges ? (
                                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none gap-1 text-[10px]">
                                                    <Send className="h-3 w-3" /> Modifié
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none gap-1 text-[10px]">
                                                    <CheckCircle2 className="h-3 w-3" /> Publié
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {(!assessment.isPublished || assessment.hasPendingChanges) && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className={cn("gap-1 text-xs rounded-lg h-8", assessment.hasPendingChanges ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50")}
                                                                disabled={effectiveIsClosed || publishingId === assessment.id}
                                                            >
                                                                {publishingId === assessment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                                                {assessment.hasPendingChanges ? "Mettre à jour" : "Publier"}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="rounded-2xl">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmation de publication</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    {!assessment.isPublished ? (
                                                                        "Cette action rendra les résultats officiels et les comptabilisera dans la vue panoramique et les totaux."
                                                                    ) : (
                                                                        "Des modifications ont été détectées. Voulez-vous mettre à jour la publication officielle ou annuler vos changements ?"
                                                                    )}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <div className="grid gap-3 py-4">
                                                                <Button 
                                                                    variant="default" 
                                                                    className="justify-start gap-3 h-12 bg-emerald-600 hover:bg-emerald-700" 
                                                                    onClick={() => handlePublishAction(assessment.id, "PUBLISH")}
                                                                    disabled={publishingId === assessment.id}
                                                                >
                                                                    <Send className="h-4 w-4" />
                                                                    <span>{!assessment.isPublished ? "Publier maintenant" : "Publier les nouveaux changements"}</span>
                                                                </Button>
                                                                
                                                                {assessment.isPublished && assessment.hasPendingChanges && (
                                                                    <Button 
                                                                        variant="outline" 
                                                                        className="justify-start gap-3 h-12 text-destructive border-destructive/20 hover:bg-destructive/5"
                                                                        onClick={() => handlePublishAction(assessment.id, "REVERT")}
                                                                        disabled={publishingId === assessment.id}
                                                                    >
                                                                        <History className="h-4 w-4" />
                                                                        <span>Revenir aux résultats précédents</span>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="rounded-xl">Fermer</AlertDialogCancel>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                                <Button 
                                                    variant="ghost" size="sm" className="gap-1 text-xs rounded-lg h-8"
                                                    disabled={effectiveIsClosed}
                                                    onClick={() => handleToggleSuspend(assessment.id, assessment.isSuspended, assessment.title)}
                                                >
                                                    {assessment.isSuspended ? <><PlayCircle className="h-3.5 w-3.5" /> Réactiver</> : <><PauseCircle className="h-3.5 w-3.5" /> Suspendre</>}
                                                </Button>
                                                <Link href={effectiveIsClosed ? '#' : `/teacher/assessments/new?courseId=${courseId}&editId=${assessment.id}`} className={effectiveIsClosed ? 'pointer-events-none' : ''}>
                                                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-primary hover:text-primary rounded-lg h-8" disabled={effectiveIsClosed}>
                                                        <Pencil className="h-3.5 w-3.5" /> Modifier
                                                    </Button>
                                                </Link>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg h-8" disabled={effectiveIsClosed}>
                                                            <Trash2 className="h-3.5 w-3.5" /> Supprimer
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="rounded-2xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Voulez-vous vraiment supprimer l&apos;épreuve <strong>&quot;{assessment.title}&quot;</strong> ?
                                                                Cette action est irréversible.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(assessment.id, assessment.title)}
                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                                                            >
                                                                Supprimer
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic border-none">
                                        Aucune épreuve enregistrée pour ce cours.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
