"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft,
    Loader2,
    BarChart3,
    ArrowDownAZ,
    ArrowUpAZ,
    ArrowDown01,
    ArrowUp01,
    AlertTriangle,
    CheckCircle2,
    Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type SortMode = "alpha-asc" | "alpha-desc" | "score-asc" | "score-desc";

interface CumulativeData {
    mode: "cumulative";
    title: string;
    periods: { id: string; name: string }[];
    students: { id: string; name: string }[];
    periodData: Record<string, {
        periodName: string;
        studentScores: Record<string, { earned: number; max: number }>;
    }>;
}

interface StandardData {
    title: string;
    periodName: string;
    stats: { total: number; passes: number; fails: number; passRate: number; failRate: number };
    students: { id: string; name: string; score: number; max: number; percentage: number; passed: boolean }[];
}

// ─── Cumulative Page ───────────────────────────────────────────────────────────
function CumulativePage({ classroomName, data }: { classroomName: string; data: CumulativeData }) {
    const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
    const [sortMode, setSortMode] = useState<SortMode>("alpha-asc");

    const togglePeriod = (periodId: string) => {
        setSelectedPeriods((prev) => {
            const next = new Set(prev);
            if (next.has(periodId)) next.delete(periodId);
            else next.add(periodId);
            return next;
        });
    };

    // Compute cumulative student results from selected periods
    const studentResults = useMemo(() => {
        if (selectedPeriods.size === 0) return [];

        return data.students.map((student) => {
            let totalEarned = 0;
            let totalMax = 0;

            for (const periodId of selectedPeriods) {
                const periodInfo = data.periodData[periodId];
                if (!periodInfo) continue;
                const scores = periodInfo.studentScores[student.id];
                if (scores) {
                    totalEarned += scores.earned;
                    totalMax += scores.max;
                }
            }

            const percentage = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
            return {
                id: student.id,
                name: student.name,
                score: Number(totalEarned.toFixed(1)),
                max: totalMax,
                percentage: Number(percentage.toFixed(1)),
                passed: percentage >= 50,
            };
        });
    }, [selectedPeriods, data]);

    const sortedStudents = useMemo(() => {
        return [...studentResults].sort((a, b) => {
            if (sortMode === "alpha-asc") return a.name.localeCompare(b.name);
            if (sortMode === "alpha-desc") return b.name.localeCompare(a.name);
            if (sortMode === "score-asc") return a.percentage - b.percentage;
            if (sortMode === "score-desc") return b.percentage - a.percentage;
            return 0;
        });
    }, [studentResults, sortMode]);

    const stats = useMemo(() => {
        const total = sortedStudents.length;
        const passes = sortedStudents.filter((s) => s.passed).length;
        const fails = total - passes;
        return {
            total,
            passes,
            fails,
            passRate: total > 0 ? Number(((passes / total) * 100).toFixed(1)) : 0,
            failRate: total > 0 ? Number(((fails / total) * 100).toFixed(1)) : 0,
        };
    }, [sortedStudents]);

    const selectedPeriodNames = data.periods
        .filter((p) => selectedPeriods.has(p.id))
        .map((p) => p.name)
        .join(" + ");

    return (
        <>
            {/* Period Toggles */}
            <div className="glass-card p-4 mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Sélectionner les périodes à cumuler
                </p>
                <div className="flex flex-wrap gap-2">
                    {data.periods.map((period) => {
                        const isSelected = selectedPeriods.has(period.id);
                        return (
                            <button
                                key={period.id}
                                onClick={() => togglePeriod(period.id)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all border-2",
                                    isSelected
                                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                                        : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                                )}
                            >
                                {isSelected ? (
                                    <CheckCircle2 className="inline h-3 w-3 mr-1" />
                                ) : (
                                    <Clock className="inline h-3 w-3 mr-1" />
                                )}
                                {period.name}
                            </button>
                        );
                    })}
                </div>
                {selectedPeriods.size > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-3 font-semibold">
                        Cumul : <span className="text-primary">{selectedPeriodNames}</span>
                    </p>
                )}
            </div>

            {/* Disclaimer */}
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl text-sm mb-6 flex gap-3">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="font-bold mb-1">Avis important sur les résultats cumulés</p>
                    <p className="text-xs leading-relaxed">
                        Les résultats sont cumulés selon les périodes sélectionnées. Pour chaque période activée, les maxima
                        de tous les cours du local sont comptabilisés. Si un cours n'est pas clôturé ou si aucune cote n'a été
                        soumise pour la période, la contribution de ce cours est automatiquement comptée comme{" "}
                        <strong>0 / max</strong>. L'exactitude des données dépend de la bonne exécution des tâches par toutes
                        les parties prenantes. Tout résultat inattendu reflète une anomalie de manipulation et non un défaut
                        de l'application.
                    </p>
                </div>
            </div>

            {selectedPeriods.size === 0 ? (
                <div className="glass-card p-12 text-center text-muted-foreground">
                    <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-bold">Aucune période sélectionnée</p>
                    <p className="text-sm mt-1">Activez au moins une période ci-dessus pour afficher les statistiques cumulées.</p>
                </div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                        <div className="glass-card text-center p-4">
                            <p className="text-2xl font-black">{stats.total}</p>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Effectif</p>
                        </div>
                        <div className="glass-card text-center p-4">
                            <p className="text-2xl font-black text-emerald-600">
                                {stats.passes} <span className="text-base">({stats.passRate}%)</span>
                            </p>
                            <p className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Réussites</p>
                        </div>
                        <div className="glass-card text-center p-4">
                            <p className="text-2xl font-black text-red-600">
                                {stats.fails} <span className="text-base">({stats.failRate}%)</span>
                            </p>
                            <p className="text-[10px] font-bold uppercase text-red-700 tracking-wider">Échecs</p>
                        </div>
                    </div>

                    {/* Sort Controls */}
                    <div className="flex flex-wrap justify-end gap-2 mb-4">
                        <Button variant={sortMode === "alpha-asc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("alpha-asc")}>
                            <ArrowDownAZ className="h-4 w-4 mr-1" /> A-Z
                        </Button>
                        <Button variant={sortMode === "alpha-desc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("alpha-desc")}>
                            <ArrowUpAZ className="h-4 w-4 mr-1" /> Z-A
                        </Button>
                        <Button variant={sortMode === "score-desc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("score-desc")}>
                            <ArrowDown01 className="h-4 w-4 mr-1" /> Meilleur Score
                        </Button>
                        <Button variant={sortMode === "score-asc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("score-asc")}>
                            <ArrowUp01 className="h-4 w-4 mr-1" /> Faible Score
                        </Button>
                    </div>

                    {/* Student Table */}
                    <div className="glass-card overflow-x-auto p-0">
                        <Table className="tonal-table">
                            <TableHeader>
                                <TableRow className="tonal-surface-raised hover:bg-transparent">
                                    <TableHead className="font-extrabold uppercase">Élève</TableHead>
                                    <TableHead className="text-right font-extrabold uppercase">Points</TableHead>
                                    <TableHead className="text-right font-extrabold uppercase">Pourcentage</TableHead>
                                    <TableHead className="text-right font-extrabold uppercase">Résultat</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedStudents.map((s) => (
                                    <TableRow key={s.id} className="border-none hover:bg-muted/10">
                                        <TableCell className="font-bold">{s.name}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {s.score} / {s.max}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">{s.percentage}%</TableCell>
                                        <TableCell className="text-right">
                                            <Badge
                                                className={cn(
                                                    "text-[10px] uppercase font-extrabold border-none",
                                                    s.passed
                                                        ? "bg-emerald-500/10 text-emerald-600"
                                                        : "bg-red-500/10 text-red-600"
                                                )}
                                            >
                                                {s.passed ? "Réussite" : "Échec"}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {sortedStudents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                            Aucune donnée disponible.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </>
    );
}

// ─── Standard Stats Page (course / general) ───────────────────────────────────
function StandardPage({ data }: { data: StandardData }) {
    const [sortMode, setSortMode] = useState<SortMode>("alpha-asc");

    const sortedStudents = useMemo(() => {
        return [...(data.students || [])].sort((a, b) => {
            if (sortMode === "alpha-asc") return a.name.localeCompare(b.name);
            if (sortMode === "alpha-desc") return b.name.localeCompare(a.name);
            if (sortMode === "score-asc") return a.percentage - b.percentage;
            if (sortMode === "score-desc") return b.percentage - a.percentage;
            return 0;
        });
    }, [data, sortMode]);

    return (
        <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                <div className="glass-card text-center p-4">
                    <p className="text-2xl font-black">{data.stats.total}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Effectif Évalué</p>
                </div>
                <div className="glass-card text-center p-4">
                    <p className="text-2xl font-black text-emerald-600">
                        {data.stats.passes} <span className="text-base">({data.stats.passRate}%)</span>
                    </p>
                    <p className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Réussites</p>
                </div>
                <div className="glass-card text-center p-4">
                    <p className="text-2xl font-black text-red-600">
                        {data.stats.fails} <span className="text-base">({data.stats.failRate}%)</span>
                    </p>
                    <p className="text-[10px] font-bold uppercase text-red-700 tracking-wider">Échecs</p>
                </div>
            </div>

            {/* Sort Controls */}
            <div className="flex flex-wrap justify-end gap-2 mb-4">
                <Button variant={sortMode === "alpha-asc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("alpha-asc")}>
                    <ArrowDownAZ className="h-4 w-4 mr-1" /> A-Z
                </Button>
                <Button variant={sortMode === "alpha-desc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("alpha-desc")}>
                    <ArrowUpAZ className="h-4 w-4 mr-1" /> Z-A
                </Button>
                <Button variant={sortMode === "score-desc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("score-desc")}>
                    <ArrowDown01 className="h-4 w-4 mr-1" /> Meilleur Score
                </Button>
                <Button variant={sortMode === "score-asc" ? "default" : "outline"} size="sm" onClick={() => setSortMode("score-asc")}>
                    <ArrowUp01 className="h-4 w-4 mr-1" /> Faible Score
                </Button>
            </div>

            {/* Student Table */}
            <div className="glass-card overflow-x-auto p-0">
                <Table className="tonal-table">
                    <TableHeader>
                        <TableRow className="tonal-surface-raised hover:bg-transparent">
                            <TableHead className="font-extrabold uppercase">Élève</TableHead>
                            <TableHead className="text-right font-extrabold uppercase">Points</TableHead>
                            <TableHead className="text-right font-extrabold uppercase">Pourcentage</TableHead>
                            <TableHead className="text-right font-extrabold uppercase">Résultat</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedStudents.map((s) => (
                            <TableRow key={s.id} className="border-none hover:bg-muted/10">
                                <TableCell className="font-bold">{s.name}</TableCell>
                                <TableCell className="text-right font-mono">{s.score} / {s.max}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{s.percentage}%</TableCell>
                                <TableCell className="text-right">
                                    <Badge
                                        className={cn(
                                            "text-[10px] uppercase font-extrabold border-none",
                                            s.passed
                                                ? "bg-emerald-500/10 text-emerald-600"
                                                : "bg-red-500/10 text-red-600"
                                        )}
                                    >
                                        {s.passed ? "Réussite" : "Échec"}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                        {sortedStudents.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                    Aucune donnée disponible.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MonitoringStatsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const classroomName = decodeURIComponent(params.name as string);
    // Default to "cumulative" when no mode param — visiting /monitoring/stats directly shows the cumulative view
    const mode = searchParams.get("mode") || "cumulative";
    const submissionId = searchParams.get("submissionId");
    const periodId = searchParams.get("periodId");

    const [data, setData] = useState<CumulativeData | StandardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let url = `/api/admin/period-monitoring/stats?mode=${mode}&classroomId=${encodeURIComponent(classroomName)}`;
                if (mode === "course" && submissionId) url += `&submissionId=${submissionId}`;
                if (mode === "general" && periodId) url += `&periodId=${periodId}`;

                const res = await fetch(url);
                const json = await res.json();
                if (res.ok) {
                    setData(json);
                } else {
                    setError(json?.error || `Erreur ${res.status}`);
                    console.error("[Stats page] API error:", json);
                }
            } catch (err: any) {
                setError(err?.message || "Erreur de connexion");
                console.error("[Stats page] Fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (classroomName) fetchStats();
    }, [classroomName, mode, submissionId, periodId]);

    const title =
        data && "mode" in data && data.mode === "cumulative"
            ? data.title
            : (data as StandardData)?.title || "Statistiques";

    const subtitle =
        data && "mode" in data && data.mode === "cumulative"
            ? `Local : ${classroomName.toUpperCase()}`
            : (data as StandardData)?.periodName
            ? `Période : ${(data as StandardData).periodName}`
            : `Local : ${classroomName.toUpperCase()}`;

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
                <AlertTriangle className="h-10 w-10 text-red-500" />
                <h2 className="text-xl font-bold">Erreur</h2>
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => router.back()}>Retour</Button>
            </div>
        );
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-fit text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div className="flex items-center gap-3">
                    <div className="neuglass-light-icon p-2 rounded-xl bg-primary/10">
                        <BarChart3 className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-foreground">{title}</h1>
                        <p className="text-muted-foreground font-semibold text-sm">{subtitle}</p>
                    </div>
                </div>
            </div>

            {/* Body */}
            {data && "mode" in data && data.mode === "cumulative" ? (
                <CumulativePage classroomName={classroomName} data={data as CumulativeData} />
            ) : data ? (
                <StandardPage data={data as StandardData} />
            ) : (
                <div className="glass-card p-12 text-center text-muted-foreground">
                    <p className="font-bold">Aucune donnée disponible.</p>
                </div>
            )}
        </div>
    );
}
