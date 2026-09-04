"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Save, PlusCircle, Calendar as CalendarIcon, CheckCircle2, AlertCircle, RefreshCcw, Trash2, Sun, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { saveSchoolCalendar, getSchoolCalendarData, activateSchoolYear } from "@/app/setup/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { getNextSchoolYear, normalizeSchoolYear } from "@/lib/school-year-utils";
import { YearImportWizard } from "@/components/settings/YearImportWizard";
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
import { motion, AnimatePresence } from "framer-motion";

type PeriodType = 'normal' | 'exam' | 'extra';

type CalendarPeriod = {
    id: string;
    name: string;
    type: PeriodType;
    startDate: string;
    endDate: string;
    isActive?: boolean;
};

type SpecialDay = {
    id: string;
    name: string;
    date: string;
    status: 'off' | 'working';
    appliesTo: ('maternelle' | 'primaire' | 'secondaire')[];
};

type BufferPeriod = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    appliesTo: ('maternelle' | 'primaire' | 'secondaire')[];
};

type HolidayEntry = {
    id: string;
    name: string;
    date: string;
    appliesTo: ('maternelle' | 'primaire' | 'secondaire')[];
};

type Vacation = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    appliesTo: ('maternelle' | 'primaire' | 'secondaire')[];
};

type AcademicLevelCalendar = {
    periods: CalendarPeriod[];
};

type SchoolCalendar = {
    schoolYear: string;
    startDate: string;
    endDate: string;
    maternelle: AcademicLevelCalendar;
    primaire: AcademicLevelCalendar;
    secondaire: AcademicLevelCalendar;
    holidays: HolidayEntry[];
    vacations: Vacation[];
    specialDays?: SpecialDay[];
    bufferPeriods?: BufferPeriod[];
    isActive?: boolean;
};

const INITIAL_STRUCTURES = {
    maternelle: [
        { id: 'm_t1', name: 'T1', type: 'normal' as const },
        { id: 'm_t2', name: 'T2', type: 'normal' as const },
        { id: 'm_t3', name: 'T3', type: 'normal' as const },
    ],
    primaire: [
        { id: 'p_t1_p1', name: 'T1-P1', type: 'normal' as const },
        { id: 'p_t1_p2', name: 'T1-P2', type: 'normal' as const },
        { id: 'p_t1_e', name: 'T1-EX', type: 'exam' as const },
        { id: 'p_t2_p3', name: 'T2-P3', type: 'normal' as const },
        { id: 'p_t2_p4', name: 'T2-P4', type: 'normal' as const },
        { id: 'p_t2_e', name: 'T2-EX', type: 'exam' as const },
        { id: 'p_t3_p5', name: 'T3-P5', type: 'normal' as const },
        { id: 'p_t3_p6', name: 'T3-P6', type: 'normal' as const },
        { id: 'p_t3_e', name: 'T3-EX', type: 'exam' as const },
    ],
    secondaire: [
        { id: 's_s1_p1', name: 'S1-P1', type: 'normal' as const },
        { id: 's_s1_p2', name: 'S1-P2', type: 'normal' as const },
        { id: 's_s1_e', name: 'S1-EX', type: 'exam' as const },
        { id: 's_s2_p3', name: 'S2-P3', type: 'normal' as const },
        { id: 's_s2_p4', name: 'S2-P4', type: 'normal' as const },
        { id: 's_s2_e', name: 'S2-EX', type: 'exam' as const },
    ]
};

const getShortName = (name: string) => {
    if (!name) return "";
    return name
        .replace(/Trimestre\s?(\d)/i, 'T$1')
        .replace(/Semestre\s?(\d)/i, 'S$1')
        .replace(/Période\s?(\d)/i, 'P$1')
        .replace(/Examens?/i, 'EX')
        .replace(/\s?-\s?/g, '-')
        .trim();
};

const getDefaultCalendar = (year: string): SchoolCalendar => ({
    schoolYear: year,
    startDate: '',
    endDate: '',
    maternelle: { periods: INITIAL_STRUCTURES.maternelle.map(p => ({ ...p, startDate: '', endDate: '' })) },
    primaire: { periods: INITIAL_STRUCTURES.primaire.map(p => ({ ...p, startDate: '', endDate: '' })) },
    secondaire: { periods: INITIAL_STRUCTURES.secondaire.map(p => ({ ...p, startDate: '', endDate: '' })) },
    holidays: [],
    vacations: [],
    specialDays: [],
    bufferPeriods: [],
    isActive: false
});

