"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft, Save, Loader2, Building, School, ClipboardList,
    PlusCircle, Trash2, Clock, Coffee, StopCircle, Pencil,
    FileJson, Upload, X, Import, Settings2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { saveSchoolSetupData, getOfficialCourses } from "./actions";
import Link from "next/link";
import Image from "next/image";
import { ConfiguredOption } from "@/types/post-cteb-types";
import { assignPostCTEBCodes, generateNomenclaturePreview, type NomenclaturePreview, getPostCTEBFullName, getPostCTEBShortName } from "@/lib/post-cteb-nomenclature";
import { SectionConfigModal } from "@/components/section-config-modal";
import { calculateMaxPoints, getMaxLabel } from "@/lib/maxima-utils";

// --- Types ---
type Course = {
    name: string;
    max: number;
    domaine?: string;
    sousDomaine?: string;
};

type TimeSlot = {
    id: string;
    type: "course" | "recreation" | "end";
    label: string;
    value: string;
};

type MentionConfig = {
    name: string;
    min: number;
    max: number;
    weight?: number;
};

type LevelMentionsConfig = {
    applicationMentions: MentionConfig[];
    conductMode: "COTATION" | "MENTION";
    conductMaxScore: number;
    conductMentions: MentionConfig[];
};


const initialClassroomConfig = {
    maternelle: { "1ère Maternelle": 0, "2ème Maternelle": 0, "3ème Maternelle": 0 },
    primaire: { "1e Primaire": 0, "2e Primaire": 0, "3e Primaire": 0, "4e Primaire": 0, "5e Primaire": 0, "6e Primaire": 0, "6e Spécial": 0 },
    secondaire: { "7e CTEB": 0, "8e CTEB": 0, "1e Humanité": 0, "2e Humanité": 0, "3e Humanité": 0, "4e Humanité": 0 },
};

