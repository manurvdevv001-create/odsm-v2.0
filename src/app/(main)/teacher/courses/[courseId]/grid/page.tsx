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
import { ChevronLeft, Loader2, Grid3X3, Calculator, Info, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SmartStudentName } from "@/components/ui/SmartStudentName";
import { useStudentDisplay } from "@/components/providers/StudentDisplayProvider";
import { classroomNamesMatch } from "@/lib/classroom-utils";

export default function GradeGridPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { schoolData, isLoading } = useSchoolData();
    const courseId = params.courseId as string;
    const classroomName = searchParams.get("classroom") || "";
    const courseName = searchParams.get("courseName") || "";
    const periodId = searchParams.get("periodId");
    
    const { globalDisplayMode, setGlobalDisplayMode } = useStudentDisplay();
    
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
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                // Confirmed assessments remain visible so their maxima and weights
                // are represented before results are published.
                const list = (data.assessments || [])
                    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setAssessments(list);
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

    // Calculate totals matching totals/page.tsx but with simulation logic
    const studentTotals = useMemo(() => {
        const totals: Record<string, { maxPossible: number; earned: number }> = {};
        
        students.forEach((student) => {
            let maxPossible = 0;
            let earned = 0;

            assessments.forEach((assessment) => {
                if (assessment.isSuspended) return; 
                
                const pondere = Number(assessment.pondere ?? assessment.maxScore);
                const result = assessment.results?.find((r: any) => {
                    const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                    return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                });
                
                // Always count the full weight in the denominator
                maxPossible += pondere;

                if (result && !result.isAbsent && assessment.maxScore > 0) {
                    const normalizedScore = (parseFloat(result.publishedScore) / assessment.maxScore) * pondere;
                    earned += normalizedScore;
                }
            });

            totals[student.id] = { maxPossible, earned };
        });

        return totals;
    }, [students, assessments]);

    // Resolve the course Base Max from the course list (paramètres initiaux des listes des cours)
    const baseMax = useMemo(() => {
        const coursesObj = (schoolData?.courses as any) || {};
        const norm = (s: string) => s ? s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim() : "";

        const gradeKey = classroomName ? Object.keys(coursesObj).find(k => classroomNamesMatch(k, classroomName)) : undefined;
        if (!gradeKey || !Array.isArray(coursesObj[gradeKey])) return 20;

        const target = norm(courseName);
        const match = coursesObj[gradeKey].find(
            (c: any) => norm(c.name) === target || norm(c.name).includes(target) || target.includes(norm(c.name))
        );
        return match?.maxPoints ?? match?.max ?? 20;
    }, [schoolData, classroomName, courseName]);

    const exemptionsList = useMemo(() => {
        const list: any[] = [];
        assessments.forEach(ass => {
            if (ass.results) {
                ass.results.forEach((r: any) => {
                    if (r.publishedExempt) {
                        const student = students.find(s => {
                            const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            const sId = String(s.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            const sMat = String(s.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                            return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                        });
                        if (student) {
                            list.push({
                                id: `${ass.id}-${student.id}`,
                                date: ass.date,
                                assessmentTitle: ass.title,
                                studentName: `${student.lastName} ${student.firstName}`,
                                studentMatricule: student.matricule,
                                score: r.publishedScore,
                                reason: r.exemptionReason || "Sélection Manuelle",
                                maxScore: ass.maxScore
                            });
                        }
                    }
                });
            }
        });
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [assessments, students]);

    if (isLoading) return <Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />;

    return (
        <div className="space-y-6 max-w-[95vw] mx-auto overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Grid3X3 className="h-6 w-6 text-primary" />
                            Grille des Cotes
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
                            
                            <span className="mx-2 text-muted-foreground/30">|</span>
                            
                            <Select 
                                value={globalDisplayMode} 
                                onValueChange={(v: any) => setGlobalDisplayMode(v)}
                            >
                                <SelectTrigger className="h-6 text-sm border-none bg-transparent shadow-none px-1 py-0 focus:ring-0 text-muted-foreground font-medium hover:bg-secondary/50 rounded flex gap-1 items-center w-auto data-[state=open]:bg-secondary/50">
                                    <SelectValue placeholder="Affichage Noms" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="compact">Noms Courts</SelectItem>
                                    <SelectItem value="full">Noms Complets</SelectItem>
                                    <SelectItem value="id">Avec Matricule</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {exemptionsList.length > 0 && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="hidden sm:flex items-center gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 h-10 px-4 rounded-lg shadow-sm">
                                    <ShieldAlert className="h-4 w-4" />
                                    <span className="font-bold text-sm tracking-tight">Rapport Exemptions ({exemptionsList.length})</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2 text-amber-700">
                                        <ShieldAlert className="h-5 w-5" />
                                        Audit des Exemptions Accordées
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="mt-4 border rounded-xl overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>Date & Épreuve</TableHead>
                                                <TableHead>Élève</TableHead>
                                                <TableHead>Justificatif / Calcul</TableHead>
                                                <TableHead className="text-right">Côte</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {exemptionsList.map((ex) => (
                                                <TableRow key={ex.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-xs">{ex.assessmentTitle}</span>
                                                            <span className="text-[10px] text-muted-foreground">{new Date(ex.date).toLocaleDateString()}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-xs">{ex.studentName}</span>
                                                            <span className="text-[10px] opacity-70 font-mono tracking-tighter">{ex.studentMatricule}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                                                            {ex.reason}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className="font-black text-primary">{parseFloat(ex.score).toFixed(1)}</span>
                                                        <span className="text-muted-foreground text-xs ml-1">/ {ex.maxScore}</span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    <div className="flex items-center gap-3 bg-secondary/30 p-2 sm:p-3 rounded-lg border border-secondary">
                        <div className="flex flex-col text-right">
                            <Label htmlFor="simulate" className="font-bold text-sm hidden sm:block">Mode Simulation</Label>
                            <Label htmlFor="simulate" className="font-bold text-sm sm:hidden">Simuler</Label>
                            <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 text-amber-600/80 font-medium whitespace-nowrap">Détail des Absences (A)</span>
                        </div>
                        <Switch 
                            id="simulate" 
                            checked={simulateAbsentZero} 
                            onCheckedChange={setSimulateAbsentZero}
                            className="data-[state=checked]:bg-amber-600"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <Card className="border-none shadow-lg overflow-x-auto">
                <CardHeader className="pb-4 min-w-[800px]">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Détail chronologique des épreuves</CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">Base Max: {baseMax}</Badge>
                            <Badge variant="outline">{students.length} Élèves</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 min-w-max">
                    <div className="relative w-full overflow-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="sticky left-0 bg-background/95 backdrop-blur z-10 w-[250px] font-bold border-r">
                                        Élève
                                    </TableHead>
                                    {assessments.map((a: any) => {
                                        const hasWeight = a.pondere !== undefined && a.pondere !== null && Number(a.pondere) !== Number(a.maxScore);
                                        return (
                                            <TableHead key={a.id} className={`text-center min-w-[120px] ${a.isSuspended ? 'opacity-50' : ''}`}>
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`text-xs font-black truncate max-w-[100px] ${a.isSuspended ? 'line-through' : ''}`} title={a.title}>
                                                        {a.title}
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <Badge variant="outline" className={`text-[9px] px-1 ${a.isSuspended ? 'opacity-50' : 'bg-primary/5 text-primary border-primary/20'}`}>
                                                            / {a.maxScore}
                                                        </Badge>
                                                        {hasWeight && (
                                                            <Badge variant="outline" className="text-[9px] px-1 bg-amber-50 text-amber-700 border-amber-200 font-bold">
                                                                Pond. {a.pondere}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableHead>
                                        );
                                    })}
                                    <TableHead className="text-center font-black border-l min-w-[140px] bg-teal-50/60">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-teal-700 text-xs uppercase tracking-wider">Agrégat</span>
                                            <span className="text-[10px] font-normal text-teal-600/70">Épreuves publiées</span>
                                        </div>
                                    </TableHead>
                                    <TableHead className="sticky right-0 bg-primary/5 backdrop-blur z-10 text-center font-black border-l min-w-[140px]">
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-primary text-xs uppercase tracking-wider">/ {baseMax}</span>
                                            <span className="text-[10px] font-normal text-primary/60">Total cours</span>
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isFetching ? (
                                    <TableRow>
                                        <TableCell colSpan={assessments.length + 3} className="h-32 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                                        </TableCell>
                                    </TableRow>
                                ) : students.length > 0 ? (
                                    students.map((student) => {
                                        const stats = studentTotals[student.id];
                                        return (
                                            <TableRow key={student.id} className="hover:bg-muted/50">
                                                <TableCell className="sticky left-0 bg-background/95 backdrop-blur z-10 border-r py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={student.photo} />
                                                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                                {getInitials(student.firstName, student.lastName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <SmartStudentName student={student} className="font-semibold text-sm" />
                                                    </div>
                                                </TableCell>
                                                
                                                {assessments.map((a: any) => {
                                                    const res = a.results?.find((r: any) => {
                                                        const rId = String(r.studentId || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                                        const sId = String(student.id || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                                        const sMat = String(student.matricule || "").toLowerCase().trim().replace(/[\s_]+/g, '-');
                                                        return rId === sId || rId === sMat || sId.includes(rId) || rId.includes(sId);
                                                    });
                                                    
                                                    let displayContent = <span className="text-muted-foreground/30 font-medium">-</span>;
                                                    let cellClass = "text-center ";
                                                    const pondere = Number(a.pondere ?? a.maxScore);
                                                    
                                                    if (a.isSuspended) {
                                                        cellClass += "bg-slate-50 opacity-60";
                                                        displayContent = <span className="text-slate-400 font-bold truncate block text-[10px] uppercase">Suspendu</span>;
                                                    } else if (!res || res.isAbsent) {
                                                        if (simulateAbsentZero && res?.isAbsent) {
                                                            displayContent = <span className="font-black text-amber-600">0.0 <span className="text-[10px] text-amber-600/50 underline decoration-dotted">(A)</span></span>;
                                                            cellClass += "bg-amber-50/30";
                                                        } else {
                                                            cellClass += "bg-red-50/50";
                                                            displayContent = <Badge variant="destructive" className="text-[10px] bg-red-100 text-red-700 border-none hover:bg-red-100 shadow-none px-2 py-0">Vide</Badge>;
                                                        }
                                                    } else if (res.publishedExempt) {
                                                        displayContent = <Badge variant="outline" className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">Exempté</Badge>;
                                                    } else {
                                                        const score = parseFloat(res.publishedScore);
                                                        const weightedScore = (score / a.maxScore) * pondere;
                                                        const isPerfect = score === a.maxScore;
                                                        const isFailing = (score / a.maxScore) * 100 < 50;
                                                        
                                                        displayContent = (
                                                            <div className="flex flex-col items-center justify-center -space-y-0.5">
                                                                <span className={`font-black text-sm ${isPerfect ? 'text-primary' : isFailing ? 'text-red-500' : ''}`}>
                                                                    {weightedScore.toFixed(1)}
                                                                </span>
                                                                {pondere !== a.maxScore && (
                                                                    <span className="text-[9px] text-muted-foreground/50 italic">
                                                                        ({score.toFixed(1)}/{a.maxScore})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <TableCell key={a.id} className={cellClass}>
                                                            {displayContent}
                                                        </TableCell>
                                                    );
                                                })}

                                                {/* Colonne 1 : Agrégat des épreuves publiées */}
                                                <TableCell className="text-center border-l bg-teal-50/30">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="font-black text-teal-700 text-base">
                                                            {stats.earned.toFixed(1)}
                                                            <span className="text-xs text-teal-600/50 font-medium ml-1">/ {stats.maxPossible.toFixed(1)}</span>
                                                        </span>
                                                        {stats.maxPossible > 0 && (
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                                ((stats.earned / stats.maxPossible) * 100) < 50
                                                                    ? 'bg-red-100 text-red-600'
                                                                    : 'bg-teal-100 text-teal-700'
                                                            }`}>
                                                                {((stats.earned / stats.maxPossible) * 100).toFixed(1)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>

                                                {/* Colonne 2 : Total ramené sur le BaseMax du cours */}
                                                <TableCell className="sticky right-0 bg-primary/5 backdrop-blur z-10 text-center border-l">
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        {stats.maxPossible > 0 ? (
                                                            <>
                                                                <span className={`font-black text-lg ${
                                                                    ((stats.earned / stats.maxPossible) * baseMax) < (baseMax / 2)
                                                                        ? 'text-red-600'
                                                                        : 'text-primary'
                                                                }`}>
                                                                    {((stats.earned / stats.maxPossible) * baseMax).toFixed(2)}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground font-medium">/ {baseMax}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground/40 text-sm">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={assessments.length + 3} className="h-32 text-center text-muted-foreground italic">
                                            Aucun élève ou aucune épreuve.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
