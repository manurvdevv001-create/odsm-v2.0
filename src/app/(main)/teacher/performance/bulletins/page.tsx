"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { BulletinTemplate, BulletinData, PeriodScore } from "@/components/evaluations/bulletin-template";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Printer, Calculator, Layers, BarChart3, Lock, ArrowDownAZ, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { isSecondaryClassroom, isMaternelleClassroom, classroomNamesMatch } from "@/lib/classroom-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHelp } from "@/components/page-help";

export default function TeacherBulletinsPage() {
    const router = useRouter();
    const { schoolData, user, isLoading } = useSchoolData();

    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = useMemo(() => {
        if (!rawClassroomId) return "";
        return (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId;
    }, [rawClassroomId, schoolData]);

    const [assessments, setAssessments] = useState<any[]>([]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
    
    // New Toggles
    const [isPalmaresGeral, setIsPalmaresGeral] = useState(true);
    const [isResultatsCumules, setIsResultatsCumules] = useState(false);
    const [isClosingPeriod, setIsClosingPeriod] = useState(false);
    const [closedPeriodsData, setClosedPeriodsData] = useState<any[]>([]);
    const [calPeriodIdMap, setCalPeriodIdMap] = useState<Record<string, string>>({});
    const [sortMode, setSortMode] = useState<string>("alpha-asc");

    // Helpers
    const normalize = (str: string) => {
    if (!str) return "";
    let norm = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
    norm = norm.replace(/([2-9])eme/g, '$1e');
    norm = norm.replace(/education de base/g, 'cteb');
    return norm.replace(/\s+/g, ' ');
};

    // Robust Classroom Resolution
    const classroomInfo = useMemo(() => {
        if (!rawClassroomId || !schoolData?.structure?.classrooms) return null;
        return schoolData.structure.classrooms.find((c: any) => c.id === rawClassroomId);
    }, [rawClassroomId, schoolData]);

    // Identify Level (Primary vs Secondary vs Maternelle)
    const isMaternelle = useMemo(() => {
        const l = classroomInfo?.level?.toLowerCase() || "";
        return l === "maternelle" || l === "maternel" || isMaternelleClassroom(assignedClassroomName || "", schoolData);
    }, [classroomInfo, assignedClassroomName, schoolData]);

    const isSecondary = useMemo(() => {
        if (classroomInfo?.level) {
            const l = classroomInfo.level.toLowerCase();
            return l === "secondaire" || l === "humanites" || l === "cteb";
        }
        return isSecondaryClassroom(assignedClassroomName || "", schoolData);
    }, [schoolData, assignedClassroomName, classroomInfo]);

    const levelKey = isMaternelle ? "maternelle" : isSecondary ? "secondaire" : "primaire";

    // All Periods from Calendar
    const allPeriods = useMemo(() => {
        if (!schoolData?.calendar || !levelKey) return [];
        const levelCalendar = schoolData.calendar[levelKey];
        return levelCalendar?.periods || [];
    }, [schoolData, levelKey]);

    // Courses for this classroom
    const courses = useMemo(() => {
        if (!assignedClassroomName) return [];
        const coursesObj = (schoolData?.courses as any) || {};

        // 1. Resolve Grade Key robustly
        const gradeKey = Object.keys(coursesObj).find(k => 
            classroomNamesMatch(k, assignedClassroomName || "") || (classroomInfo && classroomNamesMatch(k, classroomInfo.name))
        );

        const clCourses = gradeKey ? coursesObj[gradeKey] : [];

        // 2. Resolve Timetable Key robustly
        const timetableKey = (isMaternelle && classroomInfo) ? classroomInfo.id : (classroomInfo?.id || assignedClassroomName);
        const timetableSlots = (schoolData?.timetables as any)?.[timetableKey] || 
                             (classroomInfo?.name ? (schoolData.timetables as any)[classroomInfo.name] : {}) ||
                             {};
                             
        const placedNames = new Set<string>();
        Object.values(timetableSlots).forEach((slot: any) => { if (slot.course) placedNames.add(slot.course); });

        if (placedNames.size === 0 && Array.isArray(clCourses)) {
            clCourses.forEach((c: any) => {
                if (c.name) placedNames.add(c.name);
            });
        }

        const finalCourses: any[] = [];
        Array.from(placedNames).forEach(name => {
            const config = Array.isArray(clCourses) ? clCourses.find((c: any) => normalize(c.name) === normalize(name) || normalize(name).includes(normalize(c.name))) : null;
            finalCourses.push({
                id: config?.id,
                name,
                max: config?.maxPoints || config?.max || 20,
                domaine: config?.domaine,
                sousDomaine: config?.sousDomaine
            });
        });

        return finalCourses;
    }, [schoolData, assignedClassroomName, classroomInfo, isMaternelle]);

    const students = useMemo(() => {
        return (schoolData?.students as any[])?.filter(s => 
            classroomNamesMatch(s.classroomName || s.gradeName, assignedClassroomName) && 
            ['active', 'pending_payment'].includes(s.status?.toLowerCase() || '')
        ) || [];
    }, [schoolData, assignedClassroomName]);

    // Active period (resolved from calendar)
    const activePeriod = useMemo(() => {
        return allPeriods.find((p: any) => p.isActive) || allPeriods[0];
    }, [allPeriods]);

    const displayPeriod = useMemo(() => {
        if (selectedPeriodId) {
            return allPeriods.find((p: any) => p.id === selectedPeriodId) || activePeriod;
        }
        return activePeriod;
    }, [selectedPeriodId, activePeriod, allPeriods]);

    const classroomIdParam = useMemo(() => classroomInfo?.id || rawClassroomId || "", [classroomInfo, rawClassroomId]);

    const effectiveDisplayPeriodId = useMemo(() => {
        if (!displayPeriod?.id) return "";
        return calPeriodIdMap[displayPeriod.id] || displayPeriod.id;
    }, [displayPeriod, calPeriodIdMap]);

    const isClosureForPeriod = (closures: any[], periodId: string, periodName: string) => {
        const targetPeriodNorm = normalize(periodName);
        const targetDbPeriodId = calPeriodIdMap[periodId] || periodId;
        return closures.some((c: any) => {
            const cPeriodId = c.periodId || "";
            const cName = normalize(c.period?.name || c.periodName || "");
            const resolvedCPeriodId = calPeriodIdMap[cPeriodId] || cPeriodId;
            if (resolvedCPeriodId === targetDbPeriodId || cPeriodId === targetDbPeriodId || cPeriodId === periodId) return true;
            if (cName && targetPeriodNorm && (cName === targetPeriodNorm || cName.includes(targetPeriodNorm) || targetPeriodNorm.includes(cName))) return true;
            return false;
        });
    };

    const isPeriodClosed = useMemo(() => {
        if (!displayPeriod?.name) return false;
        const currentPeriodId = effectiveDisplayPeriodId || displayPeriod.id;
        return isClosureForPeriod(closedPeriodsData, currentPeriodId, displayPeriod.name);
    }, [closedPeriodsData, effectiveDisplayPeriodId, displayPeriod]);

    useEffect(() => {
        const fetchData = async () => {
            if (!rawClassroomId || !schoolData?.matricule) {
                setIsFetching(false);
                return;
            }

            try {
                // Build a mapping from calendar period ID → DB period UUID
                const calPeriodToDbId: Record<string, string> = {};
                if (schoolData?.matricule && levelKey) {
                    try {
                        const periodsRes = await fetch(`/api/school/periods?matricule=${schoolData.matricule}&level=${levelKey}`);
                        if (periodsRes.ok) {
                            const dbPeriods = await periodsRes.json();
                            const levelCalendar = (schoolData.calendar as any)?.[levelKey];
                            const calPeriods = levelCalendar?.periods || [];
                            const normalize = (s: string) => s ? s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
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
                                if (match) calPeriodToDbId[cp.id] = match.id;
                            });
                        }
                    } catch (e) {
                        console.warn("Failed to build period mapping", e);
                    }
                }
                setCalPeriodIdMap(calPeriodToDbId);

                const effectivePeriodId = displayPeriod?.id ? (calPeriodToDbId[displayPeriod.id] || displayPeriod.id) : "";
                const periodQuery = isResultatsCumules ? "" : (effectivePeriodId ? `&periodId=${encodeURIComponent(effectivePeriodId)}` : "");

                // Fetch grades
                let gradesUrl = `/api/teacher/grades?classroomId=${encodeURIComponent(classroomIdParam)}&matricule=${encodeURIComponent(schoolData.matricule)}${periodQuery}`;
                const resGrades = await fetch(gradesUrl);
                if (resGrades.ok) {
                    const data = await resGrades.json();
                    setAssessments(data.assessments || []);
                }

                // Fetch submissions (closure status)
                const resSubs = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(classroomIdParam)}${periodQuery}&matricule=${encodeURIComponent(schoolData.matricule)}`);
                if (resSubs.ok) {
                    const dataSubs = await resSubs.json();
                    setSubmissions(dataSubs.submissions || []);
                }

                // Check PeriodClosure status
                const resClosure = await fetch(`/api/teacher/period/closure?classroomId=${encodeURIComponent(classroomIdParam)}${periodQuery}&schoolMatricule=${encodeURIComponent(schoolData.matricule)}`);
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
    }, [isLoading, assignedClassroomName, schoolData, displayPeriod, isResultatsCumules]);

    const printBulletins = () => {
        setIsPrinting(true);
        setTimeout(() => {
            document.body.classList.add('printing-mode');
            window.print();
            document.body.classList.remove('printing-mode');
            setIsPrinting(false);
        }, 500);
    };

    const bulletinsData = useMemo(() => {
        if (!students.length || !courses.length || !assignedClassroomName) return [];

        // If Palmares is off and not in simulation, show empty template
        if (!isPalmaresGeral && !isSimulationMode) {
            return students.map(student => ({
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    middleName: student.middleName,
                    matricule: student.matricule,
                    photo: student.photo
                },
                classroomName: assignedClassroomName,
                level: levelKey,
                schoolYear: schoolData?.activeYear || "2024-2025",
                courses,
                schoolData,
                performanceData: {},
                config: { isSecondary, isMaternelle, isSimulationMode }
            } as BulletinData));
        }

        const activeIdx = allPeriods.findIndex((p: any) => p.id === displayPeriod?.id);

        const initialData = students.map(student => {
            const performanceData: Record<string, PeriodScore[]> = {};

            courses.forEach(course => {
                const courseScores: PeriodScore[] = [];
                const targetCourseNorm = normalize(course.name);

                // Filter course assessments globally
                const courseAssts = assessments.filter((a: any) => {
                    const isPub = a.isPublished === true || a.isPublished === 1 || String(a.isPublished) === "true";
                    if (!isPub) return false;
                    const cName = normalize(a.course?.name || "");
                    const cId = normalize(a.courseId || "");
                    return cName === targetCourseNorm || (cId && cId.includes(targetCourseNorm.replace(/\s+/g, '-')));
                });

                allPeriods.forEach((period: any, pIdx: number) => {
                    // Filter based on Résultats Cumulés
                    if (!isResultatsCumules) {
                        if (period.id !== displayPeriod?.id) return;
                    } else {
                        // Include active and all previous
                        if (pIdx > activeIdx) return;
                    }

                    const dbPeriodId = calPeriodIdMap[period.id] || period.id;
                    const normPeriodName = normalize(period.name);
                    const periodAssts = courseAssts.filter(a => {
                        const aDbPeriodId = calPeriodIdMap[a.periodId] || a.periodId;
                        const aPeriodName = a.periodName || a.period?.name || "";
                        return aDbPeriodId === period.id || a.periodId === dbPeriodId || normalize(aPeriodName) === normPeriodName || normalize(aPeriodName).includes(normPeriodName);
                    });

                    // Teacher sees grades if the period is CLOSED OR if it's the ACTIVE period being built
                    const isClosedByTeacher = closedPeriodsData.some((c: any) => {
                        const cPeriodName = c.periodName || c.period?.name || "";
                        const cDbPeriodId = calPeriodIdMap[c.periodId] || c.periodId;
                        return c.periodId === dbPeriodId || cDbPeriodId === period.id || normalize(cPeriodName) === normPeriodName;
                    });
                    const isActivePeriodForTeacher = period.id === displayPeriod?.id;

                    if (!isClosedByTeacher && !isActivePeriodForTeacher) return;

                    // Fallback local closure for active period if not officially transmitted yet
                    const isCurrentlyClosed = isActivePeriodForTeacher ? submissions.some((s: any) => {
                            const subCourseNorm = normalize(s.course?.name);
                            return (course.id && s.courseId === course.id) || subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
                        }) : isClosedByTeacher;

                    if (isCurrentlyClosed || isSimulationMode) {
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
                            if (hasAbsence && !isSimulationMode) {
                                scaledScore = -888;
                            } else {
                                scaledScore = (totalEarned / totalPossible) * periodMax;
                            }
                        } else if (isCurrentlyClosed) {
                            scaledScore = 0;
                        }

                        courseScores.push({
                            periodId: period.id,
                            periodName: period.name,
                            score: scaledScore,
                            max: periodMax,
                            isSimulation: !isCurrentlyClosed && isSimulationMode
                        });
                    }
                });

                performanceData[course.name] = courseScores;
            });

            return {
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    middleName: student.middleName,
                    matricule: student.matricule,
                    photo: student.photo
                },
                classroomName: assignedClassroomName,
                level: levelKey,
                schoolYear: schoolData?.activeYear || "2024-2025",
                courses,
                schoolData,
                performanceData,
                config: {
                    isSecondary,
                    isMaternelle,
                    isSimulationMode,
                    title: isPalmaresGeral ? "Palmarès Général" : (isSimulationMode ? "Mode Simulation" : undefined)
                }
            } as BulletinData;
        });

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
    }, [students, courses, assessments, submissions, closedPeriodsData, allPeriods, displayPeriod, isSimulationMode, isSecondary, assignedClassroomName, levelKey, schoolData, isPalmaresGeral, isResultatsCumules]);

    // Sort bulletins
    const sortedBulletins = useMemo(() => {
        const data = [...bulletinsData];
        const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        
        // Helper to get total score for ranking
        const getTotal = (d: BulletinData) => {
            let total = 0;
            Object.values(d.performanceData).forEach(scores => {
                scores.forEach(s => {
                    if ((s.score ?? 0) > 0) total += (s.score ?? 0);
                });
            });
            return total;
        };

        switch (sortMode) {
            case "alpha-asc":
                return data.sort((a, b) => norm(a.student.lastName + a.student.firstName).localeCompare(norm(b.student.lastName + b.student.firstName)));
            case "alpha-desc":
                return data.sort((a, b) => norm(b.student.lastName + b.student.firstName).localeCompare(norm(a.student.lastName + a.student.firstName)));
            case "rank-asc":
                return data.sort((a, b) => getTotal(b) - getTotal(a));
            case "rank-desc":
                return data.sort((a, b) => getTotal(a) - getTotal(b));
            case "matricule-asc":
                return data.sort((a, b) => (a.student.matricule || "").localeCompare(b.student.matricule || ""));
            case "matricule-desc":
                return data.sort((a, b) => (b.student.matricule || "").localeCompare(a.student.matricule || ""));
            default:
                return data;
        }
    }, [bulletinsData, sortMode]);

    const handleClosePeriod = async () => {
        if (!confirm(`Voulez-vous vraiment clôturer la période "${displayPeriod?.name || 'sélectionnée'}" pour la classe ?\n\nCette action :\n• Transmet les résultats à l'administration\n• Empêche toute modification des cahiers de cotes\n• Est irréversible côté enseignant`)) return;
        setIsClosingPeriod(true);
        try {
            const res = await fetch("/api/teacher/period/closure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classroomId: classroomIdParam,
                    periodId: effectiveDisplayPeriodId || displayPeriod?.id || "",
                    closedByUserId: user?.id || null,
                    schoolMatricule: schoolData?.matricule,
                    totalExpectedCourses: courses.length
                })
            });
            const handleRefreshState = async () => {
                try {
                    const effectiveClosurePeriodId = calPeriodIdMap[displayPeriod?.id || ""] || displayPeriod?.id || "";
                    const refreshPeriodQuery = effectiveClosurePeriodId ? `&periodId=${encodeURIComponent(effectiveClosurePeriodId)}` : "";
                    const closureRes = await fetch(`/api/teacher/period/closure?classroomId=${encodeURIComponent(classroomIdParam)}${refreshPeriodQuery}&schoolMatricule=${encodeURIComponent(schoolData?.matricule || "")}`);
                    if (closureRes.ok) {
                        const closureJson = await closureRes.json();
                        setClosedPeriodsData(closureJson.closures || []);
                    }

                    const subsRes = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(classroomIdParam)}${refreshPeriodQuery}&matricule=${encodeURIComponent(schoolData?.matricule || "")}`);
                    if (subsRes.ok) {
                        const subsJson = await subsRes.json();
                        setSubmissions(subsJson.submissions || []);
                    }
                } catch (e) {
                    console.warn("Failed to refresh closure/submissions after close", e);
                }
            };

            if (res.ok) {
                toast.success("Période clôturée avec succès. Les résultats sont maintenant disponibles pour l'administration.");
                await handleRefreshState();
            } else {
                const err = await res.json();
                toast.error(err.error || "Échec de la clôture.", { duration: 8000 });
                if (err.error?.toString().toLowerCase().includes("déjà clôturée") || err.error?.toString().toLowerCase().includes("already closed")) {
                    await handleRefreshState();
                }
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setIsClosingPeriod(false);
        }
    };

    if (isLoading || isFetching) {
        return <div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!assignedClassroomName) {
        return <div className="p-10 text-center text-muted-foreground">Aucune classe assignée.</div>;
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            <div className="flex flex-col gap-4 mb-8 hide-on-print">
                <Button variant="ghost" onClick={() => router.back()} className="w-fit text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la consolidation
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-headline font-bold text-foreground flex items-center gap-2">
                            Bulletins de Classe
                            <PageHelp pageId="bulletins" />
                        </h1>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground flex-wrap">
                            <span>Génération des bulletins pour <span className="font-semibold uppercase text-foreground">{assignedClassroomName}</span> ({students.length} élèves)</span>
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
                            variant={isSimulationMode ? "default" : "outline"}
                            className={cn("h-9 rounded-xl font-bold gap-2", isSimulationMode && "bg-blue-600 hover:bg-blue-700 text-white")}
                            onClick={() => setIsSimulationMode(!isSimulationMode)}
                        >
                            <Calculator className="h-4 w-4" />
                            Mode Simulation
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

                        {/* Sort selector */}
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
                        
                        {isPeriodClosed ? (
                            <Badge className="h-9 rounded-xl font-bold gap-2 bg-emerald-100 text-emerald-700 border-emerald-200 px-4 whitespace-nowrap">
                                <CheckCircle2 className="h-4 w-4" />
                                Période Clôturée
                            </Badge>
                        ) : (
                            <Button
                                variant="outline"
                                className="h-9 rounded-xl font-bold border-destructive/20 text-destructive hover:bg-destructive/10 whitespace-nowrap"
                                onClick={handleClosePeriod}
                                disabled={isClosingPeriod}
                            >
                                {isClosingPeriod ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                                Clôturer Période
                            </Button>
                        )}
                    </div>
                </div>

                {isSimulationMode && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm">
                        <p className="font-bold mb-1">Mode Simulation Activé</p>
                        <p>Les bulletins incluent les périodes non clôturées et traitent les cotes manquantes (absences) comme des zéros afin de montrer une projection réaliste des performances actuelles.</p>
                    </div>
                )}
            </div>

            <div className={`space-y-12 ${isPrinting ? 'printable-area' : ''}`}>
                {sortedBulletins.length === 0 ? (
                    <div className="text-center py-20 bg-white/50 rounded-2xl border border-dashed border-gray-300">
                        <p className="text-muted-foreground">Aucun élève trouvé ou configuration des cours manquante.</p>
                    </div>
                ) : (
                    sortedBulletins.map((data) => (
                        <div key={data.student.id} className="bg-white shadow-xl md:rounded-lg overflow-hidden hide-overflow-on-print border border-gray-200">
                            <BulletinTemplate data={data} />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
