"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, Loader2, Calculator } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TotalsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { schoolData, isLoading } = useSchoolData();
    const courseId = params.courseId as string;
    const classroomName = searchParams.get("classroom") || "";
    const courseName = searchParams.get("courseName") || "";
    const periodId = searchParams.get("periodId");
    
    const activePeriodName = useMemo(() => {
        const rawParam = searchParams.get("period");
        if (rawParam && rawParam !== "all" && rawParam !== "Période Sélectionnée") return rawParam;
        
        if (!schoolData?.calendar) return "Période Sélectionnée";
        const rawLevel = (schoolData.calendar as any)?.level || "secondaire";
        const levelKey = rawLevel.toLowerCase().includes("primaire") ? "primaire" : "secondaire";
        const periods = (schoolData.calendar as any)?.[levelKey]?.periods || [];
        const active = periods.find((p: any) => p.id === periodId) || periods.find((p: any) => p.isActive);
        return active?.name || "Période Sélectionnée";
    }, [searchParams, schoolData, periodId]);

    const availablePeriods = useMemo(() => {
        if (!schoolData?.calendar) return [];
        const rawLevel = (schoolData.calendar as any)?.level || "secondaire";
        const levelKey = rawLevel.toLowerCase().includes("primaire") ? "primaire" : "secondaire";
        return (schoolData.calendar as any)?.[levelKey]?.periods || [];
    }, [schoolData]);

    const handlePeriodChange = (newPeriodId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set("periodId", newPeriodId);
        const selected = availablePeriods.find((p: any) => p.id === newPeriodId);
        if (selected) {
            url.searchParams.set("period", selected.name);
        } else if (newPeriodId === "all") {
            url.searchParams.set("period", "Toute l'année");
        }
        router.push(url.toString());
    };
    const [assessments, setAssessments] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [simulateAbsentZero, setSimulateAbsentZero] = useState(false);

    const getInitials = (first: string, last: string) => {
        return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
    };

    const fetchAssessments = useCallback(async () => {
        if (!courseId) return;
        setIsFetching(true);
        try {
            let url = `/api/teacher/grades?courseId=${courseId}&classroomId=${classroomName}&matricule=${schoolData?.matricule}`;
            if (periodId && periodId !== "all") {
                url += `&periodId=${periodId}`;
            }
            const res = await fetch(url, { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                // Confirmed assessments contribute their maxima and weights even
                // before results are published.
                setAssessments(data.assessments || []);
            }
        } catch {
            console.error("Failed to fetch assessments");
        } finally {
            setIsFetching(false);
        }
    }, [courseId, classroomName, schoolData?.matricule, periodId]);

    useEffect(() => {
        if (schoolData) fetchAssessments();
    }, [fetchAssessments, schoolData]);

    const students = useMemo(() => {
        if (!classroomName) return [];
        return ((schoolData?.students as any[]) || []).filter(
            (s: any) => s.classroomName === classroomName
        ).sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [schoolData, classroomName]);

    // Resolve BaseMax (Same logic as CourseDetailPage)
    const baseMax = useMemo(() => {
        if (!courseId || !schoolData) return 20;
        
        // 1. Resolve level for exam weighing
        const rawLevel = (schoolData.calendar as any)?.level || "secondaire";
        const levelKey = rawLevel.toLowerCase().includes("primaire") ? "primaire" : "secondaire";
        const periods = (schoolData.calendar as any)?.[levelKey]?.periods || [];
        const active = periods.find((p: any) => p.isActive) || periods.find((p: any) => p.id === periodId);
        const isExam = active?.type === 'exam';

        // 2. Find course in configuration
        const coursesObj = schoolData.courses as any || {};
        const parts = decodeURIComponent(courseId).split('-');
        const cName = courseName.trim().toLowerCase();
        
        const normalizeGrade = (g: string) => {
            if (!g) return "";
            let norm = g.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
            norm = norm.replace(/([2-9])eme/g, '$1e');
            norm = norm.replace(/education de base/g, 'cteb');
            return norm.replace(/\s+/g, ' ');
        };

        const classroomStr = normalizeGrade(classroomName);
        let foundMax = 20;
        
        const gradeKey = Object.keys(coursesObj).find(k => {
            const kLower = normalizeGrade(k);
            return kLower === classroomStr || 
                   classroomStr.includes(kLower) || 
                   kLower.includes(classroomStr.split(' ')[0]);
        });

        if (gradeKey && Array.isArray(coursesObj[gradeKey])) {
            const match = coursesObj[gradeKey].find((c: any) => c.name?.trim().toLowerCase() === cName);
            if (match) foundMax = match.maxPoints ?? match.max ?? 20;
        } else {
            // Fallback
            for (const gKey of Object.keys(coursesObj)) {
                if (Array.isArray(coursesObj[gKey])) {
                    const match = coursesObj[gKey].find((c: any) => c.name?.trim().toLowerCase() === cName);
                    if (match && (match.maxPoints || match.max)) {
                        foundMax = match.maxPoints ?? match.max ?? 20;
                        break;
                    }
                }
            }
        }

        return foundMax * (isExam ? 2 : 1);
    }, [courseId, schoolData, courseName, periodId]);

    // Calculate totals for each student
    const studentTotals = useMemo(() => {
        const totals: Record<string, { maxPossible: number; earned: number; pct: number; normalized: number; isBlocked: boolean }> = {};
        
        students.forEach((student) => {
            let maxPossible = 0;
            let earned = 0;
            let isBlocked = false;

            assessments.forEach((assessment) => {
                // Exclude suspended
                if (assessment.isSuspended) return;

                const pondere = assessment.pondere ?? assessment.maxScore;
                const result = assessment.results?.find((r: any) => r.studentId === student.id);
                
                // Always count the full weight in the denominator
                maxPossible += pondere;

                if (result?.isAbsent) {
                    if (simulateAbsentZero) {
                        // Already added to maxPossible
                    } else {
                        isBlocked = true;
                    }
                } else if (result && !result.isAbsent && assessment.maxScore > 0) {
                    const normalizedScore = (parseFloat(result.publishedScore) / assessment.maxScore) * pondere;
                    earned += normalizedScore;
                }
            });

            const pct = isBlocked ? 0 : (maxPossible > 0 ? (earned / maxPossible) * 100 : 0);
            const normalized = isBlocked ? 0 : (maxPossible > 0 ? (earned / maxPossible) * baseMax : 0);
            totals[student.id] = { maxPossible, earned, pct, normalized, isBlocked };
        });

        return totals;
    }, [students, assessments, baseMax, simulateAbsentZero]);

    if (isLoading) return <Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Calculator className="h-6 w-6 text-primary" />
                            Totaux Individuels
                        </h1>
                        <div className="flex items-center text-muted-foreground text-sm mt-0.5">
                            <span className="mr-1">{courseName} — {classroomName} —</span>
                            <Select 
                                value={periodId || "all"} 
                                onValueChange={handlePeriodChange}
                            >
                                <SelectTrigger className="h-6 text-sm border-none bg-transparent shadow-none px-1 py-0 focus:ring-0 text-muted-foreground font-medium hover:bg-secondary/50 rounded flex gap-1 items-center w-auto -ml-1 data-[state=open]:bg-secondary/50">
                                    <SelectValue placeholder="Sélectionner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toute l'année</SelectItem>
                                    {availablePeriods.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 bg-secondary/30 p-3 rounded-lg border border-secondary mt-4 md:mt-0">
                    <div className="flex flex-col text-right">
                        <Label htmlFor="simulate" className="font-bold text-sm">Mode Simulation</Label>
                        <span className="text-xs text-muted-foreground mt-0.5">Calculer "Absent" comme un 0</span>
                    </div>
                    <Switch 
                        id="simulate" 
                        checked={simulateAbsentZero} 
                        onCheckedChange={setSimulateAbsentZero}
                        className="data-[state=checked]:bg-amber-600"
                    />
                </div>
            </div>

            {/* Main Content */}
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Répartition par élève</CardTitle>
                        <CardDescription>
                            Les totaux prennent en compte les pondérations et ignorent les épreuves exemptées.
                        </CardDescription>
                    </div>
                    <Badge variant="outline">
                        {assessments.length} épreuves enregistrées
                    </Badge>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead>Élève</TableHead>
                                <TableHead className="text-right">Max. Possible</TableHead>
                                <TableHead className="text-right text-primary">Points Obtenus</TableHead>
                                <TableHead className="text-right font-bold text-teal-600">MOY. / {baseMax}</TableHead>
                                <TableHead className="text-right">Pourcentage</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isFetching ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                                    </TableCell>
                                </TableRow>
                            ) : students.length > 0 ? (
                                students.map((student) => {
                                    const stats = studentTotals[student.id];
                                    const isPassing = stats.pct >= 50;

                                    return (
                                        <TableRow key={student.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarImage src={student.photo} />
                                                        <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-semibold">{student.lastName} {student.firstName}</span>
                                                </div>
                                            </TableCell>
                                            {stats.isBlocked ? (
                                                <TableCell colSpan={4} className="text-center bg-red-50/50">
                                                    <div className="flex items-center justify-center gap-2 text-destructive font-bold">
                                                        <Badge variant="outline" className="border-red-200 text-red-600 bg-white">ABSENCE NON RÉSOLUE</Badge>
                                                        <span className="text-xs text-muted-foreground/70 font-normal">Le calcul du total est suspendu.</span>
                                                    </div>
                                                </TableCell>
                                            ) : (
                                                <>
                                                    <TableCell className="text-right font-medium text-muted-foreground">
                                                        {stats.maxPossible.toFixed(1)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-primary text-base">
                                                        {stats.earned.toFixed(1)}
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-teal-600">
                                                        {stats.normalized.toFixed(1)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Badge variant={isPassing ? "secondary" : "destructive"} className={isPassing ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                                                            {stats.pct.toFixed(1)}%
                                                        </Badge>
                                                    </TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic">
                                        Aucun élève trouvé dans ce local.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