export default function CalendarSettingsPage() {
    const { schoolData, user, isLoading, refreshData } = useSchoolData();

    // School structure indicators
    const levelsCfg = schoolData?.levels as Record<string, boolean> | undefined;
    const hasMaternelle = !!(levelsCfg?.MATERNELLE ?? levelsCfg?.maternelle);
    const hasPrimaire = !!(levelsCfg?.PRIMAIRE ?? levelsCfg?.primaire);
    const hasSecondaire = !!(levelsCfg?.SECONDAIRE ?? levelsCfg?.secondaire);

    const [selectedYear, setSelectedYear] = useState<string>('');
    const [knownYears, setKnownYears] = useState<string[]>([]);
    const [calendar, setCalendar] = useState<SchoolCalendar | null>(null);
    const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');
    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        if (schoolData) {
            const configYears = (schoolData.configuration as any)?.knownYears || [];
            const activeYear = (schoolData.schoolCalendar as any)?.schoolYear;

            const rawYears = [...configYears];
            if (activeYear) rawYears.push(activeYear);

            const uniqueNormalizedYears = Array.from(new Set(
                rawYears.map((y: string) => normalizeSchoolYear(y)).filter((y: string) => y)
            ));

            uniqueNormalizedYears.sort((a, b) => b.localeCompare(a));

            let finalYears = uniqueNormalizedYears;
            if (finalYears.length === 0) {
                finalYears = ["2023-2024"];
            }

            setKnownYears(finalYears);

            if (!selectedYear) {
                if (activeYear) {
                    setSelectedYear(normalizeSchoolYear(activeYear));
                } else {
                    setSelectedYear(finalYears[0]);
                }
            }
        }
    }, [schoolData, selectedYear]);

    // --- 2. FETCH DATA ON YEAR CHANGE ---
    useEffect(() => {
        const fetchCalendar = async () => {
            if (!selectedYear || !schoolData?.matricule) return;

            setIsLoadingCalendar(true);
            const result = await getSchoolCalendarData(schoolData.matricule as string, selectedYear);

            if (result.success && result.data) {
                const merged = { ...getDefaultCalendar(selectedYear), ...result.data };
                if (!merged.maternelle?.periods?.length) merged.maternelle.periods = INITIAL_STRUCTURES.maternelle.map(p => ({ ...p, startDate: '', endDate: '' }));
                if (!merged.primaire?.periods?.length) merged.primaire.periods = INITIAL_STRUCTURES.primaire.map(p => ({ ...p, startDate: '', endDate: '' }));
                if (!merged.secondaire?.periods?.length) merged.secondaire.periods = INITIAL_STRUCTURES.secondaire.map(p => ({ ...p, startDate: '', endDate: '' }));

                setCalendar(merged);
            } else {
                setCalendar(getDefaultCalendar(selectedYear));
            }
            setIsLoadingCalendar(false);
        };

        fetchCalendar();
    }, [selectedYear, schoolData?.matricule]);

    // --- 2b. AUTOMATIC PERIOD ADVANCEMENT ---
    useEffect(() => {
        if (!calendar || !schoolData?.matricule) return;

        (['maternelle', 'primaire', 'secondaire'] as const).forEach(level => {
            const isEnabled = (level === 'maternelle' && hasMaternelle) ||
                              (level === 'primaire' && hasPrimaire) ||
                              (level === 'secondaire' && hasSecondaire);
            if (!isEnabled) return;

            fetch(`/api/school/periods/auto-advance?matricule=${schoolData.matricule}&level=${level}`)
                .then(r => r.json())
                .then(data => {
                    if (data.advanced) {
                        console.log(`[Calendar] Auto-advanced ${level}: "${data.previousPeriod.name}" → "${data.activePeriod.name}"`);
                    }
                })
                .catch(err => console.error(`[Calendar] Auto-advance error for ${level}:`, err));
        });
    }, [calendar, hasMaternelle, hasPrimaire, hasSecondaire, schoolData?.matricule]);



    // --- ACTIONS ---

    const handleAddYear = () => {
        const sorted = [...knownYears].sort((a, b) => a.localeCompare(b));
        const latest = sorted[sorted.length - 1] || "2023-2024";
        const next = getNextSchoolYear(latest);

        if (knownYears.includes(next)) {
            toast.error("Erreur", { description: `L'année ${next} est déjà dans la liste.` });
            return;
        }

        setKnownYears(prev => {
            if (prev.includes(next)) return prev;
            return Array.from(new Set([...prev, next])).sort((a, b) => b.localeCompare(a));
        });

        setSelectedYear(next);
        toast.info("Info", { description: `L'année ${next} est prête à être configurée.` });
    };

    const handleSave = async () => {
        if (!calendar || !schoolData?.matricule) return;
        setIsSaving(true);

        // Synchroniser strictement le calendrier avec la configuration active de l'école
        const calendarToSave = { ...calendar };
        if (!hasMaternelle) calendarToSave.maternelle = { periods: [] };
        if (!hasPrimaire) calendarToSave.primaire = { periods: [] };
        if (!hasSecondaire) calendarToSave.secondaire = { periods: [] };

        const executorName = user?.name || user?.username || "Administrateur";
        const result = await saveSchoolCalendar(schoolData.matricule as string, calendarToSave, knownYears, undefined, executorName);
        if (result.success) {
            toast.success('Succès', { description: 'Calendrier et années scolaires enregistrés.' });
            refreshData();
        } else {
            toast.error('Erreur', { description: result.error || 'Erreur lors de la sauvegarde.' });
        }
        setIsSaving(false);
    };

    const handleActivateYear = async () => {
        if (!calendar || !schoolData?.matricule) return;
        setIsActivating(true);
        const executorName = user?.name || user?.username || "Administrateur";
        const result = await activateSchoolYear(schoolData.matricule as string, calendar.schoolYear, executorName);
        if (result.success) {
            toast.success('Année Activée', { description: `L'année ${calendar.schoolYear} est maintenant active.` });
            setCalendar(prev => prev ? ({ ...prev, isActive: true }) : null);
            refreshData();
        } else {
            toast.error('Erreur', { description: result.error || "Erreur lors de l'activation." });
        }
        setIsActivating(false);
    };

    // --- UPDATERS ---
    const updatePeriodDate = (level: 'maternelle' | 'primaire' | 'secondaire', periodIndex: number, field: 'startDate' | 'endDate', value: string) => {
        setCalendar(prev => {
            if (!prev) return null;
            const newCalendar = { ...prev };
            const levelData = newCalendar[level];

            if (levelData && levelData.periods[periodIndex]) {
                levelData.periods[periodIndex][field] = value;

                // Sync the start date of the first period across all levels and the global start date
                if (periodIndex === 0 && field === 'startDate') {
                    newCalendar.startDate = value;
                    (['maternelle', 'primaire', 'secondaire'] as const).forEach(otherLevel => {
                        if (otherLevel !== level && newCalendar[otherLevel]?.periods?.length > 0) {
                            newCalendar[otherLevel].periods[0].startDate = value;
                        }
                    });
                }
            }

            return newCalendar;
        });
    };

    const togglePeriodActivation = (level: 'maternelle' | 'primaire' | 'secondaire', periodIndex: number, isActive: boolean) => {
        setCalendar(prev => {
            if (!prev) return null;
            const newCalendar = { ...prev };
            const levelData = newCalendar[level];

            if (levelData && levelData.periods[periodIndex]) {
                const period = levelData.periods[periodIndex];
                period.isActive = isActive;

                // If activating a period, deactivate all other periods in this level
                if (isActive) {
                    levelData.periods.forEach((p, i) => {
                        if (i !== periodIndex) {
                            p.isActive = false;
                        }
                    });
                }
            }
            return newCalendar;
        });
    };

    const updateCalendarField = (field: keyof SchoolCalendar, value: any) => {
        setCalendar(prev => prev ? { ...prev, [field]: value } : null);
    };

    // --- RENDER HELPERS ---

    if (isLoading || !calendar || isLoadingCalendar) {
        return <div className="flex justify-center flex-col items-center h-[60vh] gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground animate-pulse text-sm">Chargement du calendrier...</p></div>;
    }

    const isActiveYear = calendar.isActive;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 h-full max-w-7xl mx-auto pb-20 px-4 md:px-0"
        >
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
                <div className="space-y-1">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => window.history.back()} 
                        className="h-8 pl-0 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors font-bold group"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
                        RETOUR
                    </Button>
                    <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                        Calendrier <span className="text-primary font-light italic">Scolaire</span>
                    </h1>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                        Gestion des cycles et périodes académiques
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="gradient-btn h-12 px-8 rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                        ENREGISTRER
                    </Button>
                </div>
            </div>

            {/* WIZARD CONTAINER */}
            <div className="grid grid-cols-12 gap-8">

                {/* LEFT: STEP 1 & 2 (Year & Activation) */}
                <div className="col-span-12 xl:col-span-3 space-y-6">

                    {/* CARD 1: SELECTION */}
                    <Card className="glass-card bg-card/40 backdrop-blur-xl border-none shadow-2xl overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
                        <CardHeader className="pb-4 pt-6 px-6">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <div className="bg-primary/10 text-primary rounded-lg w-7 h-7 flex items-center justify-center text-xs shadow-inner">01</div>
                                Sélection de l'année
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 space-y-5">
                            <div className="flex gap-2">
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger className="font-black text-xl h-14 rounded-2xl border-primary/10 bg-muted/20 focus:ring-primary/20 shadow-inner">
                                        <SelectValue placeholder="Année" />
                                    </SelectTrigger>
                                    <SelectContent className="glass-card border-primary/10">
                                        {knownYears.map(y => (
                                            <SelectItem key={y} value={y} className="font-bold">{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button 
                                    size="icon" 
                                    variant="outline" 
                                    className="h-14 w-14 shrink-0 rounded-2xl border-primary/10 bg-muted/20 hover:bg-primary/10 text-primary transition-all active:scale-95" 
                                    onClick={handleAddYear} 
                                    title="Créer l'année suivante"
                                >
                                    <PlusCircle className="h-6 w-6" />
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider text-center opacity-60">
                                Configurez ou créez un nouveau cycle académique
                            </p>
                        </CardContent>
                    </Card>

                    {/* CARD 2: ACTIVATION */}
                    <Card className={cn(
                        "glass-card border-none shadow-2xl overflow-hidden transition-all duration-500 group",
                        isActiveYear ? "bg-emerald-500/5 shadow-emerald-500/5" : "bg-amber-500/5 shadow-amber-500/5"
                    )}>
                        <div className={cn(
                            "absolute top-0 left-0 w-1 h-full transition-colors",
                            isActiveYear ? "bg-emerald-500/40 group-hover:bg-emerald-500" : "bg-amber-500/40 group-hover:bg-amber-500"
                        )} />
                        <CardHeader className="pb-4 pt-6 px-6">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <div className={cn(
                                    "rounded-lg w-7 h-7 flex items-center justify-center text-xs shadow-inner",
                                    isActiveYear ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                )}>02</div>
                                État du Système
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 space-y-4">
                            {isActiveYear ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                                            <CheckCircle2 className="h-6 w-6" />
                                        </div>
                                        <span className="font-black text-xs uppercase tracking-widest leading-none">CYCLE ACTIF</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase leading-relaxed">
                                        Cette année régit actuellement l'ensemble des opérations du système.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-3 text-amber-600">
                                        <div className="p-2 bg-amber-500/10 rounded-xl">
                                            <AlertCircle className="h-6 w-6" />
                                        </div>
                                        <span className="font-black text-xs uppercase tracking-widest leading-none">MODE BROUILLON</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-amber-600/70 uppercase leading-relaxed">
                                        Cette configuration n'est pas encore appliquée au système de production.
                                    </p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button size="sm" className="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                                                <RefreshCcw className="mr-2 h-4 w-4" /> ACTIVER {selectedYear}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="glass-card border-none bg-card/80 backdrop-blur-2xl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-2xl font-black">Activation du Cycle</AlertDialogTitle>
                                                <div className="font-bold text-muted-foreground text-sm">
                                                    Voulez-vous vraiment basculer l'ensemble de l'établissement sur <span className="text-foreground">{selectedYear}</span> ?
                                                    <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                            <p className="text-xs text-foreground/80 leading-relaxed italic">Archivage automatique de l'année précédente.</p>
                                                        </div>
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                                            <p className="text-xs text-foreground/80 leading-relaxed italic">Basculement des inscriptions et de la comptabilité.</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-3 pt-4">
                                                <AlertDialogCancel className="h-11 rounded-xl font-bold border-primary/10">ANNULER</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleActivateYear} className="h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black px-6 shadow-lg shadow-emerald-500/20">CONFIRMER L'ACTIVATION</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* WIZARD: IMPORT (Only for Draft/Archive years) */}
                    {!isActiveYear && (
                        <YearImportWizard 
                            targetYear={selectedYear}
                            availableYears={knownYears}
                            matricule={schoolData?.matricule || ""}
                            onComplete={() => refreshData()}
                        />
                    )}

                    {/* DATES GLOBALES */}
                    <Card className="glass-card bg-card/40 backdrop-blur-xl border-none shadow-2xl overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-400/40 group-hover:bg-slate-400 transition-colors" />
                        <CardHeader className="pb-4 pt-6 px-6">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <div className="bg-slate-500/10 text-slate-600 rounded-lg w-7 h-7 flex items-center justify-center text-xs shadow-inner">03</div>
                                Bornes Globales
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-6 pb-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Date d'Ouverture</Label>
                                <DatePicker
                                    className="h-11 rounded-xl border-primary/10 bg-muted/20 hover:bg-muted/30 transition-all font-bold"
                                    value={calendar.startDate}
                                    onChange={val => {
                                        setCalendar(prev => {
                                            if (!prev) return null;
                                            const newCal = { ...prev, startDate: val };
                                            // sync first period
                                            (['maternelle', 'primaire', 'secondaire'] as const).forEach(otherLevel => {
                                                if (newCal[otherLevel]?.periods?.length > 0) {
                                                    newCal[otherLevel].periods[0].startDate = val;
                                                }
                                            });
                                            return newCal;
                                        });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Date de Fermeture</Label>
                                <DatePicker
                                    className="h-11 rounded-xl border-primary/10 bg-muted/20 hover:bg-muted/30 transition-all font-bold"
                                    value={calendar.endDate}
                                    onChange={val => updateCalendarField('endDate', val)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* RIGHT: STEP 3 (Periods Configuration) */}
                <div className="col-span-12 xl:col-span-9">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col space-y-6">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-3 text-foreground/80">
                                <div className="bg-primary/10 text-primary rounded-lg w-8 h-8 flex items-center justify-center text-xs shadow-inner">04</div>
                                Configuration <span className="text-primary/60 font-light">Périodes</span>
                            </h2>
                            <TabsList className="glass-card bg-card/40 border-primary/5 p-1 h-12 rounded-2xl">
                                <TabsTrigger value="summary" className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Vue d'ensemble</TabsTrigger>
                                <TabsTrigger value="maternelle" disabled={!hasMaternelle} className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Maternelle</TabsTrigger>
                                <TabsTrigger value="primaire" disabled={!hasPrimaire} className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Primaire</TabsTrigger>
                                <TabsTrigger value="secondaire" disabled={!hasSecondaire} className="rounded-xl px-6 font-bold data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg transition-all">Secondaire</TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 glass-card bg-card/40 backdrop-blur-3xl rounded-[2.5rem] border-none shadow-2xl p-8 overflow-hidden flex flex-col min-h-[600px] group">
                            <ScrollArea className="flex-1 pr-4">

                                    {/* TAB CONTENT: LEVELS */}
                                    {(['maternelle', 'primaire', 'secondaire'] as const).map(level => {
                                        // Skip mapping if level is not enabled
                                        if (level === 'maternelle' && !hasMaternelle) return null;
                                        if (level === 'primaire' && !hasPrimaire) return null;
                                        if (level === 'secondaire' && !hasSecondaire) return null;

                                        return (
                                            <TabsContent key={level} value={level} className="mt-0 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                                <div className="flex items-center justify-between border-b border-primary/10 pb-6">
                                                    <div>
                                                        <h3 className="text-3xl font-black capitalize tracking-tight">{level}</h3>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-60">Gestion des périodes et sessions</p>
                                                    </div>
                                                    {!isActiveYear && <Badge className="rounded-lg px-3 py-1 bg-amber-500/10 text-amber-600 border-none font-black text-[10px] uppercase tracking-wider">Mode Brouillon</Badge>}
                                                </div>

                                                <div className="space-y-6">
                                                    {calendar[level].periods.map((period: CalendarPeriod, idx: number) => (
                                                        <div key={period.id} className={cn(
                                                            "glass-card bg-muted/20 border-none rounded-3xl p-6 transition-all duration-300 hover:bg-muted/30 group/item relative overflow-hidden",
                                                            period.isActive ? "ring-2 ring-emerald-500/50 shadow-xl shadow-emerald-500/10" : "hover:shadow-lg"
                                                        )}>
                                                            {period.isActive && <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl -mr-12 -mt-12 rounded-full" />}
                                                            <div className="flex items-center justify-between gap-6 relative z-10">
                                                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                                                    {/* INFO */}
                                                                    <div className="md:col-span-4 space-y-1">
                                                                        <div className="font-black text-xl tracking-tight text-foreground">{getShortName(period.name)}</div>
                                                                        <div className={cn(
                                                                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md inline-block",
                                                                            period.type === 'exam' ? "bg-rose-500/10 text-rose-500" : "bg-primary/10 text-primary"
                                                                        )}>
                                                                            {period.type === 'normal' ? 'Cycle de cours' : "Session d'Examens"}
                                                                        </div>
                                                                    </div>

                                                                    {/* DATES */}
                                                                    <div className="md:col-span-6 flex items-center gap-4">
                                                                        <div className="flex-1 space-y-1.5">
                                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Début</Label>
                                                                            <DatePicker
                                                                                value={period.startDate || ''}
                                                                                onChange={val => updatePeriodDate(level, idx, 'startDate', val)}
                                                                                placeholder="Début"
                                                                                className="h-11 rounded-xl border-primary/5 bg-background/40 hover:bg-background/60 transition-all font-bold text-sm shadow-inner"
                                                                            />
                                                                        </div>
                                                                        <div className="mt-6">
                                                                            <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                                                                                <ArrowLeft className="h-4 w-4 rotate-180" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex-1 space-y-1.5">
                                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Fin</Label>
                                                                            <DatePicker
                                                                                value={period.endDate || ''}
                                                                                onChange={val => updatePeriodDate(level, idx, 'endDate', val)}
                                                                                placeholder="Fin"
                                                                                className="h-11 rounded-xl border-primary/5 bg-background/40 hover:bg-background/60 transition-all font-bold text-sm shadow-inner"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* ACTIONS */}
                                                                <div className="flex flex-col items-center gap-3 border-l border-primary/10 pl-6 h-full justify-center">
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        <span className={cn(
                                                                            "text-[9px] font-black uppercase tracking-[0.2em] transition-colors",
                                                                            period.isActive ? "text-emerald-500" : "text-muted-foreground/40"
                                                                        )}>
                                                                            {period.isActive ? "ACTIVE" : "INACTIVE"}
                                                                        </span>
                                                                        <Switch
                                                                            id={`p-act-${period.id}`}
                                                                            checked={period.isActive || false}
                                                                            onCheckedChange={val => togglePeriodActivation(level, idx, val)}
                                                                            disabled={!isActiveYear}
                                                                            className="data-[state=checked]:bg-emerald-500 scale-125"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* CONGES ET VACANCES SCOLAIRES SPECIFIQUE AU NIVEAU */}
                                                {((calendar.vacations || []).filter(v => v.appliesTo?.includes(level)).length > 0 || 
                                                  (calendar.bufferPeriods || []).filter(b => b.appliesTo?.includes(level)).length > 0) && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                                                        {(calendar.vacations || []).filter(v => v.appliesTo?.includes(level)).length > 0 && (
                                                            <div className="glass-card bg-amber-500/5 border-none p-6 rounded-[2rem] space-y-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-amber-500/10 rounded-xl">
                                                                        <Sun className="h-5 w-5 text-amber-600" />
                                                                    </div>
                                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-700/70">Congés & Vacances</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {(calendar.vacations || []).filter(v => v.appliesTo?.includes(level)).map(v => (
                                                                        <div key={v.id} className="flex flex-col gap-1 p-4 bg-background/40 rounded-2xl border border-amber-500/10 shadow-inner">
                                                                            <span className="font-black text-sm text-amber-900/80">{v.name || 'Sans nom'}</span>
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-600/60">
                                                                                {v.startDate && v.endDate ? `Du ${formatDate(v.startDate)} au ${formatDate(v.endDate)}` : 'Dates non définies'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {(calendar.bufferPeriods || []).filter(b => b.appliesTo?.includes(level)).length > 0 && (
                                                            <div className="glass-card bg-blue-500/5 border-none p-6 rounded-[2rem] space-y-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-blue-500/10 rounded-xl">
                                                                        <Clock className="h-5 w-5 text-blue-600" />
                                                                    </div>
                                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-700/70">Délibérations</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {(calendar.bufferPeriods || []).filter(b => b.appliesTo?.includes(level)).map(b => (
                                                                        <div key={b.id} className="flex flex-col gap-1 p-4 bg-background/40 rounded-2xl border border-blue-500/10 shadow-inner">
                                                                            <span className="font-black text-sm text-blue-900/80">{b.name || 'Sans nom'}</span>
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-600/60">
                                                                                {b.startDate && b.endDate ? `Du ${formatDate(b.startDate)} au ${formatDate(b.endDate)}` : 'Dates non définies'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                            </TabsContent>
                                        );
                                    })}

                                    {/* TAB CONTENT: SUMMARY (Simple read-only view) */}
                                    {activeTab === 'summary' && (
                                        <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {(['maternelle', 'primaire', 'secondaire'] as const).map(l => {
                                                    const isEnabled = (l === 'maternelle' && hasMaternelle) ||
                                                        (l === 'primaire' && hasPrimaire) ||
                                                        (l === 'secondaire' && hasSecondaire);

                                                    const periods = calendar[l].periods;
                                                    const activePeriod = periods.find(p => p.isActive);
                                                    const activeName = activePeriod ? getShortName(activePeriod.name) : 'AUCUN ACTIF';
                                                    
                                                    return (
                                                        <Card key={l} className={cn(
                                                            "glass-card border-none shadow-xl transition-all duration-500 overflow-hidden relative group",
                                                            !isEnabled ? "opacity-40 grayscale" : "hover:scale-[1.02] hover:shadow-2xl"
                                                        )}>
                                                            <div className={cn(
                                                                "absolute top-0 left-0 w-1 h-full transition-colors",
                                                                isEnabled ? "bg-primary/40 group-hover:bg-primary" : "bg-muted"
                                                            )} />
                                                            <CardContent className="p-8 flex flex-col gap-3">
                                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{l}</h3>
                                                                <div className="text-3xl font-black text-foreground tracking-tight truncate" title={activeName}>
                                                                    {activeName}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isEnabled ? "bg-emerald-500" : "bg-muted-foreground")} />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                                                                        {isEnabled ? 'Cycle en cours' : 'Niveau désactivé'}
                                                                    </span>
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )
                                                })}
                                            </div>

                                            <div className="p-12 glass-card bg-primary/5 border-none rounded-[2rem] text-center space-y-4 relative overflow-hidden group">
                                                <div className="absolute inset-0 bg-primary/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative z-10 flex flex-col items-center">
                                                    <div className="p-4 bg-primary/10 rounded-[1.5rem] mb-2 shadow-inner">
                                                        <CalendarIcon className="w-10 h-10 text-primary opacity-60" />
                                                    </div>
                                                    <p className="text-xl font-black text-foreground/80 tracking-tight">Configuration Granulaire</p>
                                                    <p className="text-sm font-bold text-muted-foreground max-w-md mx-auto leading-relaxed">
                                                        Basculez entre les onglets pour ajuster les dates spécifiques, gérer les jours fériés et les périodes de délibération.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* GLOBAL HOLIDAYS, SPECIAL DAYS, VACATIONS AND BUFFER PERIODS */}
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                                {/* HOLIDAYS (JOURS FERIES) */}
                                                <Card className="glass-card bg-muted/20 border-none shadow-lg overflow-hidden flex flex-col">
                                                    <CardHeader className="p-6 border-b border-primary/5 bg-background/20">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <CardTitle className="text-lg font-black tracking-tight">Jours Fériés</CardTitle>
                                                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Calendrier des congés légaux</CardDescription>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-9 px-4 rounded-xl border-primary/10 bg-background/40 hover:bg-primary/10 text-primary font-black text-[10px] uppercase transition-all"
                                                                onClick={() => {
                                                                    const levels: ('maternelle' | 'primaire' | 'secondaire')[] = [];
                                                                    if (hasMaternelle) levels.push('maternelle');
                                                                    if (hasPrimaire) levels.push('primaire');
                                                                    if (hasSecondaire) levels.push('secondaire');

                                                                    const newHoliday: HolidayEntry = { 
                                                                        id: `hol_${Date.now()}`, 
                                                                        name: '', 
                                                                        date: '', 
                                                                        appliesTo: levels 
                                                                    };
                                                                    updateCalendarField('holidays', [...(calendar.holidays || []), newHoliday]);
                                                                }}
                                                            >
                                                                <PlusCircle className="mr-2 h-4 w-4" /> AJOUTER
                                                            </Button>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 flex-1">
                                                        {(!calendar.holidays || calendar.holidays.length === 0) ? (
                                                            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                                                <AlertCircle className="h-8 w-8 mb-2" />
                                                                <p className="text-xs font-black uppercase tracking-widest">Aucun jour férié</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {calendar.holidays.map((holiday, idx) => (
                                                                    <div key={holiday.id} className="bg-background/40 p-4 rounded-2xl border border-primary/5 shadow-inner space-y-3 group/item">
                                                                        <div className="flex items-center gap-3">
                                                                            <Input
                                                                                placeholder="Ex: Fête du Travail"
                                                                                value={holiday.name}
                                                                                onChange={(e) => {
                                                                                    const updated = [...calendar.holidays];
                                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                                    updateCalendarField('holidays', updated);
                                                                                }}
                                                                                className="h-10 text-sm font-bold border-primary/5 bg-background/60 rounded-xl focus:ring-primary/20"
                                                                            />
                                                                            <DatePicker
                                                                                className="h-10 text-sm w-[150px] rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={holiday.date || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...calendar.holidays];
                                                                                    updated[idx] = { ...updated[idx], date: val };
                                                                                    updateCalendarField('holidays', updated);
                                                                                }}
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                onClick={() => {
                                                                                    const updated = calendar.holidays.filter((_, i) => i !== idx);
                                                                                    updateCalendarField('holidays', updated);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-4 px-1">
                                                                            {(['maternelle', 'primaire', 'secondaire'] as const).map((lvl) => {
                                                                                const exists = (lvl === 'maternelle' && hasMaternelle) || (lvl === 'primaire' && hasPrimaire) || (lvl === 'secondaire' && hasSecondaire);
                                                                                if (!exists) return null;
                                                                                return (
                                                                                    <label key={lvl} className="flex items-center gap-2 cursor-pointer group/label">
                                                                                        <Checkbox 
                                                                                            className="rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                                                            checked={holiday.appliesTo?.includes(lvl)} 
                                                                                            onCheckedChange={(checked) => {
                                                                                                const updated = [...calendar.holidays];
                                                                                                const current = holiday.appliesTo || [];
                                                                                                const levels = checked ? [...current, lvl] : current.filter(l => l !== lvl);
                                                                                                updated[idx] = { ...updated[idx], appliesTo: levels };
                                                                                                updateCalendarField('holidays', updated);
                                                                                            }}
                                                                                        />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover/label:text-primary transition-colors">{lvl}</span>
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* SPECIAL DAYS (JOURS SPECIAUX) */}
                                                <Card className="glass-card bg-muted/20 border-none shadow-lg overflow-hidden flex flex-col">
                                                    <CardHeader className="p-6 border-b border-primary/5 bg-background/20">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <CardTitle className="text-lg font-black tracking-tight">Jours Spéciaux</CardTitle>
                                                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Ouvrés ou chômés spécifiques</CardDescription>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-9 px-4 rounded-xl border-primary/10 bg-background/40 hover:bg-primary/10 text-primary font-black text-[10px] uppercase transition-all"
                                                                onClick={() => {
                                                                    const levels: ('maternelle' | 'primaire' | 'secondaire')[] = [];
                                                                    if (hasMaternelle) levels.push('maternelle');
                                                                    if (hasPrimaire) levels.push('primaire');
                                                                    if (hasSecondaire) levels.push('secondaire');

                                                                    const newSpecial: SpecialDay = { 
                                                                        id: `spec_${Date.now()}`, 
                                                                        name: '', 
                                                                        date: '', 
                                                                        status: 'working',
                                                                        appliesTo: levels 
                                                                    };
                                                                    updateCalendarField('specialDays', [...(calendar.specialDays || []), newSpecial]);
                                                                }}
                                                            >
                                                                <PlusCircle className="mr-2 h-4 w-4" /> AJOUTER
                                                            </Button>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 flex-1">
                                                        {(!calendar.specialDays || calendar.specialDays.length === 0) ? (
                                                            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                                                <CalendarIcon className="h-8 w-8 mb-2" />
                                                                <p className="text-xs font-black uppercase tracking-widest">Aucun jour spécial</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {calendar.specialDays.map((special, idx) => (
                                                                    <div key={special.id} className="bg-background/40 p-4 rounded-2xl border border-primary/5 shadow-inner space-y-3 group/item">
                                                                        <div className="flex flex-wrap items-center gap-3">
                                                                            <Input
                                                                                placeholder="Ex: Pont de l'Ascension"
                                                                                value={special.name}
                                                                                onChange={(e) => {
                                                                                    const updated = [...(calendar.specialDays || [])];
                                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                                    updateCalendarField('specialDays', updated);
                                                                                }}
                                                                                className="h-10 text-sm font-bold border-primary/5 bg-background/60 rounded-xl flex-1 min-w-[150px]"
                                                                            />
                                                                            <DatePicker
                                                                                className="h-10 text-sm w-[130px] rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={special.date || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...(calendar.specialDays || [])];
                                                                                    updated[idx] = { ...updated[idx], date: val };
                                                                                    updateCalendarField('specialDays', updated);
                                                                                }}
                                                                            />
                                                                            <Select 
                                                                                value={special.status} 
                                                                                onValueChange={(val: 'off' | 'working') => {
                                                                                    const updated = [...(calendar.specialDays || [])];
                                                                                    updated[idx] = { ...updated[idx], status: val };
                                                                                    updateCalendarField('specialDays', updated);
                                                                                }}
                                                                            >
                                                                                <SelectTrigger className={cn(
                                                                                    "h-10 w-[100px] rounded-xl border-primary/5 font-black text-[9px] uppercase tracking-widest",
                                                                                    special.status === 'working' ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                                                                                )}>
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                                <SelectContent className="glass-card border-none">
                                                                                    <SelectItem value="working" className="font-bold">OUVRÉ</SelectItem>
                                                                                    <SelectItem value="off" className="font-bold">CHÔMÉ</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                onClick={() => {
                                                                                    const updated = (calendar.specialDays || []).filter((_, i) => i !== idx);
                                                                                    updateCalendarField('specialDays', updated);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-4 px-1">
                                                                            {(['maternelle', 'primaire', 'secondaire'] as const).map((lvl) => {
                                                                                const exists = (lvl === 'maternelle' && hasMaternelle) || (lvl === 'primaire' && hasPrimaire) || (lvl === 'secondaire' && hasSecondaire);
                                                                                if (!exists) return null;
                                                                                return (
                                                                                    <label key={lvl} className="flex items-center gap-2 cursor-pointer group/label">
                                                                                        <Checkbox 
                                                                                            className="rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                                                            checked={special.appliesTo?.includes(lvl)} 
                                                                                            onCheckedChange={(checked) => {
                                                                                                const updated = [...(calendar.specialDays || [])];
                                                                                                const current = special.appliesTo || [];
                                                                                                const levels = checked ? [...current, lvl] : current.filter(l => l !== lvl);
                                                                                                updated[idx] = { ...updated[idx], appliesTo: levels };
                                                                                                updateCalendarField('specialDays', updated);
                                                                                            }}
                                                                                        />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover/label:text-primary transition-colors">{lvl}</span>
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* VACATIONS (CONGES) */}
                                                <Card className="glass-card bg-muted/20 border-none shadow-lg overflow-hidden flex flex-col">
                                                    <CardHeader className="p-6 border-b border-primary/5 bg-background/20">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <CardTitle className="text-lg font-black tracking-tight">Vacances Scolaires</CardTitle>
                                                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Périodes étendues de repos</CardDescription>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-9 px-4 rounded-xl border-primary/10 bg-background/40 hover:bg-primary/10 text-primary font-black text-[10px] uppercase transition-all"
                                                                onClick={() => {
                                                                    const levels: ('maternelle' | 'primaire' | 'secondaire')[] = [];
                                                                    if (hasMaternelle) levels.push('maternelle');
                                                                    if (hasPrimaire) levels.push('primaire');
                                                                    if (hasSecondaire) levels.push('secondaire');

                                                                    const newVac: Vacation = {
                                                                        id: `vac_${Date.now()}`,
                                                                        name: '',
                                                                        startDate: '',
                                                                        endDate: '',
                                                                        appliesTo: levels,
                                                                    };
                                                                    updateCalendarField('vacations', [...(calendar.vacations || []), newVac]);
                                                                }}
                                                            >
                                                                <PlusCircle className="mr-2 h-4 w-4" /> AJOUTER
                                                            </Button>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 flex-1">
                                                        {(!calendar.vacations || calendar.vacations.length === 0) ? (
                                                            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                                                <Sun className="h-8 w-8 mb-2" />
                                                                <p className="text-xs font-black uppercase tracking-widest">Aucune vacance</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6">
                                                                {calendar.vacations.map((vacation, idx) => (
                                                                    <div key={vacation.id} className="bg-background/40 p-5 rounded-[1.5rem] border border-primary/5 shadow-inner space-y-4 group/item">
                                                                        <div className="flex items-center gap-3">
                                                                            <Input
                                                                                placeholder="Ex: Vacances de Noël"
                                                                                value={vacation.name}
                                                                                onChange={(e) => {
                                                                                    const updated = [...calendar.vacations];
                                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                                    updateCalendarField('vacations', updated);
                                                                                }}
                                                                                className="h-10 text-sm font-bold border-primary/5 bg-background/60 rounded-xl flex-1"
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                onClick={() => {
                                                                                    const updated = calendar.vacations.filter((_, i) => i !== idx);
                                                                                    updateCalendarField('vacations', updated);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <DatePicker
                                                                                className="h-10 text-sm flex-1 rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={vacation.startDate || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...calendar.vacations];
                                                                                    updated[idx] = { ...updated[idx], startDate: val };
                                                                                    updateCalendarField('vacations', updated);
                                                                                }}
                                                                                placeholder="Début"
                                                                            />
                                                                            <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground rotate-90 md:rotate-0">
                                                                                <ArrowLeft className="h-4 w-4 rotate-180" />
                                                                            </div>
                                                                            <DatePicker
                                                                                className="h-10 text-sm flex-1 rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={vacation.endDate || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...calendar.vacations];
                                                                                    updated[idx] = { ...updated[idx], endDate: val };
                                                                                    updateCalendarField('vacations', updated);
                                                                                }}
                                                                                placeholder="Fin"
                                                                            />
                                                                        </div>
                                                                        {/* Scopes */}
                                                                        <div className="flex flex-wrap items-center gap-4 bg-primary/5 p-3 rounded-xl border border-primary/5">
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Applique à :</span>
                                                                            {(['maternelle', 'primaire', 'secondaire'] as const).map(lvl => {
                                                                                const exists = (lvl === 'maternelle' && hasMaternelle) || (lvl === 'primaire' && hasPrimaire) || (lvl === 'secondaire' && hasSecondaire);
                                                                                if (!exists) return null;
                                                                                return (
                                                                                    <label key={lvl} className="flex items-center gap-2 cursor-pointer group/label">
                                                                                        <Checkbox 
                                                                                            className="rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                                                            checked={vacation.appliesTo?.includes(lvl)} 
                                                                                            onCheckedChange={(checked) => {
                                                                                                const updated = [...calendar.vacations];
                                                                                                const current = vacation.appliesTo || [];
                                                                                                const levels = checked ? [...current, lvl] : current.filter(l => l !== lvl);
                                                                                                updated[idx] = { ...updated[idx], appliesTo: levels };
                                                                                                updateCalendarField('vacations', updated);
                                                                                            }}
                                                                                        />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover/label:text-primary transition-colors">{lvl}</span>
                                                                                    </label>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                {/* BUFFER PERIODS (DELIBERATIONS / TAMPON) */}
                                                <Card className="glass-card bg-muted/20 border-none shadow-lg overflow-hidden flex flex-col">
                                                    <CardHeader className="p-6 border-b border-primary/5 bg-background/20">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <CardTitle className="text-lg font-black tracking-tight">Délibérations</CardTitle>
                                                                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Jours tampons pour résultats</CardDescription>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-9 px-4 rounded-xl border-primary/10 bg-background/40 hover:bg-primary/10 text-primary font-black text-[10px] uppercase transition-all"
                                                                onClick={() => {
                                                                    const levels: ('maternelle' | 'primaire' | 'secondaire')[] = [];
                                                                    if (hasMaternelle) levels.push('maternelle');
                                                                    if (hasPrimaire) levels.push('primaire');
                                                                    if (hasSecondaire) levels.push('secondaire');

                                                                    const newBuffer: BufferPeriod = {
                                                                        id: `buf_${Date.now()}`,
                                                                        name: '',
                                                                        startDate: '',
                                                                        endDate: '',
                                                                        appliesTo: levels,
                                                                    };
                                                                    updateCalendarField('bufferPeriods', [...(calendar.bufferPeriods || []), newBuffer]);
                                                                }}
                                                            >
                                                                <PlusCircle className="mr-2 h-4 w-4" /> AJOUTER
                                                            </Button>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-6 flex-1">
                                                        {(!calendar.bufferPeriods || calendar.bufferPeriods.length === 0) ? (
                                                            <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                                                <Clock className="h-8 w-8 mb-2" />
                                                                <p className="text-xs font-black uppercase tracking-widest">Aucune délibération</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6">
                                                                {calendar.bufferPeriods.map((buffer, idx) => (
                                                                    <div key={buffer.id} className="bg-background/40 p-5 rounded-[1.5rem] border border-primary/5 shadow-inner space-y-4 group/item">
                                                                        <div className="flex items-center gap-3">
                                                                            <Input
                                                                                placeholder="Ex: Délibération T1"
                                                                                value={buffer.name}
                                                                                onChange={(e) => {
                                                                                    const updated = [...(calendar.bufferPeriods || [])];
                                                                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                                                                    updateCalendarField('bufferPeriods', updated);
                                                                                }}
                                                                                className="h-10 text-sm font-bold border-primary/5 bg-background/60 rounded-xl flex-1"
                                                                            />
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                                                onClick={() => {
                                                                                    const updated = (calendar.bufferPeriods || []).filter((_, i) => i !== idx);
                                                                                    updateCalendarField('bufferPeriods', updated);
                                                                                }}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <DatePicker
                                                                                className="h-10 text-sm flex-1 rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={buffer.startDate || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...(calendar.bufferPeriods || [])];
                                                                                    updated[idx] = { ...updated[idx], startDate: val };
                                                                                    updateCalendarField('bufferPeriods', updated);
                                                                                }}
                                                                                placeholder="Début"
                                                                            />
                                                                            <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground rotate-90 md:rotate-0">
                                                                                <ArrowLeft className="h-4 w-4 rotate-180" />
                                                                            </div>
                                                                            <DatePicker
                                                                                className="h-10 text-sm flex-1 rounded-xl border-primary/5 bg-background/60 font-bold"
                                                                                value={buffer.endDate || ''}
                                                                                onChange={(val) => {
                                                                                    const updated = [...(calendar.bufferPeriods || [])];
                                                                                    updated[idx] = { ...updated[idx], endDate: val };
                                                                                    updateCalendarField('bufferPeriods', updated);
                                                                                }}
                                                                                placeholder="Fin"
                                                                            />
                                                                        </div>
                                                                        {/* Scopes */}
                                                                        <div className="flex flex-wrap items-center gap-4 bg-primary/5 p-3 rounded-xl border border-primary/5">
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Applique à :</span>
                                                                            {(['maternelle', 'primaire', 'secondaire'] as const).map(lvl => {
                                                                                const exists = (lvl === 'maternelle' && hasMaternelle) || (lvl === 'primaire' && hasPrimaire) || (lvl === 'secondaire' && hasSecondaire);
                                                                                if (!exists) return null;
                                                                                return (
                                                                                    <label key={lvl} className="flex items-center gap-2 cursor-pointer group/label">
                                                                                        <Checkbox 
                                                                                            className="rounded-md border-primary/20 data-[state=checked]:bg-primary"
                                                                                            checked={buffer.appliesTo?.includes(lvl)} 
                                                                                            onCheckedChange={(checked) => {
                                                                                                const updated = [...(calendar.bufferPeriods || [])];
                                                                                                const current = buffer.appliesTo || [];
                                                                                                const levels = checked ? [...current, lvl] : current.filter(l => l !== lvl);
                                                                                                updated[idx] = { ...updated[idx], appliesTo: levels };
                                                                                                updateCalendarField('bufferPeriods', updated);
                                                                                            }}
                                                                                        />
                                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground group-hover/label:text-primary transition-colors">{lvl}</span>
                                                                                    </label>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        </div>
                                    )}

                                </ScrollArea>
                            </div>
                        </Tabs>
                    </div>
                </div>
            </motion.div>
    );
}
