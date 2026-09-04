"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
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
import { Badge } from "@/components/ui/badge";
import { 
    ChevronLeft, 
    Trophy, 
    Target, 
    TrendingUp,
    User,
    Award,
    Loader2
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { classroomNamesMatch } from "@/lib/classroom-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";

export default function StudentPerformancePage() {
    const { studentId } = useParams();
    const router = useRouter();
    const { schoolData, user, isLoading } = useSchoolData();
    const [allAssessments, setAllAssessments] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    const rawClassroomId = user?.profile?.assignedClassroom;
    const assignedClassroomName = useMemo(() => {
        if (!rawClassroomId || !schoolData) return rawClassroomId || "";
        return (schoolData?.classrooms as any[])?.find((c: any) => c.id === rawClassroomId)?.name || rawClassroomId;
    }, [rawClassroomId, schoolData]);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const isSecondary = user?.profile?.level?.toLowerCase() === "secondaire";

    // 1. Resolve Active Period
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

    // 2. Fetch Grades (same as panoramic)
    useEffect(() => {
        const fetchSubmissionsAndGrades = async () => {
            if (!rawClassroomId || !schoolData?.matricule) return;
            setIsFetching(true);
            try {
                // 1. Fetch grades using UUID directly
                let url = `/api/teacher/grades?classroomId=${encodeURIComponent(rawClassroomId)}&matricule=${schoolData.matricule}`;
                const resGrades = await fetch(url);
                if (resGrades.ok) {
                    const data = await resGrades.json();
                    setAllAssessments(data.assessments || []);
                }

                // 2. Fetch submissions (clôture) using UUID directly
                const periodId = activePeriod?.id;
                const resSubs = await fetch(`/api/teacher/grades/close?classroomId=${encodeURIComponent(rawClassroomId)}${periodId ? `&periodId=${periodId}` : ""}&matricule=${schoolData.matricule}`);
                if (resSubs.ok) {
                    const dataSubs = await resSubs.json();
                    setSubmissions(dataSubs.submissions || []);
                }

            } catch (error) {
                console.error("Failed to fetch data on detail page", error);
            } finally {
                setIsFetching(false);
            }
        };
        fetchSubmissionsAndGrades();
    }, [rawClassroomId, schoolData, activePeriod]);

    // 3. Resolve Courses and BaseMax
    const classroomCourses = useMemo(() => {
        if (!rawClassroomId || !schoolData?.timetables) return [];
        const slots = (schoolData.timetables as any)[rawClassroomId] || (schoolData.timetables as any)[assignedClassroomName] || {};
        const courseNames = new Set<string>();
        Object.values(slots).forEach((slot: any) => {
            if (slot.course) courseNames.add(slot.course);
        });
        
        const coursesObj = (schoolData?.courses as any) || {};
        // Resolve the classroom key in the course list robustly (case/accents differ:
        // e.g. "1ère Maternelle" vs "1ERE MATERNELLE", "7e CTEB" vs "7EME EDUCATION DE BASE")
        const gradeKey = Object.keys(coursesObj).find(k => classroomNamesMatch(k, assignedClassroomName));
        const gradeCourses = gradeKey ? coursesObj[gradeKey] : [];

        return Array.from(courseNames).map(name => {
            const config = Array.isArray(gradeCourses) ? gradeCourses.find((c: any) => c.name?.trim().toLowerCase() === name.trim().toLowerCase()) : null;
            return { name, baseMax: config?.maxPoints || config?.max || 20 };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [assignedClassroomName, schoolData, rawClassroomId]);

    const totalBaseMax = useMemo(() => classroomCourses.reduce((sum, c) => sum + c.baseMax, 0), [classroomCourses]);

    // 4. Calculate All Student Totals for Ranking
    const studentsSummary = useMemo(() => {
        if (!schoolData?.students || !classroomCourses.length) return [];
        const classroomStudents = (schoolData.students as any[]).filter(s => s.classroomName === assignedClassroomName);
        
        const summaries = classroomStudents.map(student => {
            let totalEarned = 0;
            let count = 0;

            classroomCourses.forEach(course => {
                const courseAssessments = allAssessments.filter(a => {
                    const cName = (a.course?.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                    const target = course.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                    const cId = (a.courseId || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                    const title = (a.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                    const isPub = a.isPublished === true || a.isPublished === 1 || String(a.isPublished) === "true";
                    if (!isPub) return false;

                    // Priority 1: Exact Name Match
                    if (cName && cName === target) return true;
                    
                    // Priority 2: ID contains Target slug
                    const targetSlug = target.replace(/\s+/g, '-');
                    if (cId && (cId === targetSlug || cId.includes(targetSlug))) return true;

                    // Priority 3: Fuzzy fallback ONLY if no Course Name
                    if (!cName || cName === "") {
                        const targetParen = target.match(/\(([^)]+)\)/)?.[0];
                        if (targetParen) {
                            if (!cId.includes(targetParen) && !title.includes(targetParen)) return false;
                        }

                        const targetWords = target.split(/[\s\-_()]+/).filter((w: string) => w.length >= 3);
                        if (targetWords.length > 0) {
                            return targetWords.some((w: string) => cId.includes(w) || title.includes(w));
                        }
                    }

                    return false;
                });
                let cTotalEarned = 0;
                let cTotalPossible = 0;
                
                courseAssessments.forEach(ass => {
                    // Extremely permissive student matching: check both id and matricule, slugified and case-insensitive
                    const result = ass.results?.find((r: any) => {
                        const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                        return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                    });

                    if (result) {
                        const pondere = Number(ass.pondere || ass.maxScore || 1);
                        cTotalEarned += (Number(result.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                        cTotalPossible += pondere;
                    }
                });
                
                const normalizeStr = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
                const targetCourseNorm = normalizeStr(course.name);

                // IMPORTANT: Check if course is closed for totals
                const isClosed = submissions.some((s: any) => {
                    if ((course as any).id && s.courseId === (course as any).id) return true;
                    const subCourseNorm = normalizeStr(s.course?.name);
                    return subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
                });

            if (cTotalPossible > 0) {
                if (isClosed) {
                    totalEarned += (cTotalEarned / cTotalPossible) * course.baseMax;
                }
                count++;
            }
        });

        return {
            id: student.id,
            name: `${student.lastName} ${student.firstName}`,
            total: totalEarned,
            percentage: totalBaseMax > 0 ? (totalEarned / totalBaseMax) * 100 : 0
        };
    });

        return summaries.sort((a, b) => b.total - a.total);
    }, [schoolData?.students, classroomCourses, allAssessments, assignedClassroomName, totalBaseMax]);

    const student = useMemo(() => (schoolData?.students as any[])?.find(s => s.id === studentId), [schoolData, studentId]);
    const performance = useMemo(() => studentsSummary.find(s => s.id === studentId), [studentsSummary, studentId]);
    const rank = useMemo(() => studentsSummary.findIndex(s => s.id === studentId) + 1, [studentsSummary, studentId]);

    const courseDetails = useMemo(() => {
        if (!studentId || !classroomCourses.length) return [];
        return classroomCourses.map(course => {
            const courseAssessments = allAssessments.filter(a => {
                const cName = (a.course?.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                const target = course.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
                const cId = (a.courseId || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const title = (a.title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                const isPub = a.isPublished === true || a.isPublished === 1 || String(a.isPublished) === "true";
                if (!isPub) return false;

                // Priority 1: Exact Name Match
                if (cName && cName === target) return true;
                
                // Priority 2: ID contains Target slug
                const targetSlug = target.replace(/\s+/g, '-');
                if (cId && (cId === targetSlug || cId.includes(targetSlug))) return true;

                // Priority 3: Fuzzy fallback ONLY if no Course Name
                if (!cName || cName === "") {
                    const targetParen = target.match(/\(([^)]+)\)/)?.[0];
                    if (targetParen) {
                        if (!cId.includes(targetParen) && !title.includes(targetParen)) return false;
                    }
                        const targetWords = target.split(/[\s\-_()]+/).filter((w: string) => w.length >= 3);
                        if (targetWords.length > 0) {
                            return targetWords.some((w: string) => cId.includes(w) || title.includes(w));
                        }
                    }
                    return false;
                });

            let cTotalEarned = 0;
            let cTotalPossible = 0;
            let hasAbsence = false;
            
            courseAssessments.forEach(ass => {
                const result = ass.results?.find((r: any) => {
                    const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    const sId = String(studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    const sMat = String(student?.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                });

                if (result) {
                    if (result.isAbsent) hasAbsence = true;
                    
                    const pondere = Number(ass.pondere || ass.maxScore || 1);
                    cTotalEarned += (Number(result.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                    cTotalPossible += pondere;
                }
            });

            const normalizeStr = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";
            const targetCourseNorm = normalizeStr(course.name);

            const isClosed = submissions.some((s: any) => {
                if ((course as any).id && s.courseId === (course as any).id) return true;
                const subCourseNorm = normalizeStr(s.course?.name);
                return subCourseNorm === targetCourseNorm || subCourseNorm.includes(targetCourseNorm) || targetCourseNorm.includes(subCourseNorm);
            });

            let finalResult = null;
            if (hasAbsence) {
                finalResult = -888;
            } else if (cTotalPossible > 0) {
                finalResult = isClosed ? (cTotalEarned / cTotalPossible) * course.baseMax : -999;
            }

            return {
                name: course.name,
                result: finalResult,
                baseMax: course.baseMax,
                isClosed
            };
        });
    }, [studentId, classroomCourses, allAssessments, student]);

    if (isLoading || isFetching) {
        return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!student || !performance) {
        return <div className="text-center py-10">Élève non trouvé</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2 -ml-2">
                    <ChevronLeft className="h-4 w-4" /> Retour à la vue panoramique
                </Button>
            </div>

            {/* Page Title */}
            <div className="border-b pb-2">
                <h1 className="text-2xl font-black tracking-tight">Fiche Individuelle</h1>
                <p className="text-sm text-muted-foreground">Détails de performance pour la période {activePeriod?.name || "en cours"}</p>
            </div>

            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 rounded-xl p-4 border">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-4 border-primary/20">
                        <AvatarImage src={student.photo} />
                        <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-2xl font-black">{student.lastName} {student.firstName}</h2>
                        <p className="text-muted-foreground font-mono text-sm">{student.matricule}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                            <Badge variant="secondary" className="font-semibold">{assignedClassroomName}</Badge>
                            <Badge variant="outline" className="border-primary/30 text-primary">{activePeriod?.name || "Période Active"}</Badge>
                        </div>
                    </div>
                </div>
            </header>
            
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-primary/5 border-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-primary/10 text-primary"><Trophy className="h-6 w-6" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold">Position</p>
                            <p className="text-xl font-black">{rank}<sup>{rank === 1 ? 'er' : 'ème'}</sup> / {studentsSummary.length}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-teal-500/5 border-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600"><Target className="h-6 w-6" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold">Total Obtenu</p>
                            <p className="text-xl font-black text-teal-600">{performance.total.toFixed(1)} <span className="text-sm text-teal-600/60 font-medium">/ {totalBaseMax}</span></p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-blue-500/5 border-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600"><TrendingUp className="h-6 w-6" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold">Pourcentage</p>
                            <p className="text-xl font-black text-blue-600">{performance.percentage.toFixed(1)} %</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-amber-500/5 border-none">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600"><Award className="h-6 w-6" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold">Mention</p>
                            <p className="text-xl font-black text-amber-600">
                                {performance.percentage >= 90 ? 'E' : 
                                 performance.percentage >= 80 ? 'TB' : 
                                 performance.percentage >= 70 ? 'B' : 
                                 performance.percentage >= 60 ? 'AB' :
                                 performance.percentage >= 50 ? 'S' : 'I'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30">
                    <CardTitle>Bulletin de Performance</CardTitle>
                    <CardDescription>Résultats détaillés par cours pour la période {activePeriod?.name}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/10">
                                <TableHead className="font-bold">Cours</TableHead>
                                <TableHead className="text-right font-bold w-[120px]">Note / Max</TableHead>
                                <TableHead className="text-right font-bold w-[120px]">Pourcentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {courseDetails.map(detail => (
                                <TableRow key={detail.name}>
                                    <TableCell className="font-medium">{detail.name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {detail.result === -999 ? (
                                            <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200 bg-amber-50">En Cours</Badge>
                                        ) : detail.result === -888 ? (
                                            <Badge variant="destructive" className="text-[9px] bg-red-100 text-red-700 border-none hover:bg-red-100">ABSENT</Badge>
                                        ) : detail.result !== null ? (
                                            <>
                                                <span className={detail.result < (detail.baseMax / 2) ? "text-destructive font-bold" : "font-bold"}>
                                                    {detail.result.toFixed(1)}
                                                </span>
                                                <span className="text-muted-foreground ml-1">/ {detail.baseMax}</span>
                                            </>
                                        ) : "--"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {detail.result === -999 ? (
                                            <span className="text-muted-foreground/30 text-xs">A clôturer</span>
                                        ) : detail.result === -888 ? (
                                            <span className="text-red-500 font-bold text-xs">0%</span>
                                        ) : detail.result !== null ? (
                                            <Badge variant={detail.result < (detail.baseMax / 2) ? "destructive" : "secondary"}>
                                                {((detail.result / detail.baseMax) * 100).toFixed(0)}%
                                            </Badge>
                                        ) : "--"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
