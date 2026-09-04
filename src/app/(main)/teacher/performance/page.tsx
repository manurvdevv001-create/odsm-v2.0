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
    TrendingUp, 
    Calculator, 
    FileSpreadsheet, 
    Download,
    Loader2,
    Trophy,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getInitials, cn } from "@/lib/utils";
import Link from "next/link";
import { PageHelp } from "@/components/page-help";
import { classroomNamesMatch } from "@/lib/classroom-utils";

export default function RendementActuelPage() {
    const { schoolData, user, isLoading } = useSchoolData();
    const [performanceData, setPerformanceData] = useState<any[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = useMemo(() => {
        if (!rawClassroomId) return "";
        return (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId;
    }, [rawClassroomId, schoolData]);

    // Robust Classroom Resolution
    const classroomInfo = useMemo(() => {
        if (!rawClassroomId || !schoolData?.structure?.classrooms) return null;
        return schoolData.structure.classrooms.find((c: any) => c.id === rawClassroomId);
    }, [rawClassroomId, schoolData]);

    const isMaternelle = useMemo(() => {
        const l = classroomInfo?.level?.toLowerCase() || "";
        return l === "maternelle" || l === "maternel";
    }, [classroomInfo]);

    // 1. Identify Periods and display period
    const periods = useMemo(() => {
        const rawLevel = user?.profile?.level?.toLowerCase() || "";
        const level = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        if (!schoolData?.calendar || !level) return [];
        const levelCalendar = (schoolData.calendar as any)[level];
        return levelCalendar?.periods || [];
    }, [schoolData, user]);

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

    const isExamPeriod = useMemo(() => {
        if (!displayPeriod?.name) return false;
        const name = displayPeriod.name.toLowerCase();
        return name.includes("exam") || name.includes("ex.");
    }, [displayPeriod]);

    // 2. Resolve Classroom Courses
    const classroomCourses = useMemo(() => {
        const timetableKey = classroomInfo?.id || rawClassroomId;
        const slots = (schoolData.timetables as any)[timetableKey] || {};
                      
        const courseNames = new Set<string>();
        Object.values(slots).forEach((slot: any) => {
            if (slot.course) courseNames.add(slot.course);
        });
        
        const coursesObj = (schoolData?.courses as any) || {};

        // 1. Resolve Grade Key robustly
        const gradeKey = Object.keys(coursesObj).find(k => 
            classroomNamesMatch(k, assignedClassroomName || "") || (classroomInfo && classroomNamesMatch(k, classroomInfo.name))
        );

        const gradeCourses = gradeKey ? coursesObj[gradeKey] : [];
        const normalize = (val: string) => val ? val.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";

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
    }, [rawClassroomId, schoolData, classroomInfo, isMaternelle]);

    const level = user?.profile?.level?.toLowerCase() || "";
    const isSecondary = level === "secondaire";

    // 3. Main Consolidation Effect
    useEffect(() => {
        const fetchAndConsolidate = async () => {
            if (!rawClassroomId || !schoolData?.matricule) return;
            setIsCalculating(true);
            try {
                // Fetch Submissions (Closure Status)
                let currentSubmissions: any[] = [];
                if (isSecondary) {
                }
                const resSubs = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(rawClassroomId)}${displayPeriod?.id ? `&periodId=${displayPeriod.id}` : ""}&matricule=${schoolData.matricule}`);
                const dataSubs = resSubs.ok ? await resSubs.json() : { submissions: [] };
                currentSubmissions = dataSubs.submissions || [];
                setSubmissions(currentSubmissions);

                // Fetch Assessments (Published only)
                let url = `/api/teacher/grades?classroomId=${encodeURIComponent(rawClassroomId)}&matricule=${schoolData.matricule}`;
                if (displayPeriod) url += `&periodId=${displayPeriod.id}`;
                const resGrades = await fetch(url);
                if (resGrades.ok) {
                    const data = await resGrades.json();
                    const assessments = data.assessments || [];
                    
                    const students = (schoolData?.students as any[])?.filter(s => classroomNamesMatch(s.classroomName || s.gradeName, assignedClassroomName)) || [];
                    const consolidated = students.map(student => {
                        let normalTotal = 0;      // Only courses without absence
                        let simulatedTotal = 0;    // All courses (absences = 0)
                        let closedMax = 0;         // Sum of baseMax for closed courses
                        let hasAbsence = false;

                        classroomCourses.forEach(course => {
                            const normalizeStr = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
                            const targetCourseNorm = normalizeStr(course.name);

                            // Find assessments for this course first
                            const courseAssessments = assessments.filter((a: any) => {
                                if (!a.isPublished) return false;
                                const cName = normalizeStr(a.course?.name || "");
                                const cId = normalizeStr(a.courseId || "");
                                return cName === targetCourseNorm || (cId && cId.includes(targetCourseNorm.replace(/\s+/g, '-')));
                            });

                            // "closed" = gradebook submitted by teacher
                            const isClosed = currentSubmissions.some((s: any) => {
                                    if (course.id && s.courseId === course.id) return true;
                                    const subCourseNorm = normalizeStr(s.course?.name);
                                    return subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
                                });

                            if (!isClosed) return;

                            const baseWeight = course.baseMax;
                            closedMax += baseWeight;

                            let courseTotalEarned = 0;
                            let courseTotalPossible = 0;
                            let courseHasAbsence = false;

                            courseAssessments.forEach((ass: any) => {
                                const result = ass.results?.find((r: any) => {
                                    const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                    const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                    const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                    return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                                });

                                if (result) {
                                    if (result.isAbsent) courseHasAbsence = true;
                                    const pondere = Number(ass.pondere || ass.maxScore || 1);
                                    const score = (Number(result.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                                    courseTotalEarned += score;
                                    courseTotalPossible += pondere;
                                } else if (!result) {
                                    courseHasAbsence = true;
                                }
                            });

                            if (courseTotalPossible > 0) {
                                const scaledScore = (courseTotalEarned / courseTotalPossible) * baseWeight;
                                
                                // Simulated: always add the score
                                simulatedTotal += scaledScore;

                                if (courseHasAbsence) {
                                    hasAbsence = true;
                                    // Normal: this course is a "vide" → contributes 0
                                } else {
                                    normalTotal += scaledScore;
                                }
                            }
                        });

                        return {
                            id: student.id,
                            name: `${student.lastName} ${student.firstName}`,
                            photo: student.photo,
                            normalTotal,
                            simulatedTotal,
                            closedMax,
                            hasAbsence
                        };
                    });

                    setPerformanceData(consolidated);
                }
            } catch (error) {
                console.error("Consolidation error:", error);
            } finally {
                setIsCalculating(false);
            }
        };

        if (!isLoading && assignedClassroomName && schoolData) {
            fetchAndConsolidate();
        }
    }, [isLoading, assignedClassroomName, schoolData, classroomCourses, displayPeriod, isExamPeriod, isSecondary]);

    // Closed courses max (for badge display)
    const closedCoursesMax = useMemo(() => {
        if (performanceData.length > 0) return performanceData[0].closedMax;
        return 0;
    }, [performanceData]);

    const processedData = useMemo(() => {
        return performanceData.map(s => {
            const earned = isSimulationMode ? s.simulatedTotal : s.normalTotal;
            // Rendement Actuel: denominator = closed courses max only
            const denom = s.closedMax;
            const percentage = denom > 0 ? (earned / denom) * 100 : 0;
            return {
                ...s,
                totalEarned: earned,
                totalMax: denom,
                percentage
            };
        }).sort((a, b) => b.percentage - a.percentage);
    }, [performanceData, isSimulationMode]);

    const classAverage = processedData.length > 0 
        ? processedData.reduce((acc, curr) => acc + curr.percentage, 0) / processedData.length 
        : 0;

    const successRate = processedData.length > 0 
        ? (processedData.filter(s => s.percentage >= 50).length / processedData.length) * 100 
        : 0;

    if (isLoading) return <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                        Rendement Actuel
                        {isExamPeriod && <Badge className="bg-amber-100 text-amber-700 border-amber-200">EXAMENS</Badge>}
                        <PageHelp pageId="performance" />
                    </h1>
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground text-sm flex-wrap">
                        <span>Local : <span className="font-bold text-foreground uppercase">{assignedClassroomName}</span></span>
                        <span>—</span>
                        <div className="flex items-center gap-2">
                            <span>Période :</span>
                            <Select
                                value={selectedPeriodId || activePeriod?.id || ""}
                                onValueChange={(value) => setSelectedPeriodId(value === activePeriod?.id ? "" : value)}
                            >
                                <SelectTrigger className="h-6 w-auto border-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-none rounded-sm px-2 text-xs font-bold uppercase focus:ring-0 focus:ring-offset-0">
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
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">Uniquement les cahiers des cotes clôturés</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={isSimulationMode ? "default" : "outline"}
                        className={cn(
                            "gap-2 rounded-xl transition-all font-bold px-4 h-9 shadow-sm",
                            isSimulationMode ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600" : "border-border/50"
                        )}
                        onClick={() => setIsSimulationMode(!isSimulationMode)}
                    >
                        <Calculator className="h-4 w-4" />
                        {isSimulationMode ? "Simulation Active" : "Simulation"}
                    </Button>
                    <div className="h-8 w-[1px] bg-border/20 mx-1 hidden sm:block" />
                    <Button variant="outline" className="gap-2 rounded-xl border-border/50 h-9">
                        <Download className="h-4 w-4" />
                        <span className="hidden lg:inline">Exporter</span>
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <div className="stat-card text-center relative overflow-hidden group">
                    <Trophy className="h-5 w-5 text-primary mx-auto mb-2 opacity-50 group-hover:scale-110 transition-transform" />
                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">Premier</p>
                    <p className="text-sm font-extrabold truncate uppercase">{processedData[0]?.name || "--"}</p>
                    <Badge className="bg-primary/10 text-primary border-none mt-2 font-bold px-3">
                        {processedData[0] ? `${processedData[0].percentage.toFixed(1)}%` : "--"}
                    </Badge>
                </div>
                <div className="stat-card text-center">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Moyenne Gén.</p>
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                        {classAverage.toFixed(1)}<span className="text-xs ml-0.5 opacity-60">%</span>
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Moyenne Classe</p>
                </div>
                <div className="stat-card text-center">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">Taux Réussite</p>
                    <p className="text-3xl font-black text-amber-700 dark:text-amber-400">
                        {successRate.toFixed(0)}%
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Efficacité</p>
                </div>
                <div className={cn("stat-card text-center flex flex-col items-center justify-center transition-all",
                    isSimulationMode ? "bg-blue-50/50 border-blue-200" : "bg-blue-50/30 border-blue-100/50"
                )}>
                    <Calculator className={cn("h-6 w-6 mb-1", isSimulationMode ? "text-blue-600 animate-pulse" : "text-blue-400")} />
                    <p className={cn("text-[10px] font-extrabold uppercase", isSimulationMode ? "text-blue-700" : "text-blue-600")}>
                        {isSimulationMode ? "Simulation" : "Standard"}
                    </p>
                </div>
            </div>

            <div className="glass-card overflow-hidden p-0 border-none shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 tonal-surface-raised gap-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <h3 className="font-extrabold uppercase tracking-tight">Rendement Actuel</h3>
                        {isSimulationMode && <Badge className="bg-blue-600 text-white border-none text-[9px] font-black h-5 uppercase">Mode Simulation</Badge>}
                    </div>
                    <Badge variant="outline" className="border-primary/20 text-primary font-mono text-[10px] h-6 flex items-center justify-center px-3">
                        COURS CLÔTURÉS (MAX {closedCoursesMax})
                    </Badge>
                </div>
                {isCalculating ? (
                    <div className="py-24 flex justify-center flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                        <p className="text-sm font-bold animate-pulse text-muted-foreground italic">Calcul du rendement...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table className="tonal-table">
                            <TableHeader>
                                <TableRow className="tonal-surface-raised hover:bg-transparent border-none">
                                    <TableHead className="w-[80px] text-center text-[10px] font-black uppercase border-none">Rang</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase border-none">Élève</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase hidden sm:table-cell border-none">État</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase hidden sm:table-cell border-none">Total Points</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase border-none">Moyenne %</TableHead>
                                    <TableHead className="text-center text-[10px] font-black uppercase border-none">Mention</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedData.map((student, index) => (
                                    <TableRow key={student.id} className="border-none hover:bg-muted/30 transition-colors group">
                                        <TableCell className="text-center">
                                            <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm",
                                                index === 0 ? "bg-amber-100 text-amber-700 shadow-sm" : "text-muted-foreground/60"
                                            )}>
                                                {index + 1}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                                    <AvatarImage src={student.photo} />
                                                    <AvatarFallback className="text-[10px] bg-muted font-bold text-muted-foreground">
                                                        {getInitials(student.name.split(' ')[1], student.name.split(' ')[0])}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-extrabold text-sm flex items-center gap-1.5 uppercase group-hover:text-primary transition-colors">
                                                        {student.name}
                                                        {student.hasAbsence && <Badge variant="destructive" className="h-4 px-1 py-0 text-[10px] font-black animate-pulse">(*)</Badge>}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center hidden sm:table-cell">
                                            {student.hasAbsence ? (
                                                <div className="flex items-center gap-1 justify-center text-red-500 font-bold text-[9px] uppercase">
                                                    <AlertCircle className="h-3 w-3" />
                                                    Vide
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none text-[9px] font-black uppercase">Complet</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center font-bold font-mono text-xs hidden sm:table-cell">
                                            {student.totalEarned.toFixed(1)} <span className="text-muted-foreground opacity-30">/ {student.totalMax}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn("text-sm font-black min-w-[50px] justify-center px-2 py-1 border-none shadow-sm", 
                                                student.percentage >= 50 ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'
                                            )}>
                                                {student.percentage.toFixed(1)}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className={cn("uppercase text-[10px] font-black tracking-widest",
                                                student.percentage >= 80 ? 'text-emerald-600' : 
                                                student.percentage >= 70 ? 'text-blue-600' : 
                                                student.percentage >= 60 ? 'text-primary' : 
                                                student.percentage >= 50 ? 'text-amber-600' : 'text-red-500'
                                            )}>
                                                {student.percentage >= 50 ? 'Réussite' : 'Échec'}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {processedData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic border-none">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <Trophy className="h-12 w-12" />
                                                <p>Aucun cahier des cotes clôturé pour cette période.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
            {processedData.some(s => s.hasAbsence) && (
                <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl flex gap-4 items-start shadow-sm">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[11px] text-amber-900 font-bold uppercase tracking-widest mb-1">Note sur les manques de cotes</p>
                        <p className="text-[10px] text-amber-700/80 font-medium leading-relaxed">
                            L&apos;astérisque <Badge variant="destructive" className="h-3 px-1 text-[8px] mx-1 border-none shadow-none">(*)</Badge> indique qu&apos;au moins un cours clôturé comporte une absence. 
                            En mode <span className="font-extrabold">Standard</span>, ce cours est un «vide» et ne contribue pas au total.
                            En mode <span className="font-extrabold">Simulation</span>, les absences sont traitées comme 0 et le score de la grille des cotes est utilisé tel quel.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
