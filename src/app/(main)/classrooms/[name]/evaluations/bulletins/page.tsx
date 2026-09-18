"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { BulletinTemplate, BulletinData, PeriodScore, MATERNELLE_OFFICIAL_MAP } from "@/components/evaluations/bulletin-template";
import { Button } from "@/components/ui/button";
import { Loader2,    ArrowLeft, 
    Printer, 
    Layers, 
    ArrowDownAZ, 
    BarChart3, 
    CheckCircle2, 
    Lock 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    isSecondaryClassroom, 
    isMaternelleClassroom, 
    classroomNamesMatch,
    generateClassroomNames,
    STRUCTURE_META_KEYS
} from "@/lib/classroom-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function BulletinsPage() {
    const params = useParams();
    const router = useRouter();
    const classroomName = decodeURIComponent(params.name as string);
    const { schoolData, isLoading } = useSchoolData();

    const [assessments, setAssessments] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);

    // New Toggles
    const [isPalmaresGeral, setIsPalmaresGeral] = useState(true);
    const [isResultatsCumules, setIsResultatsCumules] = useState(false);
    const [closedPeriodsData, setClosedPeriodsData] = useState<any[]>([]);
    const [monitoringData, setMonitoringData] = useState<any[]>([]);
    const [sortMode, setSortMode] = useState<string>("alpha-asc");
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
    const [calPeriodIdMap, setCalPeriodIdMap] = useState<Record<string, string>>({});

    // Helpers
    const normalize = (str: string) => {
        if (!str) return "";
        let norm = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
        norm = norm.replace(/([2-9])eme/g, '$1e');
        norm = norm.replace(/education de base/g, 'cteb');
        return norm.replace(/\s+/g, ' ');
    };

    // Identify Level (Primary vs Secondary)
    const isMaternelle = useMemo(() => {
        return isMaternelleClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const isSecondary = useMemo(() => {
        return isSecondaryClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const levelKey = isMaternelle ? "maternelle" : isSecondary ? "secondaire" : "primaire";

    // All Periods from Calendar
    const allPeriods = useMemo(() => {
        if (!schoolData?.calendar || !levelKey) return [];
        const rawLevel = levelKey;
        const levelCalendar = schoolData.calendar[rawLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, levelKey]);

    // 0. Resolve the specific classroom object from school structure
    const classroomInfo = useMemo(() => {
        if (!schoolData?.structure || !classroomName || !schoolData?.students) return null;
        
        // Step 1: Find all candidate classrooms matching this name in any level
        const candidates: any[] = [];
        ['maternelle', 'primaire', 'secondaire'].forEach(level => {
            const levelStructure = (schoolData.structure as any)?.[level] || {};
            Object.entries(levelStructure).forEach(([gradeName, count]) => {
                if (STRUCTURE_META_KEYS.includes(gradeName) || typeof count !== 'number') return;
                
                const names = generateClassroomNames(gradeName, count);
                names.forEach((name, index) => {
                    if (classroomNamesMatch(name, classroomName)) {
                        // For Maternelle/Primary, the ID is often just the name if not specify
                        // But we check if there's a specific ID mapping in the config if needed
                        candidates.push({
                            id: name, // Fallback to name as ID
                            name: name,
                            grade: gradeName,
                            level: level
                        });
                    }
                });
            });
        });

        if (candidates.length === 0) {
            console.warn("ODSM DEBUG: No classroom matching name found in structure:", classroomName);
            return null;
        }

        // Step 2: Use students to verify the "Real" classroom ID
        // We count how many students are assigned to each candidate ID
        const studentAssignedIds = (schoolData.students as any[]).map(s => s.classroomId || s.classroomName);
        const winners = candidates.map(cand => {
            const studentCount = studentAssignedIds.filter(id => id === cand.id || id === cand.name).length;
            return { ...cand, studentCount };
        }).sort((a, b) => b.studentCount - a.studentCount);

        const absoluteWinner = winners[0];

        // Step 3: Log the process for debugging in browser console
        console.log("ODSM DEBUG: Classroom Resolution Process for", classroomName);
        console.log("  Candidates found:", candidates.map(c => `${c.name} (${c.id}) in ${c.level}`));
        console.log("  Winners (by student count):", winners.map(w => `${w.id}: ${w.studentCount} students`));
        console.log("  Resolved ID:", absoluteWinner?.id);

        return absoluteWinner;
    }, [schoolData, classroomName]);

    // STRICT: Using the verified ID from the student-based resolution
    const classroomId = classroomInfo?.id;


    // Courses for this classroom - STRICT EXPLICIT LINK (MIRRORING TEACHER PORTAL)
    const courses = useMemo(() => {
        if (!schoolData?.timetables || !classroomId) return [];

        // 1. Scan the Timetable slots (Robust Match)
        // We now prioritize NAME-based lookup because teachers manage schedules by name in the UI.
        const keys = Object.keys(schoolData.timetables || {});
        const nameKey = keys.find(k => normalize(k) === normalize(classroomName));
        
        let timetableSlots = nameKey ? (schoolData.timetables as any)[nameKey] : {};
        
        // Fallback: If Name-based lookup is empty, try ID-based lookup
        if (Object.keys(timetableSlots).length === 0 && classroomId) {
            timetableSlots = (schoolData.timetables as any)[classroomId] || {};
        }
        
        const rawPlacedNames = new Set<string>();
        
        Object.values(timetableSlots).forEach((slot: any) => { 
            if (slot && typeof slot === 'object' && slot.course && typeof slot.course === 'string') {
                const cName = slot.course.trim();
                if (cName && cName.length > 1) {
                    rawPlacedNames.add(cName);
                }
            }
        });

        // 2. Identify Metadata (MaxPoints, Group) from the SPECIFIC GRADE configuration only
        const coursesObj = (schoolData?.courses as any) || {};
        const gradeKey = Object.keys(coursesObj).find(k => 
            classroomNamesMatch(k, classroomName) || (classroomInfo && classroomNamesMatch(k, classroomInfo.name)) || (classroomInfo?.grade && classroomNamesMatch(k, classroomInfo.grade))
        );
        const clCourses = gradeKey ? coursesObj[gradeKey] : [];

        // 3. Assemble - STRICT NO FALLBACK TO OTHER LEVELS
        // Fallback: If no courses are found in the timetable, use all courses from the grade configuration.
        // This is especially necessary for Maternelle where timetables might not be explicitly configured.
        if (rawPlacedNames.size === 0 && Array.isArray(clCourses)) {
            clCourses.forEach((c: any) => {
                if (c.name) rawPlacedNames.add(c.name);
            });
        }

        const finalCourses: any[] = [];
        Array.from(rawPlacedNames).sort((a,b) => a.localeCompare(b)).forEach(name => {
            const normName = normalize(name);
            
            // Search metadata ONLY in this classroom's official config
            const config = Array.isArray(clCourses) ? clCourses.find((c: any) => normalize(c.name) === normName) : null;

            finalCourses.push({
                id: config?.id || `course-${normName.replace(/\s+/g, '-')}`,
                name,
                // Official RDC Maternelle default is 4 points per trimester (12 total)
                max: isMaternelle ? (config?.maxPoints || config?.max || 4) : (config?.maxPoints || config?.max || 20),
                domaine: config?.domaine,
                sousDomaine: config?.sousDomaine
            });
        });

        return finalCourses;
    }, [schoolData, classroomName, classroomId, classroomInfo, isMaternelle]);

    const students = useMemo(() => {
        return (schoolData?.students as any[])?.filter(s => 
            (classroomNamesMatch(s.classroomName, classroomName) || s.classroomId === classroomId) && 
            ['active', 'pending_payment'].includes(s.status?.toLowerCase() || '')
        ) || [];
    }, [schoolData, classroomName, classroomId]);

    useEffect(() => {
        const fetchData = async () => {
            if (!classroomId || !schoolData?.matricule) return;
            setIsFetching(true);
            try {
                // Build period ID mapping from calendar → DB UUIDs
                const periodMap: Record<string, string> = {};
                try {
                    const periodsRes = await fetch(`/api/school/periods?matricule=${schoolData.matricule}&level=${levelKey}`);
                    if (periodsRes.ok) {
                        const dbPeriods = await periodsRes.json();
                        const levelCalendar = (schoolData.calendar as any)?.[levelKey];
                        const calPeriods = levelCalendar?.periods || [];
                        calPeriods.forEach((cp: any) => {
                            const calNameNorm = normalize(cp.name);
                            let match = dbPeriods.find((p: any) => normalize(p.name) === calNameNorm);
                            if (!match) {
                                const thisLevelPeriods = dbPeriods
                                    .filter((p: any) => normalize(p.level) === normalize(levelKey))
                                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                                const calType = cp.type === 'exam' ? 'EXAM' : 'PERIOD';
                                const typePeriods = thisLevelPeriods.filter((p: any) => p.type === calType);
                                const typeCalPeriods = calPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                                const posInType = typeCalPeriods.findIndex((p: any) => p.id === cp.id);
                                if (posInType !== -1 && typePeriods[posInType]) {
                                    match = typePeriods[posInType];
                                }
                            }
                            if (match) periodMap[cp.id] = match.id;
                        });
                    }
                } catch (e) {
                    console.warn("Failed to build period mapping", e);
                }
                setCalPeriodIdMap(periodMap);

                // Fetch Assessments (use ID for reliability)
                const resGrades = await fetch(`/api/teacher/grades?classroomId=${encodeURIComponent(classroomId)}&matricule=${schoolData.matricule}`);
                if (resGrades.ok) {
                    const data = await resGrades.json();
                    setAssessments(data.assessments || []);
                }

                // Fetch Submissions
                const resSubs = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(classroomId)}&matricule=${schoolData.matricule}`);
                if (resSubs.ok) {
                    const dataSubs = await resSubs.json();
                    setSubmissions(dataSubs.submissions || []);
                }

                // Check PeriodClosure status (fetch ALL closures for this classroom)
                const resClosure = await fetch(`/api/teacher/period/closure?classroomId=${encodeURIComponent(classroomId)}`);
                if (resClosure.ok) {
                    const closureData = await resClosure.json();
                    setClosedPeriodsData(closureData.closures || []);
                }
            } catch (error) {
                console.error("Failed to fetch bulletin data", error);
            } finally {
                setIsFetching(false);
            }
        };

        if (!isLoading) {
            fetchData();
        }
    }, [isLoading, classroomName, schoolData, classroomId]);

    // Removed useEffect from here

    const printBulletins = () => {
        setIsPrinting(true);
        setTimeout(() => {
            document.body.classList.add('printing-mode');
            window.print();
            document.body.classList.remove('printing-mode');
            setIsPrinting(false);
        }, 500);
    };

    // Active period (from calendar config) and display period (user-selectable)
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
        const fetchMonitoring = async () => {
            if (!classroomId || !displayPeriod?.id) return;
            try {
                const res = await fetch(`/api/admin/period-monitoring/details?classroomId=${encodeURIComponent(classroomId)}&periodId=${displayPeriod.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMonitoringData(data.students || []);
                }
            } catch (error) {
                console.error("Failed to fetch monitoring data", error);
            }
        };
        fetchMonitoring();
    }, [classroomId, displayPeriod?.id]);

    const bulletinsData = useMemo(() => {
        if (!students.length || !courses.length) return [];

        // Use displayPeriod for filtering
        const displayIdx = allPeriods.findIndex((p: any) => p.id === displayPeriod?.id);

        const initialData = students.map(student => {
            const performanceData: Record<string, PeriodScore[]> = {};

            courses.forEach(course => {
                const courseScores: PeriodScore[] = [];
                const targetCourseNorm = normalize(course.name);

                // Group assessments by periodId
                const courseAssts = assessments.filter((a: any) => {
                    const isPub = a.isPublished === true || a.isPublished === 1 || String(a.isPublished) === "true";
                    if (!isPub) return false;
                    const cName = normalize(a.course?.name || "");
                    const cId = normalize(a.courseId || "");
                    return cName === targetCourseNorm || cId.includes(targetCourseNorm.replace(/\s+/g, '-'));
                });

                allPeriods.forEach((period: any, pIdx: number) => {
                    // Filter based on Résultats Cumulés
                    if (!isResultatsCumules) {
                        if (period.id !== displayPeriod?.id) return;
                    } else {
                        // Include displayPeriod and all previous
                        if (pIdx > displayIdx) return;
                    }

                    const dbPeriodId = calPeriodIdMap[period.id] || period.id;
                    const normPeriodName = normalize(period.name);
                    const periodAssts = courseAssts.filter(a => {
                        const aDbPeriodId = calPeriodIdMap[a.periodId] || a.periodId;
                        const aPeriodName = a.periodName || a.period?.name || "";
                        return aDbPeriodId === period.id || a.periodId === dbPeriodId || normalize(aPeriodName) === normPeriodName || normalize(aPeriodName).includes(normPeriodName);
                    });

                    // Point 1: Admin ONLY sees grades if the period is officially CLÔTURÉE par le titulaire
                    const isClosedByTeacher = closedPeriodsData.some(c => {
                        const cPeriodName = c.periodName || c.period?.name || "";
                        const cDbPeriodId = calPeriodIdMap[c.periodId] || c.periodId;
                        return c.periodId === dbPeriodId || cDbPeriodId === period.id || normalize(cPeriodName) === normPeriodName;
                    });

                    // If neither Palmares nor Cumules is on, we skip processing
                    if (!isPalmaresGeral && !isResultatsCumules) return;
                    
                    // IF NOT CLOSED BY TEACHER, SKIP! (Admin sees nothing for this period)
                    if (!isClosedByTeacher) return;

                    let totalEarned = 0;
                    let totalPossible = 0;
                    let hasAbsence = false;

                    periodAssts.forEach(ass => {
                        const result = ass.results?.find((r: any) => {
                            const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                        });

                        if (result) {
                            if (result.isAbsent) hasAbsence = true;
                            const pondere = Number(ass.pondere || ass.maxScore || 1);
                            totalEarned += (Number(result.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                            totalPossible += pondere;
                        } else if (!result) {
                            hasAbsence = true;
                        }
                    });

                    const isExam = normalize(period.name).includes("exam");
                    const periodMax = isExam ? course.max * 2 : course.max;
                    let scaledScore = -999; 
                    
                    if (totalPossible > 0) {
                        if (hasAbsence) {
                            scaledScore = -888;
                        } else {
                            scaledScore = (totalEarned / totalPossible) * periodMax;
                        }
                    } else {
                        scaledScore = 0;
                    }

                    courseScores.push({
                        periodId: period.id,
                        periodName: period.name,
                        score: scaledScore,
                        max: periodMax,
                        isSimulation: false
                    });
                });

                performanceData[course.name] = courseScores;
            });

            const monInfo = monitoringData.find((m: any) => m.id === student.id) || {};

            return {
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    middleName: student.middleName,
                    matricule: student.matricule,
                    photo: student.photo,
                    conduct: monInfo.conduct,
                    application: monInfo.application,
                    enafepScore: monInfo.enafepScore,
                    stateExamScore: monInfo.stateExamScore,
                    jurySchoolScore: monInfo.jurySchoolScore,
                    juryExamScore: monInfo.juryExamScore,
                    juryLesson1: monInfo.juryLesson1,
                    juryLesson2: monInfo.juryLesson2
                },
                classroomName,
                level: levelKey,
                schoolYear: schoolData?.activeYear || "2024-2025",
                courses,
                schoolData,
                performanceData,
                config: {
                    isSecondary,
                    isMaternelle,
                    isSimulationMode: false,
                    title: isPalmaresGeral ? "Palmarès Général" : undefined
                }
            } as BulletinData;
        });

        // Add Rank Calculations
        const getRawTotal = (perfData: Record<string, PeriodScore[]>, targetIds: string[]) => {
            let total = 0;
            let hasVal = false;
            courses.forEach(course => {
                targetIds.forEach(id => {
                    const sList = perfData[course.name] || [];
                    const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                    if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                        total += t.score;
                        hasVal = true;
                    }
                });
            });
            return hasVal ? total : null;
        };

        const groupsPrim = [
            ['p1'], ['p2'], ['t1_e'], ['p1', 'p2', 't1_e'],
            ['p3'], ['p4'], ['t2_e'], ['p3', 'p4', 't2_e'],
            ['p5'], ['p6'], ['t3_e'], ['p5', 'p6', 't3_e'],
            ['p1', 'p2', 't1_e', 'p3', 'p4', 't2_e', 'p5', 'p6', 't3_e']
        ];
        const groupsSec = [
            ['p1'], ['p2'], ['s1_e'], ['p1', 'p2', 's1_e'],
            ['p3'], ['p4'], ['s2_e'], ['p3', 'p4', 's2_e'],
            ['p1', 'p2', 's1_e', 'p3', 'p4', 's2_e']
        ];
        const groupsMat = [
            ['m_t1'], ['m_t2'], ['m_t3'], ['m_t1', 'm_t2', 'm_t3']
        ];
        const targetGroups = isMaternelle ? groupsMat : isSecondary ? groupsSec : groupsPrim;

        const groupScores: Record<string, { stdId: string, score: number }[]> = {};
        targetGroups.forEach(grp => {
            const key = grp.join(',');
            groupScores[key] = [];
            initialData.forEach(d => {
                const total = getRawTotal(d.performanceData, grp);
                if (total !== null) {
                    groupScores[key].push({ stdId: d.student.id, score: total });
                }
            });
            groupScores[key].sort((a, b) => b.score - a.score);
        });

        return initialData.map(d => {
            const ranks: Record<string, { rank: number; total: number }> = {};
            targetGroups.forEach(grp => {
                const key = grp.join(',');
                const scoresList = groupScores[key];
                const totalStds = scoresList.length;
                if (totalStds > 0) {
                    const myScoreObj = scoresList.find(s => s.stdId === d.student.id);
                    if (myScoreObj) {
                        const rank = scoresList.findIndex(s => s.score === myScoreObj.score) + 1;
                        ranks[key] = { rank, total: totalStds };
                    }
                }
            });
            return {
                ...d,
                config: { ...d.config, ranks }
            };
        });
    }, [students, courses, assessments, submissions, closedPeriodsData, allPeriods, displayPeriod, isSecondary, classroomName, levelKey, schoolData, isPalmaresGeral, isResultatsCumules]);

    // Sort bulletins
    const sortedBulletins = useMemo(() => {
        const data = [...bulletinsData];
        const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const getTotal = (d: BulletinData) => {
            let total = 0;
            Object.values(d.performanceData).forEach(scores => {
                scores.forEach(s => { if ((s.score ?? 0) > 0) total += (s.score ?? 0); });
            });
            return total;
        };
        switch (sortMode) {
            case "alpha-asc": return data.sort((a, b) => norm(a.student.lastName + a.student.firstName).localeCompare(norm(b.student.lastName + b.student.firstName)));
            case "alpha-desc": return data.sort((a, b) => norm(b.student.lastName + b.student.firstName).localeCompare(norm(a.student.lastName + a.student.firstName)));
            case "rank-asc": return data.sort((a, b) => getTotal(b) - getTotal(a));
            case "rank-desc": return data.sort((a, b) => getTotal(a) - getTotal(b));
            case "matricule-asc": return data.sort((a, b) => (a.student.matricule || "").localeCompare(b.student.matricule || ""));
            case "matricule-desc": return data.sort((a, b) => (b.student.matricule || "").localeCompare(a.student.matricule || ""));
            default: return data;
        }
    }, [bulletinsData, sortMode]);

    if (isLoading || isFetching) {
        return <div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            {/* DIAGNOSTIC OVERLAY - FORCED VISIBLE */}
            <div className="bg-red-50 border-2 border-red-500 p-2 mb-4 text-[10px] font-mono whitespace-pre overflow-hidden z-50 relative">
                [DIAGNOSTIC] ID: {classroomId} | Winner: {classroomInfo?.name} ({classroomInfo?.level}) | URL: {classroomName}
                [COURSES] {courses.map(c => c.name).join(', ')}
            </div>

            {/* Header - Hidden on Print */}
            <div className="flex flex-col gap-4 mb-8 hide-on-print">
                <Button variant="ghost" onClick={() => router.back()} className="w-fit text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Retour
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-headline font-bold text-foreground">Bulletins de Classe</h1>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground flex-wrap">
                            <span>Génération des bulletins pour <span className="font-semibold uppercase text-foreground">{classroomName}</span> ({students.length} élèves)</span>
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
                    <div className="flex items-center gap-2 flex-nowrap">
                        <Button
                            variant={isPalmaresGeral ? "default" : "outline"}
                            className={cn("h-9 rounded-xl font-bold gap-2", isPalmaresGeral && "bg-amber-600 hover:bg-amber-700 text-white")}
                            onClick={() => setIsPalmaresGeral(!isPalmaresGeral)}
                        >
                            <BarChart3 className={cn("h-4 w-4", isPalmaresGeral && "animate-pulse")} />
                            Palmarès Général
                        </Button>
                        <Button
                            variant={isResultatsCumules ? "default" : "outline"}
                            className={cn("h-9 rounded-xl font-bold gap-2", isResultatsCumules && "bg-indigo-600 hover:bg-indigo-700 text-white")}
                            onClick={() => setIsResultatsCumules(!isResultatsCumules)}
                        >
                            <Layers className="h-4 w-4" />
                            Résultats Cumulés
                        </Button>

                        <div className="w-[1px] h-8 bg-border/20 mx-1 hidden sm:block" />

                        <Select value={sortMode} onValueChange={setSortMode}>
                            <SelectTrigger className="h-9 w-auto rounded-xl border-muted bg-muted/30 text-xs font-bold gap-1 px-3 focus:ring-0 focus:ring-offset-0">
                                <ArrowDownAZ className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="alpha-asc">Alphabétique A→Z</SelectItem>
                                <SelectItem value="alpha-desc">Alphabétique Z→A</SelectItem>
                                <SelectItem value="rank-asc">Par Rang (1er→Dernier)</SelectItem>
                                <SelectItem value="rank-desc">Par Rang (Dernier→1er)</SelectItem>
                                <SelectItem value="matricule-asc">N° Matricule ↑</SelectItem>
                                <SelectItem value="matricule-desc">N° Matricule ↓</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button 
                            className="bg-primary text-white h-9 px-5 rounded-xl font-bold flex items-center shadow-lg"
                            onClick={printBulletins}
                            disabled={sortedBulletins.length === 0}
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimer
                        </Button>

                        {(() => {
                            // Compute closure status for the SELECTED (display) period
                            if (!displayPeriod) return null;
                            const normDisplay = normalize(displayPeriod.name);
                            const isDisplayClosedByTeacher = closedPeriodsData.some((c: any) => {
                                const cPeriodName = c.period?.name || c.periodName || "";
                                return c.periodId === displayPeriod.id || normalize(cPeriodName) === normDisplay;
                            });
                            return isDisplayClosedByTeacher ? (
                                <Badge className="h-9 rounded-xl font-bold gap-2 bg-emerald-100 text-emerald-700 border-emerald-200 px-4 whitespace-nowrap">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {displayPeriod.name} — Clôturée
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="h-9 rounded-xl font-bold gap-2 text-muted-foreground border-dashed bg-transparent px-4 whitespace-nowrap">
                                    <Lock className="h-4 w-4" />
                                    {displayPeriod.name} — En attente
                                </Badge>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className={`space-y-12 ${isPrinting ? 'printable-area' : ''}`}>
                {sortedBulletins.length === 0 ? (
                    <div className="text-center py-20 bg-white/50 rounded-2xl border border-dashed border-gray-300">
                        <p className="text-muted-foreground">Aucun élève trouvé ou configuration des cours manquante.</p>
                    </div>
                ) : (
                    sortedBulletins.map((data) => (
                        <div key={data.student.id} className="bg-white shadow-xl md:rounded-lg overflow-hidden hide-overflow-on-print border border-gray-200 p-2">
                            {/* PER-STUDENT DIAGNOSTIC */}
                            <div className="bg-blue-50 border border-blue-200 p-1 mb-2 text-[8px] font-mono text-blue-800">
                                Student: {data.student.firstName} | Courses in Data: {data.courses.map(c => c.name).join(', ')}
                            </div>
                            <BulletinTemplate data={data} />
                        </div>
                    ))
                )}
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .printable-area { margin: 0 !important; padding: 0 !important; }
                    .bulletin-page { page-break-after: always; margin: 0 !important; padding: 0 !important; }
                    body { background: white; }
                }
            `}</style>
        </div>
    );
}
