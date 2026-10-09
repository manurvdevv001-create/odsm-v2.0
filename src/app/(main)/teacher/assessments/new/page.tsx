"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription,
    CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
    Loader2, 
    Save, 
    X, 
    AlertCircle,
    Info
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, matchTeacherName } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Send, History, Check, CheckCircle2 } from "lucide-react";
import { SmartStudentName } from "@/components/ui/SmartStudentName";
import { useStudentDisplay } from "@/components/providers/StudentDisplayProvider";
import { classroomNamesMatch } from "@/lib/classroom-utils";

export default function NewAssessmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { schoolData, user, isLoading, refreshData } = useSchoolData();
    const { globalDisplayMode, setGlobalDisplayMode } = useStudentDisplay();
    const [isSaving, setIsSaving] = useState(false);

    const initialCourseId = searchParams.get("courseId") || "";
    const editId = searchParams.get("editId") || "";
    const isEditMode = !!editId;

    // Form State
    const [title, setTitle] = useState("");
    const [type, setType] = useState("INTERRO");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [maxScore, setMaxScore] = useState("10");
    const [pondere, setPondere] = useState("");
    const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId);
    const [selectedPeriodId, setSelectedPeriodId] = useState("");
    const [errors, setErrors] = useState<Record<string, boolean>>({});
    const [isLoadingEdit, setIsLoadingEdit] = useState(isEditMode);
    const [isPublished, setIsPublished] = useState(false);
    const [hasPendingChanges, setHasPendingChanges] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    
    // Students results state: { studentId: score }
    const [results, setResults] = useState<Record<string, string>>({});
    const [exemptions, setExemptions] = useState<Record<string, boolean>>({});
    const [absences, setAbsences] = useState<Record<string, boolean>>({});
    const [searchTerms, setSearchTerms] = useState("");

    // Exemption Dialog State
    const [exemptionDialog, setExemptionDialog] = useState<{ isOpen: boolean, studentId: string, studentName: string } | null>(null);
    const [exemptionOption, setExemptionOption] = useState<"A" | "B" | "C">("A");
    const [exemptionReasons, setExemptionReasons] = useState<Record<string, string>>({});
    const [studentHistoryStats, setStudentHistoryStats] = useState<{ average: number | null, assessmentCount: number } | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

    const classAverage = useMemo(() => {
        const scores = Object.entries(results)
            .filter(([id]) => !exemptions[id] && !absences[id] && results[id] !== "" && !isNaN(parseFloat(results[id])))
            .map(([_, s]) => parseFloat(s));
        
        if (scores.length === 0) return null;
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    }, [results, exemptions, absences]);

    const assignedCourses = useMemo(() => {
        try {
            return JSON.parse(user?.profile?.assignedCourses || "[]");
        } catch {
            return [];
        }
    }, [user]);

    // Available courses for the teacher (all assigned courses across all classrooms)
    const availableCourses = useMemo(() => {
        const timetables = schoolData?.timetables || {};
        const teacherProfileName = user?.name || "";
        const allAvailable: any[] = [];

        const addIfUnique = (course: any) => {
            if (!allAvailable.some(c => c.id === course.id)) {
                allAvailable.push(course);
            }
        };

        // 1. Process Structured Assignments from profile
        assignedCourses.forEach((assignment: any) => {
            if (typeof assignment === 'object' && assignment !== null) {
                const classroomId = assignment.classroom || "Non assigné";
                const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                (assignment.courses || []).forEach((courseName: string) => {
                    addIfUnique({
                        name: `${courseName} - ${cName}`,
                        courseName: courseName,
                        classroom: classroomId,
                        classroomName: cName,
                        id: `${classroomId}-${courseName}`.replace(/\s+/g, '-')
                    });
                });
            } else if (typeof assignment === 'string') {
                const courseName = assignment;
                Object.entries(timetables).forEach(([classroomId, slots]: [string, any]) => {
                    const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                    Object.values(slots).forEach((slot: any) => {
                        const sCourse = slot.course?.toLowerCase().trim();
                        const sTeacher = slot.teacher;
                        if (sCourse === courseName.toLowerCase().trim() && matchTeacherName(teacherProfileName, sTeacher)) {
                            addIfUnique({
                                name: `${courseName} - ${cName}`,
                                courseName: courseName,
                                classroom: classroomId,
                                classroomName: cName,
                                id: `${classroomId}-${courseName}`.replace(/\s+/g, '-')
                            });
                        }
                    });
                });
            }
        });

        // 2. Safety Fallback: Scan ALL timetables for the teacher's name
        Object.entries(timetables).forEach(([classroomId, slots]: [string, any]) => {
            const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
            Object.values(slots).forEach((slot: any) => {
                if (matchTeacherName(teacherProfileName, slot.teacher)) {
                    const courseName = slot.course;
                    if (courseName) {
                        addIfUnique({
                            name: `${courseName} - ${cName}`,
                            courseName: courseName,
                            classroom: classroomId,
                            classroomName: cName,
                            id: `${classroomId}-${courseName}`.replace(/\s+/g, '-')
                        });
                    }
                }
            });
        });

        // 3. For Primary/Maternelle teachers (Titulaires)
        const roleLevel = user?.profile?.level?.toLowerCase() || "";
        const isTitulaire = roleLevel === "primaire" || roleLevel === "maternelle" || roleLevel === "primaire/maternelle";
        const titulaireClassroom = user?.profile?.assignedClassroom ? String(user.profile.assignedClassroom) : "";

        if (isTitulaire && titulaireClassroom) {
            const classroomSlots = (timetables as Record<string, any>)[titulaireClassroom] || {};
            const cName = schoolData?.classrooms?.find((c: any) => c.id === titulaireClassroom)?.name || titulaireClassroom;
            Object.values(classroomSlots).forEach((slot: any) => {
                if (slot.course) {
                    addIfUnique({
                        name: `${slot.course} - ${cName}`,
                        courseName: slot.course,
                        classroom: titulaireClassroom,
                        classroomName: cName,
                        id: `${titulaireClassroom}-${slot.course}`.replace(/\s+/g, '-')
                    });
                }
            });
        }

        return allAvailable;
    }, [assignedCourses, schoolData, user]);

    // Prepopulate selection if not provided and not titulaire
    useEffect(() => {
        if (!selectedCourseId && availableCourses.length > 0) {
            const urlCourseId = searchParams.get("courseId");
            if (urlCourseId) {
                const decoded = decodeURIComponent(urlCourseId);
                const match = availableCourses.find(c => c.id === decoded || decodeURIComponent(c.id) === decoded);
                if (match) {
                    setSelectedCourseId(match.id);
                } else {
                    setSelectedCourseId(availableCourses[0].id);
                }
            } else if (!user?.profile?.assignedClassroom) {
                // Not a titulaire, so we MUST pick a course to show any students
                setSelectedCourseId(availableCourses[0].id);
            }
        }
    }, [availableCourses, selectedCourseId, searchParams, user]);

    // Resolve course and classroom from selectedCourseId
    const courseInfo = useMemo(() => {
        if (!selectedCourseId) return null;
        const decoded = decodeURIComponent(selectedCourseId);
        return availableCourses.find(c => c.id === selectedCourseId || c.id === decoded || decodeURIComponent(c.id) === decoded);
    }, [selectedCourseId, availableCourses]);

    const targetClassroomId = useMemo(() => {
        return courseInfo?.classroom || user?.profile?.assignedClassroom || "";
    }, [courseInfo, user]);

    const targetClassroomName = useMemo(() => {
        return courseInfo?.classroomName || schoolData?.classrooms?.find((c: any) => c.id === targetClassroomId)?.name || targetClassroomId;
    }, [schoolData, targetClassroomId, courseInfo]);

    const students = useMemo(() => {
        if (!targetClassroomName) return [];
        let filtered = (schoolData?.students as any[])?.filter(
            (s: any) => classroomNamesMatch(s.classroomName || s.gradeName, targetClassroomName)
        ) || [];

        if (selectedPeriodId === "REP" && courseInfo?.courseName) {
            const courseNameNorm = normalize(courseInfo.courseName);
            filtered = filtered.filter(s => {
                try {
                    const data = typeof s.data === 'string' ? JSON.parse(s.data) : (s.data || {});
                    const repCourses = Array.isArray(data.repechageCourses) ? data.repechageCourses : [];
                    return repCourses.some((c: string) => normalize(c) === courseNameNorm);
                } catch {
                    return false;
                }
            });
        }
        return filtered;
    }, [schoolData, targetClassroomName, selectedPeriodId, courseInfo]);

    // Periods logic with active period discovery
    const [periods, setPeriods] = useState<any[]>([]);
    
    const activePeriod = useMemo(() => {
        if (!schoolData) return null;
        const rawLevel = user?.profile?.level?.toLowerCase() || "secondaire";
        // Resolve true level from the targeted classroom name
        let calLevel = rawLevel;
        if (targetClassroomName) {
            const cn = targetClassroomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (cn.includes("maternelle")) calLevel = "maternelle";
            else if (cn.includes("primaire")) calLevel = "primaire";
            else calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        } else {
            calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        }
        const pList = (schoolData.calendar as any)?.[calLevel]?.periods || [];
        const active = pList.find((p: any) => p.isActive);
        const resolved = active || pList[0];
        
        if (resolved) return resolved;
        
        // Fallback: Current date matching
        const now = new Date();
        return pList.find((p: any) => {
            const start = new Date(p.startDate);
            const end = new Date(p.endDate);
            return now >= start && now <= end;
        }) || pList[0];
    }, [schoolData, user, targetClassroomName]);

    const isCourseLocked = !!searchParams.get("courseId");
    const isPeriodLocked = !!activePeriod;

    useEffect(() => {
        const fetchPeriods = async () => {
            try {
                const rawLevel = user?.profile?.level?.toLowerCase() || "secondaire";
                let calLevel = rawLevel;
                if (targetClassroomName) {
                    const cn = targetClassroomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                    if (cn.includes("maternelle")) calLevel = "maternelle";
                    else if (cn.includes("primaire")) calLevel = "primaire";
                    else calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
                } else {
                    calLevel = rawLevel.includes("primaire") ? "primaire" : rawLevel;
                }
                const res = await fetch(`/api/school/periods?matricule=${schoolData?.matricule}&level=${calLevel}`);
                if (res.ok) {
                    const data = await res.json();
                    setPeriods(data);

                    const active = data.find((p: any) => p.isActive);
                    if (active) {
                        setSelectedPeriodId(active.id);
                    } else if (data.length > 0) {
                        setSelectedPeriodId(data[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch periods");
            }
        };
        if (schoolData?.matricule) fetchPeriods();
    }, [schoolData?.matricule]);

    // Safety effect to ensure selectedPeriodId is NEVER empty if we have periods
    useEffect(() => {
        if (!selectedPeriodId && periods.length > 0) {
            const active = periods.find((p: any) => p.isActive);
            if (active) {
                setSelectedPeriodId(active.id);
            } else {
                setSelectedPeriodId(periods[0].id);
            }
        }
    }, [periods, selectedPeriodId]);

    // Priority: If periodId is passed in URL, use it
    useEffect(() => {
        const urlPeriodId = searchParams.get("periodId");
        if (urlPeriodId && urlPeriodId !== "all") {
            setSelectedPeriodId(urlPeriodId);
        }
    }, [searchParams]);

    // ---- EDIT MODE: Fetch existing assessment data ----
    useEffect(() => {
        if (!editId || !schoolData) return;
        const loadAssessment = async () => {
            setIsLoadingEdit(true);
            try {
                // Fetch all assessments for this course, then find ours by editId
                const courseParam = searchParams.get("courseId") || "";
                const res = await fetch(`/api/teacher/grades?courseId=${courseParam}&classroomId=${targetClassroomId}&matricule=${schoolData?.matricule}`, { cache: "no-store" });
                if (res.ok) {
                    const data = await res.json();
                    const list = data.assessments || [];
                    const existing = list.find((a: any) => a.id === editId);
                    
                    if (existing) {
                        // Accurately check closure for THIS assessment's period
                        let isAssmtClosed = false;
                        if (existing.periodId) {
                            try {
                                const closeRes = await fetch(`/api/teacher/grades/close?courseId=${courseParam}&classroomId=${targetClassroomId}&periodId=${existing.periodId}&matricule=${schoolData?.matricule}`);
                                if (closeRes.ok) {
                                    const closeData = await closeRes.json();
                                    isAssmtClosed = closeData.isClosed;
                                }
                            } catch (e) {
                                console.error("Failed to fetch accurate closure status");
                            }
                        } else if (data.isClosed) {
                             isAssmtClosed = true;
                        }

                        setIsClosed(isAssmtClosed);
                        
                        if (isAssmtClosed) {
                            toast.error("Cette période est CLÔTURÉE. Les modifications sont impossibles.", { duration: 5000 });
                        }

                        setTitle(existing.title || "");
                        setType(existing.type || "INTERRO");
                        setDate(existing.date ? new Date(existing.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                        setMaxScore(String(existing.maxScore || 10));
                        setPondere(existing.pondere !== null && existing.pondere !== undefined ? String(existing.pondere) : "");
                        if (existing.periodId) setSelectedPeriodId(existing.periodId);
                        setIsPublished(!!existing.isPublished);
                        setHasPendingChanges(!!existing.hasPendingChanges);
                        
                        // Pre-fill student scores and exemptions/absences
                        if (existing.results && Array.isArray(existing.results)) {
                            const scoresMap: Record<string, string> = {};
                            const exemptMap: Record<string, boolean> = {};
                            const absentMap: Record<string, boolean> = {};
                            const reasonMap: Record<string, string> = {};
                            existing.results.forEach((r: any) => {
                                scoresMap[r.studentId] = String(r.score);
                                if (r.isExempt) {
                                    exemptMap[r.studentId] = true;
                                    if (r.exemptionReason) reasonMap[r.studentId] = r.exemptionReason;
                                }
                                if (r.isAbsent) absentMap[r.studentId] = true;
                            });
                            setResults(scoresMap);
                            setExemptions(exemptMap);
                            setAbsences(absentMap);
                            setExemptionReasons(reasonMap);
                        }
                    }
                }
            } catch {
                console.error("Failed to load assessment for editing");
            } finally {
                setIsLoadingEdit(false);
            }
        };
        loadAssessment();
    }, [editId, schoolData, targetClassroomId]);

    const isTranscribingAllowed = useMemo(() => {
        if (!selectedPeriodId || periods.length === 0) return true;

        const selected = periods.find(p => p.id === selectedPeriodId);
        if (!selected) return isEditMode && isPublished;

        if (selected.isActive) return true;

        return isEditMode && isPublished;
    }, [periods, selectedPeriodId, isEditMode, isPublished]);

    const handleScoreChange = (studentId: string, score: string) => {
        if (!isTranscribingAllowed) return; // Prevent change if not allowed
        // Basic validation: max score
        const numScore = parseFloat(score);
        const numMax = parseFloat(maxScore);
        
        if (!isNaN(numScore) && numScore > numMax) {
            toast.warning(`Note supérieure au maximum (${maxScore})`);
        }
        
        setResults(prev => ({ ...prev, [studentId]: score }));
    };

    const openExemptionDialog = async (studentId: string, studentName: string) => {
        setExemptionDialog({ isOpen: true, studentId, studentName });
        setExemptionOption("A"); // Default
        setIsLoadingHistory(true);
        setStudentHistoryStats(null);
        
        try {
            // Fetch past assessments to calculate Option C
            let url = `/api/teacher/grades?courseId=${selectedCourseId}&classroomId=${targetClassroomId}`;
            if (selectedPeriodId) url += `&periodId=${selectedPeriodId}`;
            if (schoolData?.matricule) url += `&matricule=${schoolData.matricule}`;
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const list = data.assessments || [];
                // Exclude the current one we are editing
                const otherAssessments = list.filter((a: any) => a.id !== editId);
                
                let totalScore = 0;
                let totalMax = 0;
                let examsCount = 0;

                otherAssessments.forEach((exam: any) => {
                    const studentRes = exam.results?.find((r: any) => r.studentId === studentId);
                    if (studentRes && !studentRes.isExempt && !studentRes.isAbsent) {
                        totalScore += (parseFloat(studentRes.score) || 0);
                        totalMax += (parseFloat(exam.maxScore) || 0);
                        examsCount++;
                    }
                });

                if (examsCount > 0 && totalMax > 0) {
                    const avg = (totalScore / totalMax) * (parseFloat(maxScore) || 10);
                    setStudentHistoryStats({ average: avg, assessmentCount: examsCount });
                } else {
                    setStudentHistoryStats({ average: null, assessmentCount: 0 });
                }
            }
        } catch (e) {
            console.error("Failed to fetch student history");
            setStudentHistoryStats({ average: null, assessmentCount: 0 });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const confirmExemption = () => {
        if (!exemptionDialog) return;
        const sId = exemptionDialog.studentId;
        
        let calculatedScore = 0;
        let reasonString = "";
        
        if (exemptionOption === "A") {
            calculatedScore = parseFloat(maxScore) || 10;
            reasonString = "Option A (Maximum)";
        } else if (exemptionOption === "B") {
            calculatedScore = classAverage !== null ? classAverage : 0;
            reasonString = "Option B (Moyenne Classe)";
        } else if (exemptionOption === "C") {
            calculatedScore = studentHistoryStats?.average !== null ? studentHistoryStats!.average : 0;
            reasonString = "Option C (Moyenne Élève)";
        }

        setExemptions(prev => ({ ...prev, [sId]: true }));
        setExemptionReasons(prev => ({ ...prev, [sId]: reasonString }));
        setAbsences(prev => ({ ...prev, [sId]: false }));
        setResults(prev => ({ ...prev, [sId]: calculatedScore.toFixed(1) }));
        setExemptionDialog(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Final attempt to fix period if it's missing but we have data
        let finalPeriodId = selectedPeriodId;
        if (!finalPeriodId && periods.length > 0) {
            const active = periods.find((p: any) => p.isActive);
            finalPeriodId = active?.id || periods[0].id;
            setSelectedPeriodId(finalPeriodId);
        }

        const newErrors: Record<string, boolean> = {
            title: !title.trim(),
            course: !selectedCourseId,
            period: !finalPeriodId,
            maxScore: !maxScore || parseFloat(maxScore) <= 0
        };

        setErrors(newErrors);
        
        if (Object.values(newErrors).some(v => v)) {
            toast.error("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        setIsSaving(true);
        console.log("Saving assessment...", { title, maxScore, pondere, isEditMode });
        
        // Inform user about potential delay after compilation
        const compilationToast = toast.info("Initialisation de la sauvegarde... (cela peut prendre un moment si le système compile)", { duration: 5000 });

        try {
            const formattedResults = Object.entries(results).map(([studentId, score]) => ({
                studentId,
                score,
                isExempt: !!exemptions[studentId],
                isAbsent: !!absences[studentId],
                exemptionReason: exemptions[studentId] ? (exemptionReasons[studentId] || "Manuelle") : null
            }));
            
            // Also include students who are exempt or absent but don't have a score in `results`
            Object.keys(exemptions).forEach(studentId => {
                if (exemptions[studentId] && !results[studentId]) {
                    formattedResults.push({
                        studentId,
                        score: "0",
                        isExempt: true,
                        isAbsent: false,
                        exemptionReason: exemptionReasons[studentId] || "Manuelle"
                    });
                }
            });
            Object.keys(absences).forEach(studentId => {
                if (absences[studentId] && !results[studentId] && !exemptions[studentId]) {
                    formattedResults.push({
                        studentId,
                        score: "0",
                        isExempt: false,
                        isAbsent: true,
                        exemptionReason: null
                    });
                }
            });

            if (isEditMode) {
                // UPDATE existing assessment
                const res = await fetch("/api/teacher/grades", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        assessmentId: editId,
                        title,
                        type,
                        date,
                        maxScore,
                        pondere: pondere || maxScore,
                        periodId: finalPeriodId,
                        results: formattedResults
                    })
                });

                if (res.ok) {
                    toast.success("\u00c9preuve modifi\u00e9e avec succ\u00e8s !");
                    refreshData();
                    const targetPath = selectedCourseId ? `/teacher/courses/${selectedCourseId}` : "/teacher";
                    router.push(targetPath);
                } else {
                    const err = await res.json();
                    toast.error(err.error || "Une erreur est survenue.");
                }
            } else {
                // CREATE new assessment
                const res = await fetch("/api/teacher/grades", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title,
                        type,
                        date,
                        maxScore,
                        pondere: pondere || maxScore,
                        courseId: selectedCourseId,
                        courseName: courseInfo?.courseName || "",
                        classroomId: targetClassroomId,
                        periodId: finalPeriodId,
                        results: formattedResults,
                        schoolMatricule: schoolData?.matricule
                    })
                });

                if (res.ok) {
                    toast.success("\u00c9preuve et cotes enregistr\u00e9es avec succ\u00e8s !");
                    refreshData();
                    const targetPath = selectedCourseId ? `/teacher/courses/${selectedCourseId}` : "/teacher";
                    router.push(targetPath);
                } else {
                    const err = await res.json();
                    toast.error(err.error || "Une erreur est survenue.");
                }
            }
        } catch (error) {
            toast.error("Erreur de connexion au serveur.");
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublishAction = async (action: "PUBLISH" | "REVERT" | "KEEP") => {
        if (!editId) return;
        
        setIsPublishing(true);
        try {
            const res = await fetch("/api/teacher/grades/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assessmentId: editId, action })
            });

            if (res.ok) {
                if (action === "PUBLISH") toast.success("Résultats publiés avec succès !");
                else if (action === "REVERT") toast.success("Retour aux résultats précédents effectué.");
                
                refreshData();
                router.push(`/teacher/courses/${selectedCourseId}`);
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la publication.");
            }
        } catch {
            toast.error("Erreur de connexion.");
        } finally {
            setIsPublishing(false);
        }
    };

    if (isLoading || isLoadingEdit) return <Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />;

    return (
        <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{isEditMode ? "Modifier l’Épreuve" : "Nouvelle Épreuve"}</h1>
                    <div className="flex items-center gap-2">
                        <p className="text-muted-foreground">Local : <span className="font-semibold text-foreground uppercase">{targetClassroomName || "Non sélectionné"}</span></p>
                        {isClosed && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 ml-2">
                                <CheckCircle2 className="h-4 w-4" />
                                PÉRIODE CLÔTURÉE (LECTURE SEULE)
                            </Badge>
                        )}
                        {!isTranscribingAllowed && !isClosed && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1.5 ml-2">
                                <AlertCircle className="h-4 w-4" />
                                TRANSCRIPTION INACTIVE (PÉRIODE NON ACTIVE)
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        <X className="h-4 w-4 mr-2" /> Annuler
                    </Button>
                    

                    <Button type="submit" disabled={isSaving || isClosed} className="min-w-[120px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        {isClosed ? "Enregistrement désactivé" : "Enregistrer"}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Configuration Card */}
                <Card className="md:col-span-1 shadow-sm border-none bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            Configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title" className={errors.title ? "text-destructive" : ""}>
                                Titre de l&apos;épreuve <span className="text-red-500">*</span>
                            </Label>
                            <Input 
                                id="title" 
                                placeholder="ex: Interrogative de calcul" 
                                value={title}
                                onChange={e => {
                                    setTitle(e.target.value);
                                    if (errors.title) setErrors(prev => ({ ...prev, title: false }));
                                }}
                                className={errors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={type} onValueChange={setType}>
                                    <SelectTrigger id="type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INTERRO">Interrogation</SelectItem>
                                        <SelectItem value="DEVOIR">Devoir</SelectItem>
                                        <SelectItem value="EXAMEN">Examen</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="maxScore" className={errors.maxScore ? "text-destructive" : ""}>
                                    Maximum <span className="text-red-500">*</span>
                                </Label>
                                <Input 
                                    id="maxScore" 
                                    type="number" 
                                    value={maxScore}
                                    onChange={e => {
                                        setMaxScore(e.target.value);
                                        if (errors.maxScore) setErrors(prev => ({ ...prev, maxScore: false }));
                                    }}
                                    className={errors.maxScore ? "border-destructive focus-visible:ring-destructive" : ""}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="pondere">Pondération</Label>
                            <Input 
                                id="pondere" 
                                type="number" 
                                placeholder={maxScore || "= Maximum"}
                                value={pondere}
                                onChange={e => setPondere(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Poids dans le total de la période. Par défaut = Maximum.
                            </p>
                        </div>

                        <div className="space-y-2">
                             <Label htmlFor="date">Date</Label>
                             <DatePicker 
                                 id="date" 
                                 value={date}
                                 onChange={setDate}
                             />
                         </div>

                        <div className="space-y-2">
                            <Label htmlFor="course" className={errors.course ? "text-destructive" : ""}>
                                Cours <span className="text-red-500">*</span>
                            </Label>
                            {isCourseLocked && courseInfo ? (
                                <div className={`flex items-center gap-2 p-2 rounded-md bg-primary/5 border ${errors.course ? "border-destructive" : "border-primary/10"}`}>
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-xs">
                                        {courseInfo.classroom}
                                    </Badge>
                                    <span className="font-bold text-sm">{courseInfo.name}</span>
                                </div>
                            ) : (
                                <Select 
                                    value={selectedCourseId} 
                                    onValueChange={val => {
                                        setSelectedCourseId(val);
                                        if (errors.course) setErrors(prev => ({ ...prev, course: false }));
                                    }}
                                >
                                    <SelectTrigger id="course" className={errors.course ? "border-destructive" : ""}>
                                        <SelectValue placeholder="Sélectionner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCourses.map((c: any) => (
                                            <SelectItem key={c.id} value={c.id}>{c.name} - {c.classroom}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="period" className={errors.period ? "text-destructive" : ""}>
                                Période <span className="text-red-500">*</span>
                            </Label>
                            {(() => {
                                const selected = periods.find(p => p.id === selectedPeriodId);
                                const isActiveSelected = selected?.isActive;
                                if (isPeriodLocked && selected) {
                                    return (
                                        <div className={`p-2 rounded-md bg-amber-50/50 border ${errors.period ? "border-destructive shadow-[0_0_0_1px_rgba(239,68,68,0.5)]" : "border-amber-100"} flex items-center justify-between`}>
                                            <span className="text-sm font-medium">{selected.name}</span>
                                            {isActiveSelected && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px]">Active</Badge>}
                                        </div>
                                    );
                                }
                                return (
                                    <Select 
                                        value={selectedPeriodId} 
                                        onValueChange={val => {
                                            setSelectedPeriodId(val);
                                            if (errors.period) setErrors(prev => ({ ...prev, period: false }));
                                        }}
                                    >
                                        <SelectTrigger id="period" className={errors.period ? "border-destructive" : ""}>
                                            <SelectValue placeholder="Sélectionner..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {periods.map((p: any) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name} ({p.term}){p.isActive ? ' (Active)' : ''}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                );
                            })()}
                            {errors.period && (
                                <p className="text-[10px] text-destructive font-medium">Auto-résolution en cours ou échec de récupération.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Students List Card */}
                <Card className="md:col-span-2 shadow-md border-none">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg">Transcription des résultats</CardTitle>
                            <CardDescription>
                                {targetClassroomName ? "Saisissez les notes pour chaque élève" : "Veuillez d'abord sélectionner un cours"}
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-4">
                            <Select 
                                value={globalDisplayMode} 
                                onValueChange={(v: any) => setGlobalDisplayMode(v)}
                            >
                                <SelectTrigger className="h-6 text-xs border-none bg-transparent shadow-none px-1 py-0 focus:ring-0 text-muted-foreground font-medium hover:bg-secondary/50 rounded flex gap-1 items-center w-auto data-[state=open]:bg-secondary/50">
                                    <SelectValue placeholder="Affichage Noms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="compact">Noms Courts</SelectItem>
                                    <SelectItem value="full">Noms Complets</SelectItem>
                                    <SelectItem value="id">Noms avec Matricule</SelectItem>
                                </SelectContent>
                            </Select>
                            <Badge variant="outline" className="text-xs">
                                Total : {students.length} élèves
                            </Badge>
                        </div>
                    </CardHeader>
                    {selectedPeriodId === "REP" && (
                        <div className="bg-amber-50 border-y border-amber-200 p-3 flex items-start gap-2 text-amber-800 text-sm">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <strong>Évaluation de Repêchage</strong>
                                <p>La liste des élèves est filtrée pour n'afficher que ceux délibérés pour le repêchage dans ce cours.</p>
                            </div>
                        </div>
                    )}
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Élève</TableHead>
                                    <TableHead className="w-[100px] text-center font-black text-blue-600 uppercase text-[10px]">Moy. Classe</TableHead>
                                    <TableHead className="w-[120px] text-right">Note / {maxScore}</TableHead>
                                    {pondere && pondere !== maxScore && (
                                        <TableHead className="w-[100px] text-right italic text-primary/70">Pondéré / {pondere}</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {students.length > 0 ? students.map((student: any) => (
                                    <TableRow key={student.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={student.photo} />
                                                    <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                                </Avatar>
                                                <SmartStudentName student={student} className="font-medium" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-black text-blue-600/80 bg-blue-50/30 text-xs">
                                            {classAverage !== null ? classAverage.toFixed(2) : "--"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <Button
                                                    type="button"
                                                    variant={exemptions[student.id] ? "destructive" : "outline"}
                                                    size="sm"
                                                    className={`h-8 px-2 text-[10px] ${exemptions[student.id] ? "bg-amber-600 hover:bg-amber-700 border-none text-white" : ""}`}
                                                    disabled={!isTranscribingAllowed}
                                                    onClick={() => {
                                                        if (exemptions[student.id]) {
                                                            setExemptions(prev => ({ ...prev, [student.id]: false }));
                                                            setResults(prev => ({ ...prev, [student.id]: "" }));
                                                        } else {
                                                            openExemptionDialog(student.id, `${student.lastName} ${student.firstName}`);
                                                        }
                                                    }}
                                                >
                                                    {exemptions[student.id] ? "Exempté" : "Exempter"}
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant={absences[student.id] ? "destructive" : "outline"}
                                                    size="sm"
                                                    className={`h-8 px-2 text-[10px] ${absences[student.id] ? "bg-red-600 hover:bg-red-700 border-none text-white" : ""}`}
                                                    disabled={!isTranscribingAllowed}
                                                    onClick={() => {
                                                        const isNowAbsent = !absences[student.id];
                                                        setAbsences(prev => ({ ...prev, [student.id]: isNowAbsent }));
                                                        if (isNowAbsent) {
                                                            setExemptions(prev => ({ ...prev, [student.id]: false }));
                                                            setResults(prev => ({ ...prev, [student.id]: "0.0" }));
                                                        }
                                                    }}
                                                >
                                                    {absences[student.id] ? "Absent" : "Absent"}
                                                </Button>

                                                {pondere && pondere !== maxScore && !exemptions[student.id] && !absences[student.id] && (
                                                    <div className="text-sm font-black text-primary italic min-w-[50px]">
                                                        {results[student.id] ? 
                                                            ((parseFloat(results[student.id]) / (parseFloat(maxScore) || 1)) * parseFloat(pondere)).toFixed(1) : 
                                                            "0.0"
                                                        }
                                                    </div>
                                                )}
                                                {(exemptions[student.id] || absences[student.id]) && pondere && pondere !== maxScore && (
                                                    <div className="text-sm font-black text-muted-foreground italic min-w-[50px] line-through opacity-50">
                                                        0.0
                                                    </div>
                                                )}

                                                <Input 
                                                    type="number" 
                                                    step="0.5"
                                                    min="0"
                                                    max={maxScore}
                                                    placeholder="0.0" 
                                                    className={`w-24 text-right font-bold ${(!isTranscribingAllowed || exemptions[student.id] || absences[student.id]) ? 'opacity-70 bg-muted cursor-not-allowed pointer-events-none' : ''}`}
                                                    value={absences[student.id] ? "0" : (results[student.id] || "")}
                                                    onChange={e => handleScoreChange(student.id, e.target.value)}
                                                    disabled={!isTranscribingAllowed || exemptions[student.id] || absences[student.id]}
                                                    tabIndex={(!isTranscribingAllowed || exemptions[student.id] || absences[student.id]) ? -1 : 0}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">
                                            {targetClassroomName 
                                                ? "Aucun élève trouvé dans ce local." 
                                                : "Sélectionnez un cours pour afficher la liste des élèves."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="bg-muted/30 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            Les notes non saisies seront enregistrées à 0 par défaut.
                        </div>
                    </CardFooter>
                </Card>
            </div>

            {/* Exemption Dialog */}
            <Dialog open={!!exemptionDialog} onOpenChange={(open) => !open && setExemptionDialog(null)}>
                <DialogContent className="max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Choix de Compensation</DialogTitle>
                        <DialogDescription>
                            Attribuez une note mathématique figée pour {exemptionDialog?.studentName}.
                            Le statut Exempté sera activé.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <RadioGroup value={exemptionOption} onValueChange={(val: any) => setExemptionOption(val)}>
                            {/* Option A */}
                            <div className={`p-4 border rounded-xl flex items-start gap-4 cursor-pointer transition-colors ${exemptionOption === "A" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setExemptionOption("A")}>
                                <RadioGroupItem value="A" id="opt-a" className="mt-1" />
                                <div className="grid gap-1.5 flex-1">
                                    <Label htmlFor="opt-a" className="font-bold cursor-pointer text-base">Option A : Le Maximum des points</Label>
                                    <p className="text-sm text-muted-foreground">L'élève reçoit la note maximale configurée.</p>
                                    <div className="font-black text-primary text-lg mt-1">{parseFloat(maxScore) || 10} / {maxScore}</div>
                                </div>
                            </div>

                            {/* Option B */}
                            <div className={`p-4 border rounded-xl flex items-start gap-4 cursor-pointer transition-colors ${exemptionOption === "B" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setExemptionOption("B")}>
                                <RadioGroupItem value="B" id="opt-b" className="mt-1" />
                                <div className="grid gap-1.5 flex-1">
                                    <Label htmlFor="opt-b" className="font-bold cursor-pointer text-base">Option B : Moyenne de la Classe</Label>
                                    <p className="text-sm text-muted-foreground">Basé sur les résultats actuels des autres élèves.</p>
                                    <div className="font-black text-primary text-lg mt-1">{classAverage !== null ? classAverage.toFixed(2) : "0.0"} / {maxScore}</div>
                                </div>
                            </div>

                            {/* Option C */}
                            <div className={`p-4 border rounded-xl flex items-start gap-4 cursor-pointer transition-colors ${exemptionOption === "C" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`} onClick={() => setExemptionOption("C")}>
                                <RadioGroupItem value="C" id="opt-c" className="mt-1" />
                                <div className="grid gap-1.5 flex-1">
                                    <Label htmlFor="opt-c" className="font-bold cursor-pointer text-base">Option C : Moyenne de l'élève</Label>
                                    <p className="text-sm text-muted-foreground">Basé sur son historique dans ce cours pour cette période.</p>
                                    {isLoadingHistory ? (
                                        <div className="flex items-center gap-2 mt-2">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-sm italic text-muted-foreground">Calcul...</span>
                                        </div>
                                    ) : (
                                        <div className="font-black text-primary text-lg mt-1">
                                            {typeof studentHistoryStats?.average === 'number' ? studentHistoryStats.average.toFixed(2) : "0.0"} / {maxScore}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </RadioGroup>

                        {!isLoadingHistory && exemptionOption === "C" && studentHistoryStats?.assessmentCount === 0 && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-amber-700 dark:text-amber-400 mt-2">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <div className="text-xs font-medium">
                                    <strong className="block mb-1">Aucune autre épreuve disponible.</strong>
                                    L'historique de l'élève est vide pour l'instant. Si vous validez cette option, une note de 0.0 lui sera provisoirement octroyée. Veuillez revoir cette note (ou annuler l'exemption) avant la clôture !
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setExemptionDialog(null)}>Annuler</Button>
                        <Button className="gradient-btn rounded-xl w-full sm:w-auto" onClick={confirmExemption}>Confirmer & Exempter</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </form>
    );
}