// --- Helper functions ---
const normalizeTime = (input: string): string | null => {
    const clean = input.replace(/[^0-9:]/g, "").trim();
    if (!clean) return null;

    let hours: number, minutes: number;

    if (clean.includes(":")) {
        const parts = clean.split(":");
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
    } else if (clean.length === 3) {
        hours = parseInt(clean.substring(0, 1), 10);
        minutes = parseInt(clean.substring(1), 10);
    } else if (clean.length === 4) {
        hours = parseInt(clean.substring(0, 2), 10);
        minutes = parseInt(clean.substring(2), 10);
    } else {
        return null;
    }

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

const getLetter = (index: number) => {
    let charCode = 65 + index;
    if (charCode >= 79) charCode++; // Skip 'O'
    return String.fromCharCode(charCode);
};

const formatOrdinal = (label: string) => {
    const numMatch = label.match(/\d+/);
    if (!numMatch) return label.toUpperCase();
    const num = parseInt(numMatch[0], 10);
    if (num === 1) return "1ERE";
    return `${num}EME`;
};

// --- Collapsible Section Component (stable, defined outside render) ---
function CollapsibleSection({ id, icon: Icon, title, description, isOpen, onToggle, children }: {
    id: string;
    icon: React.ElementType;
    title: string;
    description: string;
    isOpen: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}) {
    return (
        <Card className="border-none shadow-md overflow-hidden">
            <button
                onClick={() => onToggle(id)}
                className="w-full text-left px-6 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">{title}</h2>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                </div>
                <div className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
            </button>
            {isOpen && <CardContent className="px-6 pb-6 pt-0 border-t border-border/50">{children}</CardContent>}
        </Card>
    );
}

export default function SchoolSetupPage() {
    const { schoolData: initialData, isLoading, refreshData } = useSchoolData();

    // --- State ---
    const [data, setData] = useState<Record<string, unknown> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [courseInputs, setCourseInputs] = useState<Record<string, string>>({});
    const [newTimeSlotInput, setNewTimeSlotInput] = useState<Record<string, { start: string; end: string }>>({
        maternelle: { start: "", end: "" },
        primaire: { start: "", end: "" },
        secondaire: { start: "", end: "" },
    });
    const [editingCourse, setEditingCourse] = useState<{ classroom: string; index: number; name: string; max: number } | null>(null);
    const [loadingOfficial, setLoadingOfficial] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["identity"]));
    const [showSectionModal, setShowSectionModal] = useState(false);

    // --- Initialize from context ---
    useEffect(() => {
        if (initialData) {
            const config = (initialData.configuration as Record<string, unknown>) || {};
            const struct = (initialData.structure as Record<string, Record<string, number>>) || {};
            const rawLevels = (initialData.levels as Record<string, boolean>) || {};
            const normalizedLevels = {
                maternelle: !!(rawLevels.MATERNELLE ?? rawLevels.maternelle),
                primaire: !!(rawLevels.PRIMAIRE ?? rawLevels.primaire),
                secondaire: !!(rawLevels.SECONDAIRE ?? rawLevels.secondaire),
            };

            setData({
                name: initialData.name || "",
                address: initialData.address || "",
                city: initialData.city || "",
                province: initialData.province || "",
                phone: initialData.phone || "",
                logo: initialData.logo || "",
                levels: normalizedLevels,
                classrooms: {
                    maternelle: { ...initialClassroomConfig.maternelle, ...(struct.maternelle || {}) },
                    primaire: { ...initialClassroomConfig.primaire, ...(struct.primaire || {}) },
                    secondaire: { ...initialClassroomConfig.secondaire, ...(struct.secondaire || {}) },
                },
                courses: (initialData.courses as Record<string, unknown[]>) || {},
                timeSlots: (initialData.timeSlots as Record<string, unknown>) || {},
                postCTEB: config.postCTEB || false,
                configuredOptions: config.configuredOptions || [],
                qualitativeMentions: config.qualitativeMentions || {},
                finalDecisions: config.finalDecisions || {
                    primaire: ["Passe en classe supérieure", "Double de classe", "Exclus"],
                    secondaire: ["Passe en classe supérieure", "Double de classe", "Exclus"]
                },
                configuration: initialData.configuration || config || {},
            });
        }
    }, [initialData]);

    // --- Helpers ---
    const toggleSection = useCallback((key: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const levels = (data?.levels as Record<string, boolean>) || {};
    const classrooms = (data?.classrooms as Record<string, Record<string, number>>) || {};
    const courses = (data?.courses as Record<string, (string | Course)[]>) || {};
    const timeSlots = (data?.timeSlots as Record<string, TimeSlot[] | Record<string, TimeSlot[]>>) || {};

    // --- Classroom name generation ---
    const generateClassroomNames = useCallback(
        (level: string, gradeLabel: string): { short: string; long: string }[] => {
            if (!data) return [];
            const levelClassrooms = classrooms[level] || {};
            const count = levelClassrooms[gradeLabel] || 0;
            if (!count) return [];

            const parts = gradeLabel.split(" ");
            const nominal = parts[0];
            const ordinal = formatOrdinal(nominal);
            const rest = parts.slice(1).join(" ").toUpperCase();

            return Array.from({ length: count }, (_, i) => {
                const letter = count > 1 ? ` ${getLetter(i)}` : "";
                const shortDigit = nominal.replace(/\D/g, "");
                
                let shortCode = "";
                if (level === "maternelle") {
                    const suffix = count > 1 ? getLetter(i) : "";
                    shortCode = `${shortDigit}M${suffix}`;
                } else if (level === "primaire") {
                    const suffix = count > 1 ? getLetter(i) : "";
                    shortCode = `${shortDigit}P${suffix}`;
                } else {
                    // level === "secondaire": must always contain a letter, default "A"
                    const suffix = getLetter(i);
                    shortCode = `${shortDigit}${suffix}`;
                }

                let longName = "";
                if (gradeLabel.includes("CTEB")) {
                    longName = `${ordinal} EDUCATION DE BASE${letter}`;
                } else {
                    longName = `${ordinal} ${rest}${letter}`;
                }

                return {
                    short: shortCode,
                    long: longName.toUpperCase().replace(/\s+/g, " ").trim(),
                };
            });
        },
        [data, classrooms]
    );

    // --- Time slot start time tracking ---
    const timeSlotStartTimes = useMemo(() => {
        const starts: Record<string, string> = {};
        for (const level of ["maternelle", "primaire", "secondaire"]) {
            const slots: TimeSlot[] = (timeSlots[level] as TimeSlot[]) || [];
            if (slots.length > 0) {
                const lastSlot = slots[slots.length - 1];
                if (lastSlot.type === "end") {
                    starts[level] = "";
                } else if (lastSlot.value.includes("-")) {
                    starts[level] = lastSlot.value.split("-")[1];
                }
            } else {
                starts[level] = "";
            }
        }
        return starts;
    }, [timeSlots]);

    // --- Handlers ---
    const handleInputChange = (field: string, value: string) => {
        setData((prev) => (prev ? { ...prev, [field]: value } : null));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setData((prev) => (prev ? { ...prev, logo: reader.result as string } : null));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLevelToggle = (level: string) => {
        setData((prev) => {
            if (!prev) return null;
            const lvls = { ...(prev.levels as Record<string, boolean>) };
            lvls[level] = !lvls[level];
            return { ...prev, levels: lvls };
        });
    };

    const handleClassroomCountChange = (level: string, grade: string, value: string) => {
        const count = parseInt(value, 10);
        if (isNaN(count) || count < 0) return;
        setData((prev) => {
            if (!prev) return null;
            const cls = { ...(prev.classrooms as Record<string, Record<string, number>>) };
            cls[level] = { ...cls[level], [grade]: count };
            return { ...prev, classrooms: cls };
        });
    };

    // --- Time Slot Handlers ---
    const handleAddTimeSlot = (level: string, type: "course" | "recreation" | "end") => {
        const slotsForLevel: TimeSlot[] = (timeSlots[level] as TimeSlot[]) || [];
        const isFirstSlot = slotsForLevel.length === 0;

        const startTime = isFirstSlot ? normalizeTime(newTimeSlotInput[level].start) : timeSlotStartTimes[level];
        const endTime = type !== "end" ? normalizeTime(newTimeSlotInput[level].end) : "";

        if (type !== "end") {
            if (!startTime || !endTime) return;
            if (startTime >= endTime) return;
        }

        if (slotsForLevel.some((s) => s.type === "end")) return;

        const value = type !== "end" ? `${startTime}-${endTime}` : "FIN DES COURS";

        setData((prev) => {
            if (!prev) return null;
            const existing: TimeSlot[] = ((prev.timeSlots as Record<string, TimeSlot[]>)[level]) || [];

            let label = "";
            if (type === "course") {
                const courseCount = existing.filter((s) => s.type === "course").length;
                label = `${courseCount + 1}e H`;
            } else if (type === "recreation") {
                const breakCount = existing.filter((s) => s.type === "recreation").length;
                label = `REC${breakCount + 1}`;
            } else {
                label = "Fin";
            }

            const newSlot: TimeSlot = { id: `slot_${Date.now()}`, type, label, value };
            const updatedSlots = [...existing, newSlot];

            return {
                ...prev,
                timeSlots: { ...(prev.timeSlots as Record<string, unknown>), [level]: updatedSlots },
            };
        });

        setNewTimeSlotInput((prev) => ({ ...prev, [level]: { start: "", end: "" } }));
    };

    const handleRemoveTimeSlot = (level: string, slotId: string) => {
        setData((prev) => {
            if (!prev) return null;
            const existing: TimeSlot[] = ((prev.timeSlots as Record<string, TimeSlot[]>)[level]) || [];
            const idx = existing.findIndex((s) => s.id === slotId);
            if (idx === -1 || idx !== existing.length - 1) return prev; // Only last

            return {
                ...prev,
                timeSlots: { ...(prev.timeSlots as Record<string, unknown>), [level]: existing.filter((s) => s.id !== slotId) },
            };
        });
    };

    // --- Course Handlers ---
    const handleAddCourse = (classroomName: string) => {
        const input = courseInputs[classroomName]?.trim();
        if (!input) return;

        // Support new format: 'CourseName|Max;Other|20;SimpleCourse'
        const inputs = input.split(";").map((s) => s.trim()).filter(Boolean);
        if (!inputs.length) return;

        const existing = courses[classroomName] || [];
        const newCourses: Course[] = [];

        for (const token of inputs) {
            // Each token can be 'Name' or 'Name|Max'
            const parts = token.split("|").map(p => p.trim()).filter(Boolean);
            if (parts.length === 0) continue;

            const partName = parts[0];
            const parsedMax = parts[1] && !isNaN(Number(parts[1])) ? Number(parts[1]) : 10;

            const alreadyExists = existing.some(
                (c) => (typeof c === "string" ? c : c.name).toLowerCase() === partName.toLowerCase()
            );

            if (!alreadyExists) {
                newCourses.push({ name: partName, max: parsedMax });
            }
        }

        if (newCourses.length > 0) {
            setData((prev) => {
                if (!prev) return null;
                const c = { ...(prev.courses as Record<string, unknown[]>) };
                c[classroomName] = [...(c[classroomName] || []), ...newCourses];
                return { ...prev, courses: c };
            });
        }

        setCourseInputs((prev) => ({ ...prev, [classroomName]: "" }));
    };

    const handleRemoveCourse = (classroomName: string, courseName: string) => {
        setData((prev) => {
            if (!prev) return null;
            const c = { ...(prev.courses as Record<string, (string | Course)[]>) };
            c[classroomName] = (c[classroomName] || []).filter(
                (course) => (typeof course === "string" ? course : course.name) !== courseName
            );
            return { ...prev, courses: c };
        });
    };

    const handleStartEditCourse = (classroomName: string, index: number, course: string | Course) => {
        const name = typeof course === "string" ? course : course.name;
        const max = typeof course === "string" ? 10 : course.max;
        setEditingCourse({ classroom: classroomName, index, name, max });
    };

    const handleSaveEditCourse = () => {
        if (!editingCourse) return;
        const { classroom, index, name, max } = editingCourse;

        setData((prev) => {
            if (!prev) return null;
            const c = { ...(prev.courses as Record<string, unknown[]>) };
            const updated = [...(c[classroom] || [])];
            updated[index] = { name, max };
            c[classroom] = updated;
            return { ...prev, courses: c };
        });
        setEditingCourse(null);
    };

    const handleLoadOfficialCourses = async (classroomName: string, level: string) => {
        setLoadingOfficial(classroomName);
        let fileName = level;

        if (level === "primaire") {
            if (classroomName.includes("1e Primaire")) fileName = "1ere_primaire";
            else if (classroomName.includes("2e Primaire")) fileName = "2eme_primaire";
            else if (classroomName.includes("3e Primaire")) fileName = "3eme_primaire";
            else if (classroomName.includes("4e Primaire")) fileName = "4eme_primaire";
            else if (classroomName.includes("5e Primaire")) fileName = "5eme_primaire";
            else if (classroomName.includes("6e Primaire")) fileName = "6eme_primaire";
            else if (classroomName.includes("6e Spécial")) fileName = "6eme_special";
        } else if (level === "secondaire") {
            if (classroomName.includes("7e CTEB")) fileName = "7eme_cteb";
            else if (classroomName.includes("8e CTEB")) fileName = "8eme_cteb";
        }

        const result = await getOfficialCourses(fileName);
        if (result.success && result.data) {
            const officialBranches = (result.data as Record<string, unknown[]>).branches || [];
            const newCourses = officialBranches.map((b: unknown) => {
                const branch = b as Record<string, unknown>;
                return {
                    name: branch.nom as string,
                    max: (branch.max as number) || 10,
                    domaine: branch.domaine as string,
                    sousDomaine: branch.sousDomaine as string,
                };
            });

            setData((prev) => {
                if (!prev) return null;
                const c = { ...(prev.courses as Record<string, unknown[]>) };
                c[classroomName] = newCourses;
                return { ...prev, courses: c };
            });
        }
        setLoadingOfficial(null);
    };

    const handleImportCourses = (target: string, source: string) => {
        if (!source || !data) return;
        setData((prev) => {
            if (!prev) return null;
            const c = { ...(prev.courses as Record<string, unknown[]>) };
            c[target] = [...(c[source] || [])];
            return { ...prev, courses: c };
        });
    };

    const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>, classroomName: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const content = evt.target?.result as string;
                const parsed = JSON.parse(content);
                const branches = parsed.branches || [];
                const newCourses = branches.map((b: Record<string, unknown>) => ({
                    name: b.nom as string,
                    max: (b.max as number) || 10,
                    domaine: b.domaine as string,
                    sousDomaine: b.sousDomaine as string,
                }));

                setData((prev) => {
                    if (!prev) return null;
                    const c = { ...(prev.courses as Record<string, unknown[]>) };
                    c[classroomName] = newCourses;
                    return { ...prev, courses: c };
                });
            } catch {
                // Invalid JSON
            }
        };
        reader.readAsText(file);
    };

    const getPotentialImportSources = (level: string, currentClassroomLong: string): string[] => {
        if (!data) return [];
        const levelClassrooms = classrooms[level] || {};

        for (const gn of Object.keys(levelClassrooms)) {
            const names = generateClassroomNames(level, gn);
            if (names.some((c) => c.long === currentClassroomLong)) {
                return names
                    .filter((c) => c.long !== currentClassroomLong && courses[c.long]?.length > 0)
                    .map((c) => c.long);
            }
        }
        return [];
    };

    // --- Save Handler ---
    const { user } = useSchoolData();
    const executorName = user?.name || "Administrateur";

    const handleSave = async () => {
        if (!data) return;
        setIsSaving(true);

        let logoDataUrl = data.logo as string;
        if (logoFile) {
            logoDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(logoFile);
            });
        }

        const result = await saveSchoolSetupData(
            (data.matricule as string) || (initialData?.matricule as string),
            {
                name: (data.name as string) || "",
                address: (data.address as string) || undefined,
                city: (data.city as string) || undefined,
                province: (data.province as string) || undefined,
                phone: (data.phone as string) || undefined,
                logo: logoDataUrl || undefined,
                levels: data.levels as Record<string, boolean>,
                classrooms: data.classrooms as Record<string, Record<string, number>>,
                courses: data.courses as Record<string, unknown[]>,
                timeSlots: data.timeSlots as Record<string, unknown>,
                postCTEB: data.postCTEB as boolean,
                configuredOptions: data.configuredOptions as unknown[],
                qualitativeMentions: data.qualitativeMentions as Record<string, any>,
                finalDecisions: data.finalDecisions as Record<string, string[]>,
                uiSettings: (data.configuration as any)?.uiSettings,
            },
            executorName
        );

        if (result.success) {
            refreshData();
        }

        setIsSaving(false);
    };

    // --- Loading ---
    if (isLoading || !data) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-between"
            >
                <div>
                    <Link href="/settings">
                        <Button variant="ghost" size="sm" className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux Paramètres
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">Configuration de l&apos;École</h1>
                    <p className="text-muted-foreground mt-1">
                        Mettez à jour les informations générales et la structure académique.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2 rounded-xl">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                </Button>
            </motion.div>

            {/* ============================================================= */}
            {/* SECTION 1: IDENTITÉ */}
            {/* ============================================================= */}
            <CollapsibleSection id="identity" icon={Building} title="Identité de l'école" description="Nom, adresse, logo et coordonnées" isOpen={expandedSections.has("identity")} onToggle={toggleSection}>
                <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Nom de l&apos;école</Label>
                            <Input value={(data.name as string) || ""} onChange={(e) => handleInputChange("name", e.target.value)} placeholder="Complexe Scolaire La Réussite" />
                        </div>
                        <div className="space-y-2">
                            <Label>Province</Label>
                            <Input value={(data.province as string) || ""} onChange={(e) => handleInputChange("province", e.target.value)} placeholder="Haut-Katanga" />
                        </div>
                        <div className="space-y-2">
                            <Label>Ville / Territoire</Label>
                            <Input value={(data.city as string) || ""} onChange={(e) => handleInputChange("city", e.target.value)} placeholder="Lubumbashi" />
                        </div>
                        <div className="space-y-2">
                            <Label>Adresse</Label>
                            <Input value={(data.address as string) || ""} onChange={(e) => handleInputChange("address", e.target.value)} placeholder="Avenue, numéro, quartier" />
                        </div>
                        <div className="space-y-2">
                            <Label>Téléphone</Label>
                            <Input value={(data.phone as string) || ""} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+243 ..." />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Logo de l&apos;école</Label>
                        <Input type="file" onChange={handleFileChange} className="file:text-primary file:font-semibold" accept="image/png, image/jpeg, image/gif" />
                        {(data.logo as string) && (
                            <div className="mt-2">
                                <Image src={data.logo as string} alt="Logo actuel" width={100} height={100} className="rounded-lg border h-auto" />
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleSection>

            {/* ============================================================= */}
            {/* SECTION 1.5: APPARENCE & UI */}
            {/* ============================================================= */}
            <CollapsibleSection id="appearance" icon={Settings2} title="Apparence & Interface" description="Personnalisation visuelle (cadre photo, etc.)" isOpen={expandedSections.has("appearance")} onToggle={toggleSection}>
                <div className="space-y-4 mt-4">
                    <div className="space-y-2 max-w-sm">
                        <Label>Forme des photos de profil (Avatars)</Label>
                        <select
                            value={((data.configuration as any)?.uiSettings?.photoFrame) || "round"}
                            onChange={(e) => {
                                setData(prev => {
                                    if (!prev) return null;
                                    return {
                                        ...prev,
                                        configuration: {
                                            ...(prev.configuration as any),
                                            uiSettings: {
                                                ...((prev.configuration as any)?.uiSettings || {}),
                                                photoFrame: e.target.value
                                            }
                                        }
                                    };
                                });
                            }}
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="round">Rond (Par défaut)</option>
                            <option value="square">Carré (Bords arrondis)</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">S'applique aux photos des élèves et du personnel.</p>
                    </div>
                </div>
            </CollapsibleSection>

            {/* ============================================================= */}
            {/* SECTION 2: STRUCTURE ACADÉMIQUE */}
            {/* ============================================================= */}
            <CollapsibleSection id="structure" icon={School} title="Structure Académique" description="Niveaux d'enseignement, locaux et salles de classe" isOpen={expandedSections.has("structure")} onToggle={toggleSection}>
                <div className="space-y-6 mt-4">
                    {/* Levels */}
                    <div className="space-y-2">
                        <Label className="text-base font-semibold">Niveaux d&apos;enseignement gérés</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {["maternelle", "primaire", "secondaire"].map((level) => (
                                <button
                                    key={level}
                                    onClick={() => handleLevelToggle(level)}
                                    className={`p-4 border rounded-xl flex items-center gap-3 transition-all text-left
                                        ${levels[level]
                                            ? "border-primary/30 bg-primary/5 shadow-sm"
                                            : "border-border hover:border-primary/20"
                                        }`}
                                >
                                    <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors
                                        ${levels[level] ? "bg-primary border-primary text-white" : "border-muted-foreground/30"}`}>
                                        {levels[level] && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                    </div>
                                    <span className="capitalize font-semibold">{level}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* === Post CTEB Toggle (only when Secondaire is active) === */}
                    {levels.secondaire && (
                        <div className="p-5 bg-muted/30 rounded-xl border-2 border-dashed border-muted-foreground/20">
                            <button
                                onClick={() => setData(prev => prev ? { ...prev, postCTEB: !(prev.postCTEB as boolean) } : null)}
                                className="flex items-center gap-3 w-full text-left"
                            >
                                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors
                                    ${(data.postCTEB as boolean) ? "bg-primary border-primary text-white" : "border-muted-foreground/30"}`}>
                                    {(data.postCTEB as boolean) && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                </div>
                                <span className="text-base font-semibold">Post CTEB (Humanités & Professionnel)</span>
                            </button>

                            {(data.postCTEB as boolean) && (
                                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-primary text-sm">Sections configurées</h3>
                                        <Button
                                            onClick={() => setShowSectionModal(true)}
                                            size="sm"
                                            className="gap-2 rounded-xl"
                                        >
                                            <Settings2 className="w-4 h-4" /> Configurer les sections
                                        </Button>
                                    </div>

                                    {((data.configuredOptions as ConfiguredOption[]) || []).length === 0 ? (
                                        <p className="text-sm text-center py-4 text-muted-foreground bg-background/50 rounded-lg border border-dashed">
                                            Aucune section configurée. Cliquez sur &quot;Configurer les sections&quot; pour commencer.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {((data.configuredOptions as ConfiguredOption[]) || []).map((opt) => (
                                                <Badge key={opt.id} variant="secondary" className="pl-3 pr-1 py-1 gap-2 border-primary/20">
                                                    {opt.optionName} ({opt.sectionName})
                                                    <button
                                                        onClick={() => setData(prev => {
                                                            if (!prev) return null;
                                                            return {
                                                                ...prev,
                                                                configuredOptions: ((prev.configuredOptions as ConfiguredOption[]) || []).filter(o => o.id !== opt.id)
                                                            };
                                                        })}
                                                        className="p-0.5 hover:bg-destructive/20 rounded-full text-destructive"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Classroom counts per level */}
                    {(["maternelle", "primaire", "secondaire"] as const).map((level) => {
                        if (!levels[level]) return null;
                        const levelClassrooms = classrooms[level] || {};
                        const grades = Object.entries(levelClassrooms).filter(([name]) => name !== "classrooms");
                        // For secondaire: only show CTEB grades (humanité/professionnelle managed via Post CTEB)
                        const filteredGrades = level === "secondaire"
                            ? grades.filter(([name]) =>
                                name.includes("CTEB") &&
                                !name.toLowerCase().includes("humanité") &&
                                !name.toLowerCase().includes("professionnelle")
                            )
                            : grades;

                        return (
                            <div key={level} className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <h3 className="font-bold capitalize text-base">{level}</h3>
                                    <Badge variant="outline" className="text-xs">{filteredGrades.reduce((acc, [, v]) => acc + v, 0)} locaux</Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pl-4">
                                    {filteredGrades.map(([grade, count]) => (
                                        <div key={`${level}-${grade}`} className="space-y-1">
                                            <Label className="text-xs font-medium">{grade}</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={count}
                                                onChange={(e) => handleClassroomCountChange(level, grade, e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* === Post CTEB Classroom Configuration === */}
                    {(data.postCTEB as boolean) && ((data.configuredOptions as ConfiguredOption[]) || []).length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <h3 className="font-bold text-base">POST CTEB — Humanités & Professionnelles</h3>
                            </div>
                            {((data.configuredOptions as ConfiguredOption[]) || []).map((option: ConfiguredOption) => (
                                <div key={option.id} className="space-y-3 p-4 border rounded-xl bg-muted/10">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold text-sm uppercase">{option.optionName}</h4>
                                        <Badge variant="outline" className="text-[10px] uppercase">{option.sectionName}</Badge>
                                        <Badge variant={option.type === 'humanite' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                                            {option.type === 'humanite' ? 'Humanités' : 'Professionnel'}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {option.classes.map((cls, clsIdx) => (
                                            <div key={`${option.id}-${cls.id || clsIdx}`} className="space-y-1">
                                                <Label className="text-xs">
                                                    <div className="font-semibold uppercase">{cls.grade}</div>
                                                    <div className="text-[10px] text-muted-foreground">Nb. locaux</div>
                                                </Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={cls.classrooms}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value, 10);
                                                        if (isNaN(value) || value < 1) return;
                                                        setData(prev => {
                                                            if (!prev) return null;
                                                            const updatedOptions = ((prev.configuredOptions as ConfiguredOption[]) || []).map(opt => {
                                                                if (opt.id === option.id) {
                                                                    return {
                                                                        ...opt,
                                                                        classes: opt.classes.map((c, idx) =>
                                                                            (c.id === cls.id || (idx === clsIdx && !c.id))
                                                                                ? { ...c, classrooms: value }
                                                                                : c
                                                                        )
                                                                    };
                                                                }
                                                                return opt;
                                                            });
                                                            // Re-assign codes
                                                            const assignments = assignPostCTEBCodes(updatedOptions);
                                                            const optionsWithCodes = updatedOptions.map(opt => ({
                                                                ...opt,
                                                                classes: opt.classes.map(c => ({
                                                                    ...c,
                                                                    assignedCodes: Array.from(assignments.get(c.id) || [])
                                                                }))
                                                            }));
                                                            return { ...prev, configuredOptions: optionsWithCodes };
                                                        });
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                        </div>
                    )}

                    {/* Unified Nomenclature Preview */}
                    {(() => {
                        const getUnifiedNomenclaturePreview = () => {
                            const list: {
                                level: string;
                                classes: { code: string; fullName: string; subtitle?: string }[];
                            }[] = [];

                            // 1. Maternelle
                            if (levels.maternelle) {
                                const matClasses: { code: string; fullName: string; subtitle?: string }[] = [];
                                const levelClassrooms = classrooms.maternelle || {};
                                const entries = Object.entries(levelClassrooms).filter(([name]) => name !== "classrooms");
                                entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

                                entries.forEach(([gradeName, count]) => {
                                    if (count <= 0) return;
                                    const names = generateClassroomNames("maternelle", gradeName);
                                    names.forEach(n => {
                                        matClasses.push({ code: n.short, fullName: n.long, subtitle: "Maternelle" });
                                    });
                                });
                                if (matClasses.length > 0) {
                                    list.push({ level: "Maternelle", classes: matClasses });
                                }
                            }

                            // 2. Primaire
                            if (levels.primaire) {
                                const primClasses: { code: string; fullName: string; subtitle?: string }[] = [];
                                const levelClassrooms = classrooms.primaire || {};
                                const entries = Object.entries(levelClassrooms).filter(([name]) => name !== "classrooms");
                                entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

                                entries.forEach(([gradeName, count]) => {
                                    if (count <= 0) return;
                                    const names = generateClassroomNames("primaire", gradeName);
                                    names.forEach(n => {
                                        primClasses.push({ code: n.short, fullName: n.long, subtitle: "Primaire" });
                                    });
                                });
                                if (primClasses.length > 0) {
                                    list.push({ level: "Primaire", classes: primClasses });
                                }
                            }

                            // 3. Secondaire
                            if (levels.secondaire) {
                                const secClasses: { code: string; fullName: string; subtitle?: string }[] = [];

                                // Standard CTEB secondary classrooms
                                const levelClassrooms = classrooms.secondaire || {};
                                const entries = Object.entries(levelClassrooms).filter(([gradeName]) => {
                                    if (gradeName === "classrooms") return false;
                                    if (data?.postCTEB) {
                                        return gradeName.includes("CTEB");
                                    }
                                    return true;
                                });
                                entries.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

                                entries.forEach(([gradeName, count]) => {
                                    if (count <= 0) return;
                                    const names = generateClassroomNames("secondaire", gradeName);
                                    names.forEach(n => {
                                        secClasses.push({ code: n.short, fullName: n.long, subtitle: "Tronc Commun (CTEB)" });
                                    });
                                });

                                // Post-CTEB secondary classrooms
                                if (data?.postCTEB) {
                                    const preview = generateNomenclaturePreview((data.configuredOptions as ConfiguredOption[]) || []);
                                    preview.forEach(p => {
                                        p.classes.forEach(cls => {
                                            secClasses.push({
                                                code: cls.code,
                                                fullName: cls.fullName,
                                                subtitle: cls.optionName.toUpperCase()
                                            });
                                        });
                                    });
                                }

                                if (secClasses.length > 0) {
                                    list.push({ level: "Secondaire", classes: secClasses });
                                }
                            }

                            return list;
                        };

                        const preview = getUnifiedNomenclaturePreview();
                        if (preview.length === 0) return null;
                        return (
                            <div className="p-5 bg-muted/20 rounded-xl border mt-6 w-full">
                                <h4 className="font-bold text-sm uppercase mb-1">Aperçu de la Nomenclature</h4>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Voici comment vos classes et leurs codes seront nommés et affichés dans l&apos;application pour chaque niveau configuré.
                                </p>
                                <div className="space-y-4">
                                    {preview.map((p) => (
                                        <div key={p.level} className="bg-background rounded-xl border overflow-hidden">
                                            <div className="px-4 py-2 bg-muted/50 border-b flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{p.level}</span>
                                                <Badge variant="outline" className="text-[9px]">{p.classes.length} locaux</Badge>
                                            </div>
                                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {p.classes.map(cls => (
                                                    <div key={`${p.level}-${cls.code}-${cls.fullName}`} className="flex items-center gap-3 p-2 bg-muted/20 rounded-lg border">
                                                        <div className="w-9 h-9 flex items-center justify-center bg-primary/10 text-primary font-bold rounded-lg text-xs shrink-0 font-mono">
                                                            {cls.code}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[11px] font-black truncate">{cls.fullName}</div>
                                                            {cls.subtitle && (
                                                                <div className="text-[9px] text-muted-foreground truncate uppercase font-medium">{cls.subtitle}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </CollapsibleSection>

            {/* ============================================================= */}
            {/* SECTION 2.5: MENTIONS QUALITATIVES ET CONDUITE */}
            {/* ============================================================= */}
            <CollapsibleSection id="mentions" icon={Settings2} title="Mentions Qualitatives & Conduite" description="Configurez les plages de mentions pour l'Application et la Conduite" isOpen={expandedSections.has("mentions")} onToggle={toggleSection}>
                <div className="space-y-8 mt-4">
                    {(["maternelle", "primaire", "secondaire"] as const).map((level) => {
                        if (!levels[level]) return null;

                        // Normalize config for this level
                        const rawConfig = (data.qualitativeMentions as Record<string, any>)?.[level];
                        const isLegacyArray = Array.isArray(rawConfig);
                        const legacyMentions = isLegacyArray ? rawConfig : ["E", "TB", "B", "ME", "MA"];
                        
                        const config: LevelMentionsConfig = !isLegacyArray && rawConfig ? rawConfig : {
                            applicationMentions: legacyMentions.map((m, i) => ({ name: m, min: 100 - (i * 20), max: 100 - (i * 20) + 19 })),
                            conductMode: "COTATION",
                            conductMaxScore: 20,
                            conductMentions: legacyMentions.map((m, i) => ({ name: m, min: 20 - (i * 4), max: 20 - (i * 4) + 3, weight: 20 - (i * 4) }))
                        };

                        const updateLevelConfig = (updater: (prev: LevelMentionsConfig) => LevelMentionsConfig) => {
                            setData(prev => {
                                if (!prev) return null;
                                const qm = { ...(prev.qualitativeMentions as Record<string, any>) };
                                qm[level] = updater(config);
                                return { ...prev, qualitativeMentions: qm };
                            });
                        };

                        return (
                            <div key={level} className="space-y-6 p-5 border rounded-xl bg-muted/5">
                                <div className="flex items-center gap-2 border-b pb-3">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <h3 className="font-bold capitalize text-lg text-primary">{level}</h3>
                                </div>

                                {/* Application */}
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-sm">Application (Basée sur le % Académique)</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {config.applicationMentions.map((m, idx) => (
                                            <div key={idx} className="flex items-center gap-2 bg-background p-2 rounded-lg border shadow-sm">
                                                <Input 
                                                    value={m.name} 
                                                    onChange={(e) => updateLevelConfig(c => { const n = [...c.applicationMentions]; n[idx].name = e.target.value.toUpperCase(); return { ...c, applicationMentions: n }; })}
                                                    className="w-16 h-8 font-bold text-center"
                                                    placeholder="Nom"
                                                />
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Input type="number" value={m.min} onChange={(e) => updateLevelConfig(c => { const n = [...c.applicationMentions]; n[idx].min = Number(e.target.value); return { ...c, applicationMentions: n }; })} className="w-14 h-8 px-1" />
                                                    % -
                                                    <Input type="number" value={m.max} onChange={(e) => updateLevelConfig(c => { const n = [...c.applicationMentions]; n[idx].max = Number(e.target.value); return { ...c, applicationMentions: n }; })} className="w-14 h-8 px-1" />
                                                    %
                                                </div>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => updateLevelConfig(c => ({ ...c, applicationMentions: c.applicationMentions.filter((_, i) => i !== idx) }))}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="h-auto border-dashed flex items-center justify-center gap-2" onClick={() => updateLevelConfig(c => ({ ...c, applicationMentions: [...c.applicationMentions, { name: "N", min: 0, max: 0 }] }))}>
                                            <PlusCircle className="h-4 w-4" /> Ajouter
                                        </Button>
                                    </div>
                                </div>

                                {/* Conduite */}
                                <div className="space-y-4 pt-4 border-t border-dashed">
                                    <div className="flex flex-wrap justify-between items-center gap-4">
                                        <h4 className="font-semibold text-sm">Conduite Disciplinaire</h4>
                                        <div className="flex items-center gap-4 bg-muted/20 p-2 rounded-lg border">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">Mode:</Label>
                                                <select 
                                                    className="h-8 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                                                    value={config.conductMode}
                                                    onChange={(e) => updateLevelConfig(c => ({ ...c, conductMode: e.target.value as "COTATION" | "MENTION" }))}
                                                >
                                                    <option value="COTATION">Cotation (Saisie de points)</option>
                                                    <option value="MENTION">Mention (Sélection manuelle)</option>
                                                </select>
                                            </div>
                                            {config.conductMode === "COTATION" && (
                                                <div className="flex items-center gap-2 border-l pl-4">
                                                    <Label className="text-xs">Max:</Label>
                                                    <Input type="number" className="w-16 h-8 text-xs" value={config.conductMaxScore} onChange={(e) => updateLevelConfig(c => ({ ...c, conductMaxScore: Number(e.target.value) }))} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {config.conductMentions.map((m, idx) => (
                                            <div key={idx} className="flex flex-col gap-2 bg-background p-3 rounded-lg border shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <Input 
                                                        value={m.name} 
                                                        onChange={(e) => updateLevelConfig(c => { const n = [...c.conductMentions]; n[idx].name = e.target.value.toUpperCase(); return { ...c, conductMentions: n }; })}
                                                        className="w-16 h-8 font-bold text-center"
                                                    />
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10" onClick={() => updateLevelConfig(c => ({ ...c, conductMentions: c.conductMentions.filter((_, i) => i !== idx) }))}>
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                {config.conductMode === "COTATION" ? (
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                                        <span>Plage:</span>
                                                        <div className="flex items-center gap-1">
                                                            <Input type="number" value={m.min} onChange={(e) => updateLevelConfig(c => { const n = [...c.conductMentions]; n[idx].min = Number(e.target.value); return { ...c, conductMentions: n }; })} className="w-14 h-7 px-1 text-xs" />
                                                            à
                                                            <Input type="number" value={m.max} onChange={(e) => updateLevelConfig(c => { const n = [...c.conductMentions]; n[idx].max = Number(e.target.value); return { ...c, conductMentions: n }; })} className="w-14 h-7 px-1 text-xs" />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                                        <span>Poids (pour la moyenne finale):</span>
                                                        <Input type="number" value={m.weight || 0} onChange={(e) => updateLevelConfig(c => { const n = [...c.conductMentions]; n[idx].weight = Number(e.target.value); return { ...c, conductMentions: n }; })} className="w-16 h-7 px-1 text-xs text-center font-mono" />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        <Button variant="outline" className="h-auto border-dashed flex flex-col items-center justify-center gap-2 py-4" onClick={() => updateLevelConfig(c => ({ ...c, conductMentions: [...c.conductMentions, { name: "N", min: 0, max: 0, weight: 0 }] }))}>
                                            <PlusCircle className="h-5 w-5 text-muted-foreground" /> 
                                            <span className="text-xs">Ajouter une mention</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleSection>

            {/* ============================================================= */}
            {/* SECTION 2.6: DÉCISIONS FINALES */}
            {/* ============================================================= */}
            <CollapsibleSection id="decisions" icon={Settings2} title="Décisions de Fin d'Année" description="Configurez les décisions possibles lors de la délibération finale" isOpen={expandedSections.has("decisions")} onToggle={toggleSection}>
                <div className="space-y-6 mt-4">
                    {(["primaire", "secondaire"] as const).map((level) => {
                        if (!levels[level]) return null;
                        
                        const decisions: string[] = ((data.finalDecisions as Record<string, string[]>)?.[level]) || [
                            "Passe en classe supérieure",
                            "Double de classe"
                        ];

                        return (
                            <div key={level} className="space-y-3 p-4 border rounded-xl bg-muted/10">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <h3 className="font-bold capitalize text-base">{level}</h3>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {decisions.map((d, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <Input 
                                                value={d}
                                                onChange={(e) => setData(prev => {
                                                    if (!prev) return null;
                                                    const fd = { ...(prev.finalDecisions as Record<string, string[]>) };
                                                    const n = [...(fd[level] || [])];
                                                    n[idx] = e.target.value;
                                                    fd[level] = n;
                                                    return { ...prev, finalDecisions: fd };
                                                })}
                                                className="flex-grow bg-background text-sm"
                                            />
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setData(prev => {
                                                if (!prev) return null;
                                                const fd = { ...(prev.finalDecisions as Record<string, string[]>) };
                                                fd[level] = fd[level].filter((_, i) => i !== idx);
                                                return { ...prev, finalDecisions: fd };
                                            })}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" className="w-fit mt-2 border-dashed" onClick={() => setData(prev => {
                                        if (!prev) return null;
                                        const fd = { ...(prev.finalDecisions as Record<string, string[]>) };
                                        fd[level] = [...(fd[level] || []), "Nouvelle décision"];
                                        return { ...prev, finalDecisions: fd };
                                    })}>
                                        <PlusCircle className="h-4 w-4 mr-2" /> Ajouter une décision
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleSection>


            {/* ============================================================= */}
            {/* SECTION 3: TRANCHES HORAIRES */}
            {/* ============================================================= */}
            <CollapsibleSection id="timeslots" icon={Clock} title="Tranches Horaires" description="Définissez les heures de cours et récréations par niveau" isOpen={expandedSections.has("timeslots")} onToggle={toggleSection}>
                <div className="space-y-6 mt-4">
                    {(["maternelle", "primaire", "secondaire"] as const).map((level) => {
                        if (!levels[level]) return null;
                        const slotsForLevel: TimeSlot[] = (timeSlots[level] as TimeSlot[]) || [];
                        const isDayFinished = slotsForLevel.some((s) => s.type === "end");
                        const isFirstSlot = slotsForLevel.length === 0;
                        const startTime = timeSlotStartTimes[level];

                        return (
                            <div key={level} className="space-y-3 p-4 bg-muted/20 rounded-xl border">
                                <h3 className="font-bold capitalize text-base flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    {level}
                                </h3>

                                {/* Time inputs */}
                                <div className="flex flex-col sm:flex-row items-center gap-2">
                                    <div className="flex flex-grow items-center gap-2">
                                        {isFirstSlot ? (
                                            <>
                                                <Input
                                                    placeholder="Début HH:MM"
                                                    value={newTimeSlotInput[level].start}
                                                    onChange={(e) => setNewTimeSlotInput((p) => ({ ...p, [level]: { ...p[level], start: e.target.value } }))}
                                                    className="w-32"
                                                    disabled={isDayFinished}
                                                />
                                                <span className="text-muted-foreground">→</span>
                                                <Input
                                                    placeholder="Fin HH:MM"
                                                    value={newTimeSlotInput[level].end}
                                                    onChange={(e) => setNewTimeSlotInput((p) => ({ ...p, [level]: { ...p[level], end: e.target.value } }))}
                                                    className="w-32"
                                                    disabled={isDayFinished}
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <Badge variant="outline" className="text-base py-1.5 px-3">{startTime}</Badge>
                                                <span className="text-muted-foreground">→</span>
                                                <Input
                                                    placeholder="Fin HH:MM"
                                                    value={newTimeSlotInput[level].end}
                                                    onChange={(e) => setNewTimeSlotInput((p) => ({ ...p, [level]: { ...p[level], end: e.target.value } }))}
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddTimeSlot(level, "course")}
                                                    className="w-32"
                                                    disabled={isDayFinished}
                                                />
                                            </>
                                        )}
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button size="sm" onClick={() => handleAddTimeSlot(level, "course")} className="flex-grow" disabled={isDayFinished}>
                                            <PlusCircle className="mr-1 h-4 w-4" /> Heure
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleAddTimeSlot(level, "recreation")} className="flex-grow" disabled={isDayFinished}>
                                            <Coffee className="mr-1 h-4 w-4" /> Récré
                                        </Button>
                                    </div>
                                </div>

                                {/* Existing slots */}
                                <div className="flex flex-wrap gap-2">
                                    {slotsForLevel.length > 0 ? slotsForLevel.map((slot) => (
                                        <Badge
                                            key={slot.id}
                                            variant={slot.type === "course" ? "secondary" : slot.type === "end" ? "destructive" : "default"}
                                            className="text-sm py-1.5 pl-3 pr-1"
                                        >
                                            <span className="font-bold mr-2">{slot.label}:</span>
                                            {slot.value}
                                            <button onClick={() => handleRemoveTimeSlot(level, slot.id)} className="ml-2 rounded-full hover:bg-destructive/20 p-0.5">
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )) : (
                                        <p className="text-xs text-muted-foreground">Aucune tranche horaire définie.</p>
                                    )}
                                </div>

                                {/* End of day button */}
                                <div className="flex justify-center">
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleAddTimeSlot(level, "end")}
                                        disabled={isDayFinished || slotsForLevel.length === 0}
                                    >
                                        <StopCircle className="mr-2 h-4 w-4" /> Fin des cours
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CollapsibleSection>

            {/* ============================================================= */}
            {/* SECTION 4: LISTE DES COURS PAR CLASSE */}
            {/* ============================================================= */}
            <CollapsibleSection id="courses" icon={ClipboardList} title="Liste des cours par classe" description="Définissez et importez les cours pour chaque classe" isOpen={expandedSections.has("courses")} onToggle={toggleSection}>
                <div className="space-y-4 mt-4 max-h-[600px] overflow-y-auto pr-2">
                    {(["maternelle", "primaire", "secondaire"] as const).map((level) => {
                        if (!levels[level]) return null;
                        const levelClassrooms = classrooms[level] || {};

                        // 1. Get Standard Classes (filtering out "classrooms" key and handling Post CTEB logic)
                        const standardEntries = Object.entries(levelClassrooms).filter(([gradeName]) => {
                            if (gradeName === "classrooms") return false;
                            if (level === "secondaire" && data.postCTEB) {
                                // In Post CTEB mode, only show CTEB grades here (Humanité/Pro handled below)
                                return gradeName.includes("CTEB");
                            }
                            return true;
                        });

                        // 2. Generate list of all classrooms for this level
                        let standardClassrooms: { name: string; short: string; isPostCTEB?: boolean }[] = [];
                        let postCTEBClassrooms: { name: string; short: string; isPostCTEB?: boolean }[] = [];

                        // Add standard classes
                        standardEntries.forEach(([gradeName, count]) => {
                            if (count <= 0) return;
                            const names = generateClassroomNames(level, gradeName);
                            names.forEach(n => {
                                standardClassrooms.push({ name: n.long, short: n.short });
                            });
                        });
                        // Sort standard classes (7e, 8e...)
                        standardClassrooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                        // Add Post CTEB classes (if applicable)
                        if (level === "secondaire" && data.postCTEB) {
                            const opts = (data.configuredOptions as ConfiguredOption[]) || [];
                            const assignments = assignPostCTEBCodes(opts);

                            // Sort by grade number then sequence order
                            const sortedOpts = [...opts].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));

                            sortedOpts.forEach(opt => {
                                opt.classes.forEach(cls => {
                                    const codes = assignments.get(cls.id) || [];
                                    codes.forEach(code => {
                                        const fullName = getPostCTEBFullName(cls.grade, opt.optionName, code, cls.classrooms);
                                        postCTEBClassrooms.push({ name: fullName, short: code, isPostCTEB: true });
                                    });
                                });
                            });

                            // Sort Post CTEB classes (1ère, 2ème...)
                            postCTEBClassrooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                        }

                        const allClassrooms = [...standardClassrooms, ...postCTEBClassrooms];

                        if (allClassrooms.length === 0) return null;

                        return (
                            <div key={level} className="space-y-3">
                                <h3 className="font-bold capitalize text-base flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4 text-primary" />
                                    {level}
                                </h3>

                                {allClassrooms.map((classroom) => {
                                    const classroomName = classroom.name;
                                    // Potential import sources logic needs update for Post CTEB validity?
                                    // For now, keep as is, it uses `courses` keys.
                                    const importSources = getPotentialImportSources(level, classroomName);
                                    const classroomCourses = courses[classroomName] || [];
                                    const uniqueKey = `courses-${level}-${classroomName.replace(/[^a-zA-Z0-9]/g, "-")}`; // Sanitized key

                                    return (
                                        <div
                                            key={uniqueKey}
                                            className="p-4 border rounded-xl bg-background shadow-sm hover:border-primary/20 transition-all"
                                        >
                                            {/* Classroom header */}
                                            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                                                <div>
                                                    <h4 className="font-semibold text-primary uppercase text-sm">{classroomName}</h4>
                                                    {classroom.short && (
                                                        <p className="text-[10px] text-muted-foreground uppercase font-mono">
                                                            CODE: {classroom.short}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleLoadOfficialCourses(classroomName, level)}
                                                        disabled={loadingOfficial === classroomName}
                                                        className="h-8 text-xs"
                                                    >
                                                        {loadingOfficial === classroomName ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <><Import className="w-3 h-3 mr-1" /> Officiel</>
                                                        )}
                                                    </Button>
                                                    {importSources.map((source) => (
                                                        <Button
                                                            key={source}
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleImportCourses(classroomName, source)}
                                                            className="h-8 text-xs"
                                                        >
                                                            <Coffee className="w-3 h-3 mr-1" /> {source.split(" ").slice(0, 2).join(" ")}
                                                        </Button>
                                                    ))}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => document.getElementById(`file-${uniqueKey}`)?.click()}
                                                        className="h-8 text-xs"
                                                    >
                                                        <FileJson className="w-3 h-3 mr-1" /> JSON
                                                    </Button>
                                                    <input
                                                        id={`file-${uniqueKey}`}
                                                        type="file"
                                                        accept=".json"
                                                        className="hidden"
                                                        onChange={(e) => handleImportJsonFile(e, classroomName)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Add course input */}
                                            <div className="flex gap-2 mb-3">
                                                <Input
                                                    placeholder="Nom du cours (ex: Mathématiques; Français)"
                                                    value={courseInputs[classroomName] || ""}
                                                    onChange={(e) => setCourseInputs((p) => ({ ...p, [classroomName]: e.target.value }))}
                                                    onKeyDown={(e) => e.key === "Enter" && handleAddCourse(classroomName)}
                                                    className="text-sm"
                                                />
                                                <Button size="icon" onClick={() => handleAddCourse(classroomName)} className="shrink-0">
                                                    <PlusCircle className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* Course badges */}
                                            {classroomCourses.length === 0 ? (
                                                <p className="text-sm text-center py-2 text-muted-foreground">Aucun cours configuré.</p>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {classroomCourses.map((course, index) => {
                                                        const isEditing = editingCourse?.classroom === classroomName && editingCourse?.index === index;
                                                        const courseName = typeof course === "string" ? course : (course as Course).name;
                                                        const courseMax = typeof course === "string" ? 10 : (course as Course).max;

                                                        if (isEditing) {
                                                            return (
                                                                <div key={`${uniqueKey}-${index}-edit`} className="flex items-center gap-1 p-1 border rounded-lg bg-background shadow-sm animate-in fade-in zoom-in">
                                                                    <Input
                                                                        className="h-7 text-xs w-28"
                                                                        value={editingCourse.name}
                                                                        onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                                                        autoFocus
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        className="h-7 text-xs w-14"
                                                                        value={editingCourse.max}
                                                                        onChange={(e) => setEditingCourse({ ...editingCourse, max: Number(e.target.value) })}
                                                                    />
                                                                    <div className="flex gap-1 ml-1 px-2 border-l items-center overflow-x-auto max-w-[200px] no-scrollbar">
                                                                        {(['normal', 'exam', 'term', 'annual'] as const).map((type) => (
                                                                            <div key={type} className="flex flex-col items-center min-w-8">
                                                                                <span className="text-[8px] uppercase text-muted-foreground whitespace-nowrap">{getMaxLabel(type)}</span>
                                                                                <span className="text-[10px] font-bold text-primary">{calculateMaxPoints(editingCourse.max, type)}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={handleSaveEditCourse}>
                                                                        <Save className="w-3 h-3" />
                                                                    </Button>
                                                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCourse(null)}>
                                                                        <X className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <Badge
                                                                key={`${uniqueKey}-${index}`}
                                                                variant="secondary"
                                                                className="text-xs py-1 pl-2.5 pr-1 flex items-center gap-1 group transition-all hover:bg-muted-foreground/10"
                                                            >
                                                                <span className="font-medium">{courseName}</span>
                                                                <span className="text-[9px] bg-background/50 px-1 py-0.5 rounded border border-foreground/10 font-mono">
                                                                    ({courseMax})
                                                                </span>
                                                                <div className="flex items-center border-l ml-0.5 pl-0.5 gap-0.5 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handleStartEditCourse(classroomName, index, course)} className="p-0.5 rounded-sm hover:bg-primary/20 text-primary">
                                                                        <Pencil className="w-2.5 h-2.5" />
                                                                    </button>
                                                                    <button onClick={() => handleRemoveCourse(classroomName, courseName)} className="p-0.5 rounded-sm hover:bg-destructive/20 text-destructive">
                                                                        <Trash2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </CollapsibleSection>

            {/* Section Config Modal */}
            <SectionConfigModal
                isOpen={showSectionModal}
                onClose={() => setShowSectionModal(false)}
                existingOptions={(data.configuredOptions as ConfiguredOption[]) || []}
                onSave={(opts) => {
                    // Auto-assign codes on save
                    const assignments = assignPostCTEBCodes(opts);
                    const optionsWithCodes = opts.map(opt => ({
                        ...opt,
                        classes: opt.classes.map(c => ({
                            ...c,
                            assignedCodes: Array.from(assignments.get(c.id) || [])
                        }))
                    }));
                    setData(prev => prev ? { ...prev, configuredOptions: optionsWithCodes } : null);
                }}
            />
        </div>
    );
}
