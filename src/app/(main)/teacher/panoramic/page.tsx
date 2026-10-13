"use client";

import { useEffect, useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    Search, 
    Plus, 
    ChevronRight, 
    TrendingUp, 
    Users, 
    BookOpen,
    Loader2,
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    Lock,
    Unlock,
    Calculator,
    AlertCircle,
    Send,
    FileSpreadsheet
} from "lucide-react";
import { SmartStudentName } from "@/components/ui/SmartStudentName";
import { useStudentDisplay } from "@/components/providers/StudentDisplayProvider";
import { Input } from "@/components/ui/input";
import { getInitials, cn } from "@/lib/utils";
import { classroomNamesMatch } from "@/lib/classroom-utils";
import Link from "next/link";
import { toast } from "sonner";
import { PageHelp } from "@/components/page-help";

// Grade result for a single course per student
interface CourseGradeResult {
    score: number;       // Weighted score scaled to baseMax (e.g. 13.6/40)
    hasAbsence: boolean; // True if any assessment has an absence
    isClosed: boolean;   // True if the gradebook is closed
}

export default function PanoramicViewPage() {
    const { schoolData, user, isLoading } = useSchoolData();
    const { globalDisplayMode, setGlobalDisplayMode } = useStudentDisplay();
    const [searchTerm, setSearchTerm] = useState("");
    const [classroomData, setClassroomData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isSimulationMode, setIsSimulationMode] = useState(false);

    const level = user?.profile?.level?.toLowerCase() || "";
    const isSecondary = level === "secondaire";

    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = useMemo(() => {
        if (!rawClassroomId) return "";
        return (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId;
    }, [rawClassroomId, schoolData]);
    
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({
        key: 'name',
        direction: 'asc'
    });

    const [isUnlocking, setIsUnlocking] = useState<string | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    useEffect(() => {
        if (!isLoading && user && assignedClassroomName && schoolData) {
            const classroom = (schoolData.structure as any)?.classrooms?.find(
                (c: any) => c.name === assignedClassroomName
            );
            
            const students = (schoolData.students as any[])?.filter(
                (s: any) => s.classroomName === assignedClassroomName
            ) || [];

            setClassroomData({
                ...classroom,
                students
            });
        }
    }, [isLoading, user, assignedClassroomName, schoolData]);

    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    const periods = useMemo(() => {
        const rawLevel = user?.profile?.level?.toLowerCase() || "";
        // Resolve the true calendar level from the assigned classroom name
        // to avoid mixing primaire/maternelle calendars.
        let calLevel = rawLevel;
        if (assignedClassroomName) {
            const cn = assignedClassroomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cn.includes("maternelle")) calLevel = "maternelle";
            else if (cn.includes("primaire")) calLevel = "primaire";
            else calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        } else {
            calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        }
        if (!schoolData?.calendar || !calLevel) return [];
        const levelCalendar = (schoolData.calendar as any)[calLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, user, assignedClassroomName]);

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

    const classroomCourses = useMemo(() => {
        if (!assignedClassroomName || !schoolData?.timetables) return [];
        const timetables = schoolData.timetables as Record<string, any>;
        const normalizeStr = (s: string) => {
            if (!s) return "";
            let norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
            norm = norm.replace(/([2-9])eme/g, '$1e');
            norm = norm.replace(/education de base/g, 'cteb');
            return norm.replace(/\s+/g, ' ');
        };
        // Use exact normalized key lookup to avoid cross-classroom contamination
        const slots = rawClassroomId && timetables[rawClassroomId] ? timetables[rawClassroomId] : (timetables[assignedClassroomName] || {});
        const courseNames = new Set<string>();
        Object.values(slots).forEach((slot: any) => {
            if (slot.course) courseNames.add(slot.course);
        });
        
        const coursesObj = (schoolData?.courses as any) || {};
        // Resolve the classroom key in the course list robustly (case/accents differ:
        // e.g. "1ère Maternelle" vs "1ERE MATERNELLE", "7e CTEB" vs "7EME EDUCATION DE BASE")
        const gradeKey = Object.keys(coursesObj).find(k => classroomNamesMatch(k, assignedClassroomName));
        const gradeCourses = gradeKey ? (coursesObj[gradeKey] || []) : [];

        const normalize = (val: string) => {
            if (!val) return "";
            return val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
        };

        return Array.from(courseNames).map(name => {
            const normalizedName = normalize(name);
            const config = Array.isArray(gradeCourses) ? gradeCourses.find((c: any) => 
                normalize(c.name) === normalizedName || normalize(c.name).includes(normalizedName) || normalizedName.includes(normalize(c.name))
            ) : null;
            
            return {
                id: config?.id,
                name,
                baseMax: config?.maxPoints || config?.max || 20
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [assignedClassroomName, schoolData, rawClassroomId]);

    const [allAssessments, setAllAssessments] = useState<any[]>([]);
    
    useEffect(() => {
        const fetchSubmissionsAndGrades = async () => {
            if (!rawClassroomId || !schoolData?.matricule) return;
            setIsFetching(true);
            try {
                let url = `/api/teacher/grades?classroomId=${encodeURIComponent(rawClassroomId)}&matricule=${schoolData.matricule}`;
                if (displayPeriod) {
                    url += `&periodId=${displayPeriod.id}`;
                }
                const resGrades = await fetch(url);
                if (resGrades.ok) {
                    const data = await resGrades.json();
                    setAllAssessments(data.assessments || []);
                }

                const resSubs = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(rawClassroomId)}${displayPeriod?.id ? `&periodId=${displayPeriod.id}` : ""}&matricule=${schoolData.matricule}`);
                if (resSubs.ok) {
                    const dataSubs = await resSubs.json();
                    setSubmissions(dataSubs.submissions || []);
                }
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setIsFetching(false);
            }
        };
        fetchSubmissionsAndGrades();
    }, [assignedClassroomName, schoolData?.matricule, displayPeriod, isSecondary]);

    // ============================================================
    // CORE LOGIC: Build per-student, per-course grade objects
    // Each entry has { score, hasAbsence, isClosed }
    // ============================================================
    const studentGrades = useMemo(() => {
        const results: Record<string, Record<string, CourseGradeResult | null>> = {};
        
        classroomData?.students?.forEach((student: any) => {
            results[student.id] = {};
            classroomCourses.forEach(course => {
                const normalizeStr = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
                const targetCourseNorm = normalizeStr(course.name);

                // Find assessments for this course
                const courseAssessments = allAssessments.filter(a => {
                    const cName = normalizeStr(a.course?.name || "");
                    const cId = (a.courseId || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const isPub = a.isPublished === true || a.isPublished === 1 || String(a.isPublished) === "true";
                    if (!isPub) return false;
                    if (cName && cName === targetCourseNorm) return true;
                    if (cId && cId.includes(targetCourseNorm.replace(/\s+/g, '-'))) return true;
                    return false;
                });

                // Check closure status: Teacher (all levels) only sees closed grades in Panoramic view implicitly.
                const isClosed = submissions.some((s: any) => {
                    const subCourseNorm = normalizeStr(s.course?.name);
                    return (course.id && s.courseId === course.id) || subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
                });

                let totalEarned = 0;
                let totalPossible = 0;
                let hasAbsence = false;
                
                courseAssessments.forEach(ass => {
                    const result = ass.results?.find((r: any) => {
                        const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                    });

                    if (result) {
                        if (result.isAbsent) hasAbsence = true;
                        const pondere = Number(ass.pondere || ass.maxScore || 1);
                        const score = (Number(result.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                        totalEarned += score;
                        totalPossible += pondere;
                    } else if (!result) {
                        hasAbsence = true;
                    }
                });
                
                if (totalPossible > 0) {
                    // Scale to baseMax: e.g. 31/50 → 12.4/20 → stored as 12.4 with baseMax=20
                    const scaledScore = (totalEarned / totalPossible) * course.baseMax;
                    results[student.id][course.name] = {
                        score: scaledScore,
                        hasAbsence,
                        isClosed
                    };
                } else {
                    // No assessments found for this course -> null (no data)
                    results[student.id][course.name] = isClosed ? null : null;
                }
            });
        });
        
        return results;
    }, [classroomData?.students, classroomCourses, allAssessments, isSecondary, submissions]);

    const totalBaseMax = useMemo(() => {
        return classroomCourses.reduce((sum, c) => sum + (c.baseMax || 0), 0);
    }, [classroomCourses]);

    // ============================================================
    // AGGREGATION: Calculate totals per student based on mode
    // ============================================================
    const getStudentTotals = (studentId: string) => {
        const grades = studentGrades[studentId] || {};
        let normalTotal = 0;     // Sum of scores for courses WITHOUT absence
        let simulatedTotal = 0;  // Sum of ALL scores (absences treated as 0)
        let closedMax = 0;       // Sum of baseMax for closed courses
        let hasAnyAbsence = false;

        classroomCourses.forEach(course => {
            const g = grades[course.name];
            if (!g) return;        // No data at all
            if (!g.isClosed) return; // Skip open courses

            closedMax += course.baseMax;

            // Simulated: always add the score (absence = 0 was already factored in the grade grid)
            simulatedTotal += g.score;

            if (g.hasAbsence) {
                hasAnyAbsence = true;
                // Normal: this course is a "vide" → contributes 0
            } else {
                normalTotal += g.score;
            }
        });

        return { normalTotal, simulatedTotal, closedMax, hasAnyAbsence };
    };

    const filteredStudents = useMemo(() => {
        if (!classroomData?.students) return [];
        let students = classroomData.students.filter((s: any) => {
            const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase()) || 
                   s.matricule?.toLowerCase().includes(searchTerm.toLowerCase());
        });

        if (sortConfig.key && sortConfig.direction) {
            students.sort((a: any, b: any) => {
                let valA: any;
                let valB: any;

                if (sortConfig.key === 'name') {
                    valA = `${a.lastName} ${a.firstName}`.toLowerCase();
                    valB = `${b.lastName} ${b.firstName}`.toLowerCase();
                } else if (sortConfig.key === 'matricule') {
                    valA = a.matricule || '';
                    valB = b.matricule || '';
                    return sortConfig.direction === 'asc' 
                        ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                        : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
                } else if (sortConfig.key === 'total' || sortConfig.key === 'moyenne') {
                    const getVal = (id: string) => {
                        const t = getStudentTotals(id);
                        const earned = isSimulationMode ? t.simulatedTotal : t.normalTotal;
                        if (sortConfig.key === 'moyenne') {
                            const d = isSimulationMode ? t.closedMax : totalBaseMax;
                            return d > 0 ? (earned / d) * 100 : -1;
                        }
                        return earned;
                    };
                    valA = getVal(a.id);
                    valB = getVal(b.id);
                } else {
                    const gA = studentGrades[a.id]?.[sortConfig.key];
                    const gB = studentGrades[b.id]?.[sortConfig.key];
                    valA = gA ? (isSimulationMode ? gA.score : (gA.hasAbsence ? -1 : gA.score)) : -2;
                    valB = gB ? (isSimulationMode ? gB.score : (gB.hasAbsence ? -1 : gB.score)) : -2;
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return students;
    }, [classroomData, searchTerm, sortConfig, studentGrades, classroomCourses, isSimulationMode, totalBaseMax]);

    const globalAverage = useMemo(() => {
        if (!classroomData?.students?.length || !classroomCourses.length) return 0;
        let sum = 0;
        let count = 0;
        Object.keys(studentGrades).forEach(studentId => {
            const t = getStudentTotals(studentId);
            const earned = isSimulationMode ? t.simulatedTotal : t.normalTotal;
            const d = isSimulationMode ? t.closedMax : totalBaseMax;
            if (d > 0) {
                sum += (earned / d) * 100;
                count++;
            }
        });
        return count > 0 ? sum / count : 0;
    }, [studentGrades, classroomData?.students, classroomCourses, isSimulationMode, totalBaseMax]);

    if (isLoading || isFetching) {
        return (
            <div className="flex h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!assignedClassroomName) {
        return (
            <div className="glass-card py-20 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-xl">
                <Users className="h-16 w-16 text-primary/10 mb-6" />
                <h3 className="text-xl font-black text-foreground mb-2 uppercase italic tracking-tight">Aucun local assigné</h3>
                <p className="text-sm text-muted-foreground px-12 leading-relaxed">
                    Veuillez contacter l&apos;administration pour activer votre vue panoramique.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Header */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <div className="stat-card flex items-center gap-4 group">
                    <div className="p-3 rounded-2xl bg-primary/10 group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mb-0.5">Effectif</p>
                        <p className="text-2xl font-black leading-none">{classroomData?.students?.length || 0} Élèves</p>
                    </div>
                </div>

                <div className="stat-card flex items-center gap-4 group">
                    <div className="p-3 rounded-2xl bg-blue-500/10 group-hover:scale-110 transition-transform">
                        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mb-0.5">Moyenne Classe</p>
                        <p className="text-2xl font-black leading-none">{globalAverage.toFixed(1)}%</p>
                    </div>
                </div>

                <div className="stat-card flex items-center gap-4 sm:col-span-2 lg:col-span-1 group">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mb-0.5">Taux de Réussite</p>
                        <p className="text-2xl font-black leading-none">
                            {(() => {
                                const students = classroomData?.students || [];
                                if (!students.length) return "-- ";
                                let passing = 0;
                                students.forEach((s: any) => {
                                    const t = getStudentTotals(s.id);
                                    const earned = isSimulationMode ? t.simulatedTotal : t.normalTotal;
                                    const d = isSimulationMode ? t.closedMax : totalBaseMax;
                                    if (d > 0 && (earned / d) * 100 >= 50) passing++;
                                });
                                return ((passing / students.length) * 100).toFixed(0);
                            })()}%
                        </p>
                    </div>
                </div>
            </div>

            {/* Primary Teacher Navigation Actions */}
            {!isSecondary && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Link href="/teacher/performance">
                        <div className="glass-card glass-card-hover p-5 flex items-center gap-4 h-full">
                            <div className="p-3 rounded-xl bg-emerald-500/10">
                                <Send className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm mb-0.5">Performance Actuelle</h3>
                                <p className="text-xs text-muted-foreground">Consolidation & Palmarès Général</p>
                            </div>
                        </div>
                    </Link>
                    <Link href="/teacher/performance/bulletins">
                        <div className="glass-card glass-card-hover p-5 flex items-center gap-4 h-full">
                            <div className="p-3 rounded-xl bg-blue-500/10">
                                <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm mb-0.5 text-blue-600 dark:text-blue-400">Génération des bulletins</h3>
                                <p className="text-xs text-muted-foreground">Créer et imprimer les bulletins</p>
                            </div>
                        </div>
                    </Link>
                </div>
            )}

            {/* Table */}
            <div className="glass-card overflow-hidden p-0 border-none shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 tonal-surface-raised">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-extrabold uppercase tracking-tight">Palmarès Général : {assignedClassroomName}</h3>
                            <PageHelp pageId="panoramic" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground font-black uppercase">Période :</span>
                            <Select
                                value={selectedPeriodId || activePeriod?.id || ""}
                                onValueChange={(value) => setSelectedPeriodId(value === activePeriod?.id ? "" : value)}
                            >
                                <SelectTrigger className="h-6 w-auto border-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-none rounded-sm px-2 text-[10px] font-black uppercase focus:ring-0 focus:ring-offset-0">
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
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <Button 
                            variant={isSimulationMode ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "gap-2 rounded-xl transition-all font-bold h-9",
                                isSimulationMode ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm" : "border-border/40"
                            )}
                            onClick={() => setIsSimulationMode(!isSimulationMode)}
                        >
                            <Calculator className={cn("h-4 w-4", isSimulationMode && "animate-pulse")} />
                            {isSimulationMode ? "Simulation Active" : "Simulation"}
                        </Button>
                        <div className="flex items-center gap-1.5">
                            <Select 
                                value={globalDisplayMode} 
                                onValueChange={(v: any) => setGlobalDisplayMode(v)}
                            >
                                <SelectTrigger className="h-9 w-auto border border-border/40 bg-card rounded-xl px-3 text-xs font-semibold focus:ring-0">
                                    <SelectValue placeholder="Affichage" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="compact">Noms Courts</SelectItem>
                                    <SelectItem value="full">Noms Complets</SelectItem>
                                    <SelectItem value="id">Avec Matricule</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="h-8 w-[1px] bg-border/20 mx-1 hidden sm:block" />
                        <div className="relative flex-1 sm:flex-none sm:w-[200px]">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/30" />
                            <Input
                                placeholder="Filtrer..."
                                className="pl-9 h-9 w-full rounded-xl border-border/40"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Link href="/teacher/assessments/new">
                            <button className="gradient-btn gap-2 h-9 w-full sm:w-auto px-5 rounded-xl text-[10px] font-black flex items-center justify-center cursor-pointer shadow-md uppercase tracking-wide">
                                <Plus className="h-4 w-4" />
                                <span>Nouvelle</span>
                            </button>
                        </Link>
                    </div>
                </div>
                <div className="overflow-x-auto relative no-scrollbar">
                    <Table>
                        <TableHeader>
                            <TableRow className="tonal-surface-raised hover:bg-transparent border-none">
                                <TableHead className="min-w-[140px] md:w-[200px] sticky left-0 z-40 bg-[var(--surface-container)] font-black text-[10px] uppercase cursor-pointer" onClick={() => handleSort('name')}>
                                    Élève
                                    {sortConfig.key === 'name' ? (
                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />
                                    ) : <ArrowUpDown className="h-2 w-2 inline ml-1 opacity-20" />}
                                </TableHead>
                                {classroomCourses.map(course => (
                                    <TableHead key={course.name} className="text-center min-w-[80px] sm:min-w-[110px] px-2 py-4 border-none">
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] uppercase font-black" title={course.name}>{course.name}</span>
                                                {(() => {
                                                    const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
                                                    const targetCourseNorm = normalize(course.name);
                                                    const sub = submissions.find((s: any) => {
                                                        const subCourseNorm = normalize(s.course?.name);
                                                        return (course.id && s.courseId === course.id) || subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
                                                    });
                                                    
                                                    if (sub) {
                                                        return (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-4 w-4 ml-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (confirm(`Libérer ${course.name} ?`)) {
                                                                        setIsUnlocking(sub.id);
                                                                        fetch(`/api/teacher/grades/close/unlock?id=${sub.id}`, { method: 'DELETE' })
                                                                            .then(() => {
                                                                                setSubmissions(prev => prev.filter(x => x.id !== sub.id));
                                                                                toast.success(`${course.name} libéré.`);
                                                                            })
                                                                            .finally(() => setIsUnlocking(null));
                                                                    }
                                                                }}
                                                                disabled={isUnlocking === sub.id}
                                                            >
                                                                {isUnlocking === sub.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Unlock className="h-2.5 w-2.5" />}
                                                            </Button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                            <span className="text-[9px] text-primary/40 font-black tracking-widest bg-primary/5 px-1.5 py-0.5 rounded-full">MAX:{course.baseMax}</span>
                                        </div>
                                    </TableHead>
                                ))}
                                <TableHead className="text-center font-black text-primary min-w-[80px] sm:min-w-[110px] sm:sticky right-[160px] md:right-[180px] z-30 bg-[var(--surface-container)] text-[10px] border-none pr-4" onClick={() => handleSort('total')}>
                                    <div className="flex flex-col items-center">
                                        <span className="tracking-widest">TOTAL</span>
                                        <span className="text-[8px] opacity-40 font-black">/ {totalBaseMax}</span>
                                    </div>
                                </TableHead>
                                <TableHead className="text-center font-black text-primary min-w-[70px] sm:min-w-[90px] sm:sticky right-[80px] md:right-[100px] z-30 bg-[var(--surface-container)] text-[10px] border-none" onClick={() => handleSort('moyenne')}>
                                    <span className="tracking-widest">MOY %</span>
                                </TableHead>
                                <TableHead className="text-right w-[80px] md:w-[100px] sm:sticky right-0 z-30 bg-[var(--surface-container)] shadow-sm text-[10px] font-black uppercase border-none pr-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.map((student: any) => {
                                const t = getStudentTotals(student.id);
                                const earned = isSimulationMode ? t.simulatedTotal : t.normalTotal;
                                const denom = totalBaseMax; // Palmarès = always full period
                                const pct = denom > 0 ? (earned / denom) * 100 : 0;

                                return (
                                    <TableRow key={student.id} className="group hover:bg-[var(--surface-container-high)] border-none h-14 transition-colors">
                                        <TableCell className="sticky left-0 z-20 bg-[var(--surface-container-lowest)] dark:bg-[var(--surface-container-low)] p-0 shadow-[4px_0_15px_rgba(0,0,0,0.03)] transition-colors">
                                            <div className="flex items-center gap-3 pl-4 h-14 border-b border-border/5">
                                                <Avatar className="h-8 w-8 border-2 border-background shadow-md shrink-0">
                                                    <AvatarImage src={student.photo} />
                                                    <AvatarFallback className="text-[10px] bg-muted font-bold text-muted-foreground">{getInitials(student.lastName, student.firstName)}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <SmartStudentName student={student} className="font-black text-[12px] uppercase truncate group-hover:text-primary transition-colors" />
                                                        {t.hasAnyAbsence && <Badge variant="destructive" className="h-3.5 px-1 py-0 text-[8px] font-black ml-1 inline-flex animate-pulse shrink-0">(*)</Badge>}
                                                    </div>
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSort('matricule');
                                                        }}
                                                        className="text-[9px] text-muted-foreground/60 font-mono tracking-tighter truncate opacity-50 group-hover:opacity-100 transition-opacity cursor-pointer hover:underline"
                                                        title="Trier par matricule"
                                                    >
                                                        {student.matricule}
                                                        {sortConfig.key === 'matricule' && (
                                                            sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        
                                        {classroomCourses.map(course => {
                                            const g = studentGrades[student.id]?.[course.name];
                                            return (
                                                <TableCell key={course.name} className={cn("text-center font-mono text-[12px] px-2 h-14 border-b border-border/5", g?.hasAbsence && !isSimulationMode && "bg-red-500/5")}>
                                                    {!g ? (
                                                        // No data: check if course is open or just no results
                                                        (() => {
                                                            const normalizeStr = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
                                                            const isClosed = submissions.some((s: any) => {
                                                                const subCourseNorm = normalizeStr(s.course?.name);
                                                                return (course.id && s.courseId === course.id) || subCourseNorm === normalizeStr(course.name);
                                                            });
                                                            return isClosed ? (
                                                                <span className="text-muted-foreground/20 italic text-[10px]">--</span>
                                                            ) : (
                                                                <Badge className="text-[7.5px] h-3.5 bg-amber-50 text-amber-600 border-none font-black uppercase leading-none">Ouvert</Badge>
                                                            );
                                                        })()
                                                    ) : !g.isClosed ? (
                                                        <Badge className="text-[7.5px] h-3.5 bg-amber-50 text-amber-600 border-none font-black uppercase leading-none">Ouvert</Badge>
                                                    ) : g.hasAbsence && !isSimulationMode ? (
                                                        <Badge className="text-[7.5px] h-3.5 bg-red-100 text-red-600 border-none font-black uppercase leading-none">Vide</Badge>
                                                    ) : (
                                                        <span className={cn("font-black tracking-tight", g.score < (course.baseMax / 2) ? "text-destructive" : "text-foreground")}>{g.score.toFixed(1)}</span>
                                                    )}
                                                </TableCell>
                                            );
                                        })}

                                        <TableCell className="text-center bg-[var(--surface-container)] sm:sticky right-[160px] md:right-[180px] z-20 font-black text-primary shadow-sm text-sm border-b border-border/5 h-14">
                                            {earned.toFixed(1)}
                                        </TableCell>

                                        <TableCell className="text-center bg-[var(--surface-container)] sm:sticky right-[80px] md:right-[100px] z-20 font-black shadow-sm px-2 border-b border-border/5 h-14">
                                            <Badge className={cn("w-14 justify-center font-black text-[11px] h-6 px-0 border-none shadow-sm",
                                                pct >= 50 ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-700"
                                            )}>
                                                {pct.toFixed(0)}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right sm:sticky right-0 z-20 bg-[var(--surface-container-lowest)] dark:bg-[var(--surface-container-low)] shadow-sm pr-4 border-b border-border/5 h-14">
                                            <Link href={`/teacher/panoramic/${student.id}`}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10 rounded-xl group-hover:scale-105 transition-transform">
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
            {isSimulationMode && (
                <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl flex gap-4 items-start shadow-sm mx-auto max-w-4xl">
                    <Calculator className="h-6 w-6 text-blue-600 animate-pulse mt-1" />
                    <div>
                        <p className="text-[11px] text-blue-900 font-bold uppercase tracking-widest mb-1">Mode Simulation</p>
                        <p className="text-[10px] text-blue-700/80 font-medium leading-relaxed">
                            Les absences sont traitées comme 0 et le score de la grille des cotes est utilisé tel quel. En mode Standard, un cours avec absence est un «vide» qui ne contribue pas au total.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
