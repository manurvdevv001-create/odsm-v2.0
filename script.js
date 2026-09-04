const fs = require('fs');
const monitoringPath = 'c:/Users/emmanuel/Documents/ODSM/odsm-v2/src/app/(main)/classrooms/[name]/evaluations/monitoring/page.tsx';
const fichesDir = 'c:/Users/emmanuel/Documents/ODSM/odsm-v2/src/app/(main)/classrooms/[name]/evaluations/fiches';
const fichesPath = fichesDir + '/page.tsx';
const evaluationsPage = 'c:/Users/emmanuel/Documents/ODSM/odsm-v2/src/app/(main)/classrooms/[name]/evaluations/page.tsx';

if (!fs.existsSync(fichesDir)) {
    fs.mkdirSync(fichesDir, { recursive: true });
}

let content = fs.readFileSync(monitoringPath, 'utf8');

const startMarker = '            {/* Console de Décisions & Mentions (uniquement si la période est clôturée) */}';

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
    console.error('Could not find start marker');
    process.exit(1);
}

const consoleContent = content.substring(startIndex, content.lastIndexOf('</div>', content.lastIndexOf('</div>') - 1));

const newMonitoring = content.substring(0, startIndex) + '        </div>\n    );\n}\n';
fs.writeFileSync(monitoringPath, newMonitoring);

const fichesContent = `"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    Loader2,
    Shield,
    Lock,
    Check,
    GraduationCap,
    Settings,
    Plus,
    Users,
    AlertTriangle
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { isSecondaryClassroom } from "@/lib/classroom-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FichesDeSuiviPage() {
    const params = useParams();
    const router = useRouter();
    const classroomName = decodeURIComponent(params.name as string);
    const { schoolData, isLoading } = useSchoolData();

    const [periodClosure, setPeriodClosure] = useState<any>(null);
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

    const [detailsStudents, setDetailsStudents] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [savingDetails, setSavingDetails] = useState(false);
    const [activeConsoleTab, setActiveConsoleTab] = useState<"conduct" | "exams" | "repechage">("conduct");
    const [mentionsList, setMentionsList] = useState<string[]>(["E", "TB", "B", "ME", "MA"]);
    const [newMentionInput, setNewMentionInput] = useState("");

    const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/\\s+/g, ' ').trim() : "";

    const isSecondary = useMemo(() => {
        return isSecondaryClassroom(classroomName || "", schoolData);
    }, [schoolData, classroomName]);

    const allPeriods = useMemo(() => {
        if (!schoolData?.calendar) return [];
        const rawLevel = isSecondary ? "secondaire" : "primaire";
        const levelCalendar = (schoolData.calendar as any)[rawLevel];
        return levelCalendar?.periods || [];
    }, [schoolData, isSecondary]);

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
        const fetchMonitoringData = async () => {
            if (!classroomName) return;
            try {
                const url = \`/api/admin/period-monitoring?classroomId=\${encodeURIComponent(classroomName)}\${displayPeriod?.id ? \`&periodId=\${displayPeriod.id}\` : ""}\`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setPeriodClosure(data.periodClosure || null);
                }
            } catch (error) {
                console.error("Failed to fetch monitoring data", error);
            }
        };
        if (!isLoading) fetchMonitoringData();
    }, [isLoading, classroomName, displayPeriod]);

    const fetchDetails = async () => {
        if (!classroomName || !displayPeriod?.id) return;
        setDetailsLoading(true);
        try {
            const res = await fetch(\`/api/admin/period-monitoring/details?classroomId=\${encodeURIComponent(classroomName)}&periodId=\${displayPeriod.id}\`);
            if (res.ok) {
                const data = await res.json();
                setDetailsStudents(data.students || []);
            }
        } catch (e) {
            console.error("Error fetching details", e);
        } finally {
            setDetailsLoading(false);
        }
    };

    useEffect(() => {
        if (periodClosure && displayPeriod?.id) {
            fetchDetails();
        } else {
            setDetailsStudents([]);
        }
    }, [periodClosure, displayPeriod]);

    const handleSaveDetails = async () => {
        if (!displayPeriod?.id) return;
        setSavingDetails(true);
        try {
            const res = await fetch("/api/admin/period-monitoring/details", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    periodId: displayPeriod.id,
                    classroomId: classroomName,
                    updates: detailsStudents.map(s => ({
                        studentId: s.id,
                        conduct: s.conduct,
                        application: s.application,
                        comment: s.comment,
                        enafepScore: s.enafepScore !== null && s.enafepScore !== "" ? Number(s.enafepScore) : null,
                        stateExamScore: s.stateExamScore !== null && s.stateExamScore !== "" ? Number(s.stateExamScore) : null,
                        jurySchoolScore: s.jurySchoolScore !== null && s.jurySchoolScore !== "" ? Number(s.jurySchoolScore) : null,
                        juryExamScore: s.juryExamScore !== null && s.juryExamScore !== "" ? Number(s.juryExamScore) : null,
                        juryLesson1: s.juryLesson1 !== null && s.juryLesson1 !== "" ? Number(s.juryLesson1) : null,
                        juryLesson2: s.juryLesson2 !== null && s.juryLesson2 !== "" ? Number(s.juryLesson2) : null,
                        repechageCourses: s.repechageCourses
                    }))
                })
            });
            if (res.ok) {
                toast.success("Décisions et mentions enregistrées avec succès.");
                fetchDetails();
            } else {
                toast.error("Erreur lors de l'enregistrement.");
            }
        } catch {
            toast.error("Erreur réseau.");
        } finally {
            setSavingDetails(false);
        }
    };

    const updateStudentField = (studentId: string, field: string, value: any) => {
        setDetailsStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    if (isLoading) {
        return <div className="flex h-[50vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            <div className="flex flex-col gap-4 mb-8">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-fit text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-headline font-bold text-foreground flex items-center gap-3">
                            <div className="neuglass-light-icon p-2 rounded-xl bg-blue-500/10">
                                <Users className="h-7 w-7 text-blue-600" />
                            </div>
                            Fiches de Suivi
                        </h1>
                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            <span>Local <span className="font-semibold text-foreground uppercase">{classroomName}</span></span>
                            <span>—</span>
                            <div className="flex items-center gap-2">
                                <span>Période :</span>
                                <Select
                                    value={selectedPeriodId || activePeriod?.id || ""}
                                    onValueChange={(value) => setSelectedPeriodId(value === activePeriod?.id ? "" : value)}
                                >
                                    <SelectTrigger className="h-6 w-auto border-none bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-none rounded-sm px-2 text-xs font-bold uppercase focus:ring-0 focus:ring-offset-0">
                                        <SelectValue placeholder="Sélectionner" />
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
                    <div className="flex items-center gap-2">
                        {periodClosure ? (
                            <Badge className="h-9 rounded-xl font-bold gap-2 bg-emerald-100 text-emerald-700 border-emerald-200 px-4">
                                <Lock className="h-4 w-4" />
                                Période Clôturée
                            </Badge>
                        ) : (
                            <Badge className="h-9 rounded-xl font-bold gap-2 bg-amber-100 text-amber-700 border-amber-200 px-4">
                                <AlertTriangle className="h-4 w-4" />
                                Période Non Clôturée
                            </Badge>
                        )}
                    </div>
                </div>
            </div>

            {!periodClosure ? (
                <div className="glass-card p-12 flex flex-col items-center justify-center text-center space-y-4">
                    <Lock className="h-12 w-12 text-muted-foreground/30" />
                    <h3 className="text-xl font-black text-foreground">Période Non Clôturée</h3>
                    <p className="text-muted-foreground max-w-md">
                        Les fiches de suivi, mentions et délibérations ne sont accessibles qu'une fois la période clôturée pour ce local.
                    </p>
                </div>
            ) : (
                <div className="glass-card p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/30 pb-4 mb-6">
                        <div>
                            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-600 animate-pulse" />
                                Console d'Administration & Mentions
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Appliquez les mentions qualitatives, saisissez les examens officiels et gérez le repêchage.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                disabled={savingDetails}
                                onClick={handleSaveDetails}
                                className="h-9 px-4 font-bold rounded-xl gap-2 shadow-sm bg-blue-600 text-white hover:bg-blue-700"
                            >
                                {savingDetails ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                {savingDetails ? "Enregistrement..." : "Enregistrer les modifications"}
                            </Button>
                        </div>
                    </div>
` + consoleContent.substring(consoleContent.indexOf('                    {/* Navigation Tabs */}')) + `
        </div>
    );
}
`;

