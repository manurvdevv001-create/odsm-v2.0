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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, Save, Scale, Check, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function WeightsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { schoolData, isLoading } = useSchoolData();
    const courseId = params.courseId as string;
    const classroomName = searchParams.get("classroom") || "";
    const courseName = searchParams.get("courseName") || "";
    const periodName = searchParams.get("period") || "Période Sélectionnée";
    const periodId = searchParams.get("periodId");

    const [isClosed, setIsClosed] = useState(false);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    // Track weight edits: { assessmentId: newWeightValue }
    const [edits, setEdits] = useState<Record<string, string>>({});

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
                setAssessments(data.assessments || []);
                setIsClosed(data.isClosed || false);
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

    const totalWeight = useMemo(() => {
        return assessments.reduce((sum, a) => {
            const editedWeight = edits[a.id];
            const w = editedWeight !== undefined ? parseFloat(editedWeight) : (a.pondere ?? a.maxScore);
            return sum + (isNaN(w) ? 0 : w);
        }, 0);
    }, [assessments, edits]);

    const hasChanges = Object.keys(edits).length > 0;

    const handleWeightChange = (assessmentId: string, value: string) => {
        setEdits((prev) => ({ ...prev, [assessmentId]: value }));
    };

    const handleSaveAll = async () => {
        if (!hasChanges) return;
        setIsSaving(true);
        try {
            const promises = Object.entries(edits).map(([assessmentId, weightStr]) =>
                fetch("/api/teacher/grades", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        assessmentId,
                        pondere: weightStr,
                    }),
                })
            );
            const results = await Promise.all(promises);
            const allOk = results.every((r) => r.ok);
            if (allOk) {
                toast.success("Pondérations mises à jour avec succès !");
                setEdits({});
                fetchAssessments();
            } else {
                toast.error("Certaines mises à jour ont échoué.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Scale className="h-6 w-6 text-primary" />
                            Pondérations
                            {isClosed && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 ml-2">
                                    <CheckCircle2 className="h-3 w-3" />
                                    CLÔTURÉ
                                </Badge>
                            )}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {courseName} — {classroomName}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={handleSaveAll}
                    disabled={!hasChanges || isSaving}
                    className="gap-2 min-w-[160px]"
                >
                    {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {isClosed ? "Verrouillé" : "Enregistrer"}
                </Button>
            </div>

            {/* Summary Card */}
            <Card className="border-none shadow-md bg-gradient-to-r from-primary/5 to-transparent">
                <CardContent className="flex items-center justify-between py-5">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total des pondérations</p>
                        <p className="text-3xl font-black">{totalWeight}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">Épreuves</p>
                        <p className="text-3xl font-black">{assessments.length}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Weights Table */}
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Épreuves de la période</CardTitle>
                    <CardDescription>
                        Modifiez la pondération de chaque épreuve pour ajuster leur poids dans le total.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30">
                                <TableHead>Épreuve</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-center">Maximum</TableHead>
                                <TableHead className="text-center w-[140px]">Pondération</TableHead>
                                <TableHead className="text-center">% du Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isFetching ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                                    </TableCell>
                                </TableRow>
                            ) : assessments.length > 0 ? (
                                assessments.map((assessment) => {
                                    const currentWeight =
                                        edits[assessment.id] !== undefined
                                            ? parseFloat(edits[assessment.id])
                                            : (assessment.pondere ?? assessment.maxScore);
                                    const pct = totalWeight > 0 ? ((currentWeight / totalWeight) * 100).toFixed(1) : "0.0";
                                    const isEdited = edits[assessment.id] !== undefined;

                                    return (
                                        <TableRow key={assessment.id} className="hover:bg-muted/50 transition-colors">
                                            <TableCell>
                                                <p className="font-bold">{assessment.title}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(assessment.date).toLocaleDateString("fr-FR")}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest">
                                                    {assessment.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-bold">{assessment.maxScore}</TableCell>
                                            <TableCell className="text-center">
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        className={`w-20 mx-auto text-center font-semibold ${
                                                            isEdited ? "border-primary ring-1 ring-primary/30" : ""
                                                        }`}
                                                        value={edits[assessment.id] ?? String(assessment.pondere ?? assessment.maxScore)}
                                                        onChange={(e) => handleWeightChange(assessment.id, e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                    {isEdited && (
                                                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-sm font-medium text-muted-foreground">{pct}%</span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                        Aucune épreuve enregistrée.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {hasChanges && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <Card className="shadow-2xl border-primary/20 bg-background/95 backdrop-blur-sm">
                        <CardContent className="flex items-center gap-4 py-3 px-6">
                            <p className="text-sm font-medium">
                                {Object.keys(edits).length} modification(s) non enregistrée(s)
                            </p>
                            <Button onClick={handleSaveAll} disabled={isSaving} size="sm" className="gap-2">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Enregistrer
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
