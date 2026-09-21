"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
} from "@/components/ui/card";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
    ChevronLeft, 
    Loader2, 
    Download, 
    TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GradeAggregatesPage() {
    const { courseId } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { schoolData, user, isLoading } = useSchoolData();
    
    const [assessments, setAssessments] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    // Track which columns are selected
    const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(["TOT"]));
    // Whether TOT mode is active (allows multi-select & cumulated display)
    const isTotMode = selectedColumns.has("TOT");

    const classroomName = searchParams.get("classroom");
    const courseName = searchParams.get("courseName");

    // Toggle logic:
    // - If TOT is OFF: radio behavior (one period at a time, clicking another deselects previous)
    // - If TOT is ON: multi-select (cumulated results)
    const handleToggle = (col: string) => {
        if (col === "TOT") {
            // Toggle TOT on/off
            const next = new Set(selectedColumns);
            if (next.has("TOT")) {
                // Turning TOT off — keep only one period if any are selected
                next.delete("TOT");
                // Remove TS columns too
                for (const c of next) {
                    if (c.startsWith("TS")) next.delete(c);
                }
                // Keep only the first period column if multiple
                const periodCols = Array.from(next).filter(c => c.startsWith("P") || c.startsWith("EX"));
                if (periodCols.length > 1) {
                    const keep = periodCols[0];
                    periodCols.forEach(c => { if (c !== keep) next.delete(c); });
                }
            } else {
                next.add("TOT");
            }
            setSelectedColumns(next);
        } else if (!isTotMode) {
            // Radio mode: only one at a time (replaces current selection)
            setSelectedColumns(new Set([col]));
        } else {
            // Multi-select mode (TOT is on)
            const next = new Set(selectedColumns);
            if (next.has(col)) {
                next.delete(col);
            } else {
                next.add(col);
            }
            setSelectedColumns(next);
        }
    };

    // Fetch all assessments for this course and classroom across all periods
    useEffect(() => {
        const fetchAllGrades = async () => {
            if (!courseId || !classroomName) return;
            setIsFetching(true);
            try {
                const res = await fetch(`/api/teacher/grades?courseId=${courseId}&classroomId=${classroomName}&matricule=${schoolData?.matricule}`);
                if (res.ok) {
                    const data = await res.json();
                    setAssessments(data.assessments || []);
                }
            } catch (error) {
                toast.error("Échec de la récupération des notes");
            } finally {
                setIsFetching(false);
            }
        };
        fetchAllGrades();
    }, [courseId, classroomName, schoolData?.matricule]);

    // Calendar periods
    const periods = useMemo(() => {
        if (!schoolData?.calendar) return [];
        const rawLevel = user?.profile?.level?.toLowerCase() || "secondaire";
        if ((schoolData.calendar as any)[rawLevel]?.periods) return (schoolData.calendar as any)[rawLevel].periods;
        const level = rawLevel.includes("primaire") ? "primaire" : rawLevel.includes("maternelle") ? "maternelle" : "secondaire";
        return (schoolData.calendar as any)?.[level]?.periods || (schoolData.calendar as any)?.secondaire?.periods || [];
    }, [schoolData, user]);

    // Derive semesters from calendar period IDs (e.g. s_s1_p1 → "s1", s_s2_p3 → "s2")
    // Fallback: use term field if present, else parse from ID pattern
    const semesters = useMemo(() => {
        const semSet = new Set<string>();
        periods.forEach((p: any) => {
            if (p.term) {
                semSet.add(p.term);
            } else {
                // Parse from ID pattern: s_s1_p1 → s1, s_s2_p3 → s2
                const match = p.id?.match(/s(\d+)/i);
                if (match) {
                    semSet.add(`s${match[1]}`);
                }
            }
        });
        return Array.from(semSet);
    }, [periods]);

    // Helper: get the semester key for a given period
    const getSemesterForPeriod = (p: any): string => {
        if (p.term) return p.term;
        const match = p.id?.match(/s(\d+)/i);
        return match ? `s${match[1]}` : "s1";
    };

    // Map periods to P1, P2... labels globally
    const periodLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        let ordinaryCount = 0;
        let examCount = 0;
        periods.forEach((p: any) => {
            if (p.type === 'exam') {
                examCount++;
                labels[p.id] = `EX${examCount}`;
            } else {
                ordinaryCount++;
                labels[p.id] = `P${ordinaryCount}`;
            }
        });
        return labels;
    }, [periods]);

    // Build a mapping: DB period name → calendar period ID
    // This is the KEY fix: assessments have DB UUIDs, but we need calendar IDs
    const dbNameToCalendarId = useMemo(() => {
        const map: Record<string, string> = {};
        periods.forEach((p: any) => {
            if (p.name) {
                map[p.name.toLowerCase()] = p.id;
            }
        });
        return map;
    }, [periods]);

    // Dynamic calculation of max points based on course configuration
    const baseMaxPoints = useMemo(() => {
        const matchNameStr = courseName?.trim().toLowerCase() || "";
        const coursesObj = schoolData?.courses as any || {};
        
        const normalizeGrade = (g: string) => {
            if (!g) return "";
            let norm = g.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
            norm = norm.replace(/([2-9])eme/g, '$1e');
            norm = norm.replace(/education de base/g, 'cteb');
            return norm.replace(/\s+/g, ' ');
        };

        const classroomStr = normalizeGrade(classroomName || "");

        const gradeKey = Object.keys(coursesObj).find(k => {
            const kLower = normalizeGrade(k);
            return kLower === classroomStr || 
                   classroomStr.includes(kLower) || 
                   kLower.includes(classroomStr.split(' ')[0]);
        });
        
        let courseDetail = null;
        if (gradeKey) {
            const gradeCourses = coursesObj[gradeKey] || [];
            courseDetail = gradeCourses.find((c: any) => c.name?.trim().toLowerCase() === matchNameStr);
        }

        if (!courseDetail || (!courseDetail.domaine && !courseDetail.max && !courseDetail.maxPoints)) {
            for (const gKey of Object.keys(coursesObj)) {
                const found = coursesObj[gKey].find((c: any) => c.name?.trim().toLowerCase() === matchNameStr);
                if (found && (found.domaine || found.max || found.maxPoints)) {
                    courseDetail = found;
                    break;
                }
            }
        }

        return courseDetail?.maxPoints ?? courseDetail?.max ?? 20;
    }, [schoolData, classroomName, courseName]);

    const periodMaxes = useMemo(() => {
        const map: Record<string, number> = {};
        periods.forEach((p: any) => {
            map[p.id] = p.type === 'exam' ? baseMaxPoints * 2 : baseMaxPoints;
        });
        return map;
    }, [periods, baseMaxPoints]);

    const semMaxes = useMemo(() => {
        const map: Record<string, number> = {};
        semesters.forEach((sem, idx) => {
            const semId = `TS${idx + 1}`;
            let sum = 0;
            periods.filter((p: any) => getSemesterForPeriod(p) === sem).forEach((p: any) => {
                sum += periodMaxes[p.id] || 0;
            });
            map[semId] = sum;
        });
        return map;
    }, [semesters, periods, periodMaxes]);

    const annualMax = useMemo(() => {
        return Object.values(semMaxes).reduce((a, b) => a + b, 0);
    }, [semMaxes]);

    // Student performance data calculation
    const studentsData = useMemo(() => {
        if (!schoolData?.students) return [];
        const classroomStudents = (schoolData.students as any[]).filter(s => s.classroomName === classroomName);

        return classroomStudents.map(student => {
            // Initialize grades per calendar period
            const studentGrades: Record<string, { total: number, max: number }> = {};
            periods.forEach((p: any) => { studentGrades[p.id] = { total: 0, max: 0 }; });

            assessments.forEach(ass => {
                // Confirmed assessments contribute their maxima and weights even
                // before results are published.
                if (ass.isSuspended) return;

                // Resolve: assessment's DB period → calendar period ID
                // Strategy 1: Match by period name (most reliable based on our debug)
                let calendarPeriodId: string | null = null;
                
                if (ass.period?.name) {
                    calendarPeriodId = dbNameToCalendarId[ass.period.name.toLowerCase()] || null;
                }
                
                // Strategy 2: Direct calendar ID match (fallback)
                if (!calendarPeriodId) {
                    const directMatch = periods.find((p: any) => p.id === ass.periodId);
                    if (directMatch) calendarPeriodId = directMatch.id;
                }

                if (calendarPeriodId && studentGrades[calendarPeriodId]) {
                    const pondere = ass.pondere ?? ass.maxScore;
                    
                    // Add max weight to the denominator UNCONDITIONALLY to match Totals logic
                    studentGrades[calendarPeriodId].max += pondere;

                    const result = ass.results?.find((r: any) => r.studentId === student.id);
                    
                    // Only add to total if result exists and not absent
                    if (result && !result.isAbsent && ass.maxScore > 0) {
                        // USE publishedScore just like in TotalsPage
                        const rawScore = result.publishedScore ?? result.score ?? "0";
                        const normalizedScore = (parseFloat(rawScore) / parseFloat(ass.maxScore)) * pondere;
                        studentGrades[calendarPeriodId].total += normalizedScore || 0;
                    }
                }
            });

            // Calculate semester totals (TS) and annual total (TOT)
            const semTotals: Record<string, number> = {};
            let annualTotal = 0;

            semesters.forEach((sem, idx) => {
                let semPoints = 0;
                periods.filter((p: any) => getSemesterForPeriod(p) === sem).forEach((p: any) => {
                    const pg = studentGrades[p.id];
                    if (pg && pg.max > 0) {
                        const targetMax = periodMaxes[p.id] || (p.type === 'exam' ? 40 : 20);
                        semPoints += (pg.total / pg.max) * targetMax;
                    }
                });
                semTotals[`TS${idx + 1}`] = semPoints;
                annualTotal += semPoints;
            });

            return { 
                ...student, 
                grades: studentGrades, 
                semTotals, 
                annualTotal 
            };
        });
    }, [schoolData, classroomName, assessments, periods, semesters, dbNameToCalendarId, periodMaxes]);

    if (isLoading || isFetching) {
        return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>;
    }

    // Determine which columns to actually show in the table
    const visibleColumns = selectedColumns;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl shrink-0">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight line-clamp-1">{courseName}</h1>
                        <p className="text-muted-foreground text-[10px] md:text-sm uppercase font-medium">{classroomName} • Cahier de cotes</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl">
                        <Download className="h-4 w-4" /> Exporter
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm overflow-hidden rounded-3xl">
                <CardHeader className="bg-muted/30 border-b py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg font-bold">Récapitulatif des Points</CardTitle>
                            {!isTotMode && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                                    Vue par période
                                </span>
                            )}
                            {isTotMode && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ml-2">
                                    Vue cumulée
                                </span>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/50">
                            {/* Period buttons */}
                            {periods.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleToggle(periodLabels[p.id])}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                                        visibleColumns.has(periodLabels[p.id]) 
                                            ? (p.type === 'exam' ? "bg-amber-600 text-white shadow-lg" : "bg-slate-700 text-white shadow-lg")
                                            : "hover:bg-muted text-muted-foreground"
                                    )}
                                >
                                    {periodLabels[p.id]}
                                </button>
                            ))}
                            {/* Semester Total buttons — only visible in TOT mode */}
                            {isTotMode && semesters.map((sem, idx) => (
                                <button
                                    key={sem}
                                    onClick={() => handleToggle(`TS${idx + 1}`)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                                        visibleColumns.has(`TS${idx + 1}`) 
                                            ? "bg-primary text-white shadow-lg" 
                                            : "hover:bg-muted text-primary"
                                    )}
                                >
                                    TS{idx + 1}
                                </button>
                            ))}
                            {/* Separator */}
                            <div className="w-px h-6 bg-border/50 mx-0.5" />
                            {/* TOT toggle */}
                            <button
                                onClick={() => handleToggle("TOT")}
                                className={cn(
                                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all",
                                    visibleColumns.has("TOT") 
                                        ? "bg-emerald-600 text-white shadow-lg" 
                                        : "hover:bg-muted text-emerald-700"
                                )}
                            >
                                TOT
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto scrollbar-hide">
                        <Table className="border-collapse">
                            <TableHeader>
                                <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-muted">
                                    <TableHead className="min-w-[160px] sticky left-0 bg-slate-50/90 backdrop-blur z-20 font-black text-[10px] uppercase border-r">Élève</TableHead>
                                    
                                    {semesters.map((sem, sIdx) => (
                                        <Fragment key={sem}>
                                            {periods.filter((p: any) => getSemesterForPeriod(p) === sem).map((p: any) => (
                                                visibleColumns.has(periodLabels[p.id]) && (
                                                    <TableHead key={p.id} className={cn(
                                                        "text-center font-black text-[10px] min-w-[70px] border-r",
                                                        p.type === 'exam' ? "bg-amber-500/5 text-amber-700" : ""
                                                    )}>
                                                        {periodLabels[p.id]} ({periodMaxes[p.id] || 0})
                                                    </TableHead>
                                                )
                                            ))}
                                            {visibleColumns.has(`TS${sIdx + 1}`) && (
                                                <TableHead className="text-center font-black text-[10px] min-w-[80px] bg-primary/5 text-primary border-r-2 border-primary/20">
                                                    TS{sIdx + 1} ({semMaxes[`TS${sIdx + 1}`] || 0})
                                                </TableHead>
                                            )}
                                        </Fragment>
                                    ))}
                                    
                                    {visibleColumns.has("TOT") && (
                                        <TableHead className="bg-emerald-600 text-white text-center font-black text-[10px] min-w-[80px]">
                                            TOT ({annualMax || 0})
                                        </TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {studentsData.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={20} className="text-center py-12 text-muted-foreground">
                                            Aucun élève trouvé pour cette classe.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {studentsData.map((student) => (
                                    <TableRow key={student.id} className="hover:bg-muted/30 transition-colors border-b border-muted/50">
                                        <TableCell className="sticky left-0 bg-white/90 backdrop-blur z-10 font-bold text-xs border-r whitespace-nowrap">
                                            {student.lastName} {student.firstName}
                                        </TableCell>
                                        
                                        {semesters.map((sem, sIdx) => {
                                            const semPeriods = periods.filter((p: any) => getSemesterForPeriod(p) === sem);
                                            return (
                                                <Fragment key={sem}>
                                                    {semPeriods.map((p: any) => (
                                                        visibleColumns.has(periodLabels[p.id]) && (
                                                            <TableCell key={p.id} className={cn(
                                                                "text-center font-mono text-xs border-r",
                                                                p.type === 'exam' ? "font-bold bg-amber-500/5" : "",
                                                                student.grades[p.id]?.max > 0 
                                                                    ? ((student.grades[p.id].total / student.grades[p.id].max) * (periodMaxes[p.id] || 0)) < ((periodMaxes[p.id] || 0) / 2)
                                                                        ? "text-red-600" 
                                                                        : ""
                                                                    : ""
                                                            )}>
                                                                {student.grades[p.id] && student.grades[p.id].max > 0 
                                                                    ? ((student.grades[p.id].total / student.grades[p.id].max) * (periodMaxes[p.id] || 0)).toFixed(1).replace('.', ',') 
                                                                    : ""}
                                                            </TableCell>
                                                        )
                                                    ))}
                                                    {visibleColumns.has(`TS${sIdx + 1}`) && (
                                                        <TableCell className={cn(
                                                            "text-center font-bold bg-primary/5 font-mono text-xs border-r-2 border-primary/20",
                                                            (student.semTotals[`TS${sIdx + 1}`] / (semMaxes[`TS${sIdx + 1}`] || 1)) < 0.5 ? "text-red-600" : "text-primary"
                                                        )}>
                                                            {student.semTotals[`TS${sIdx + 1}`] > 0 
                                                                ? student.semTotals[`TS${sIdx + 1}`].toFixed(1).replace('.', ',')
                                                                : ""}
                                                        </TableCell>
                                                    )}
                                                </Fragment>
                                            );
                                        })}

                                        {visibleColumns.has("TOT") && (
                                            <TableCell className={cn(
                                                "text-center font-black bg-emerald-50 font-mono text-sm",
                                                (student.annualTotal / (annualMax || 1)) < 0.5 ? "text-red-600" : "text-emerald-700"
                                            )}>
                                                {student.annualTotal > 0 
                                                    ? student.annualTotal.toFixed(1).replace('.', ',')
                                                    : "0,0"}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