fs.writeFileSync(fichesPath, fichesContent);

let pageContent = fs.readFileSync(evaluationsPage, 'utf8');
pageContent = pageContent.replace('border-dashed border-blue-500/10 rounded-2xl bg-white/40 grayscale opacity-60', 'border-blue-500/10 rounded-2xl bg-white/40 shadow-inner group-hover:bg-blue-500/5 transition-colors');
pageContent = pageContent.replace('<Construction className="h-12 w-12 text-blue-500/30 mb-4 animate-pulse" />', '<Users className="h-12 w-12 text-blue-500/40 mb-4" />');
pageContent = pageContent.replace('<p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">En Développement</p>', '<p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Délibérations & Mentions</p>');
pageContent = pageContent.replace('<Button variant="outline" className="w-full h-12 border-blue-500/20 text-blue-600 rounded-xl font-bold" disabled>', '<Link href={`/classrooms/${encodeURIComponent(classroomName)}/evaluations/fiches`}>\n                                <Button className="w-full h-12 neuglass-light-btn-primary bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-bold group-hover:shadow-blue-500/30 transition-all border-0">');
pageContent = pageContent.replace('Bientôt disponible\n                            </Button>', 'Ouvrir le module\n                                    <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />\n                                </Button>\n                            </Link>');

fs.writeFileSync(evaluationsPage, pageContent);

console.log('Successfully refactored fiches de suivi');
