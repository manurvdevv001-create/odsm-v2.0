"use client";

import { useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Loader2, User, Users, School, ArrowRightLeft, AlertTriangle, UserCog, GraduationCap, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getClassroomsByLevel, classroomNamesMatch, getCourseDBKeyMap } from "@/lib/classroom-utils";
import { assignPostCTEBCodes, getPostCTEBFullName } from "@/lib/post-cteb-nomenclature";
import { getTeacherShortName, getTeacherFullName } from "@/lib/utils";
import { STAFF_CATEGORIES } from "@/lib/staff-definitions";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffProfile, Student, AcademicLevel } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

export default function ClassroomsPage() {
    const { schoolData, isLoading, user, refreshData } = useSchoolData();
    const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>("secondaire");
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmWarnings, setConfirmWarnings] = useState<{ replacement?: string; notTeaching?: boolean }>({});

    const levels: { key: AcademicLevel; label: string; icon: any; color: string; bgColor: string }[] = [
        { key: "maternelle", label: "Maternelle", icon: School, color: "text-pink-500", bgColor: "bg-pink-500/10" },
        { key: "primaire", label: "Primaire", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500/10" },
        { key: "secondaire", label: "Secondaire", icon: GraduationCap, color: "text-violet-500", bgColor: "bg-violet-500/10" },
    ];

    const typedSchoolData = schoolData as any;

    const getClassCode = (name: string) => {
        if (!name) return "";

        // 1. Check if it's Post-CTEB in the school configuration
        const config = schoolData?.configuration as any;
        if (config?.postCTEB && config?.configuredOptions) {
            const assignments = assignPostCTEBCodes(config.configuredOptions);
            for (const opt of config.configuredOptions) {
                for (const cls of opt.classes || []) {
                    const codes = assignments.get(cls.id) || [];
                    for (const code of codes) {
                        const fullName = getPostCTEBFullName(cls.grade, opt.optionName, code, cls.classrooms);
                        if (classroomNamesMatch(fullName, name)) {
                            return code;
                        }
                    }
                }
            }
        }

        // 2. Otherwise handle standard classes (Maternelle, Primaire, Secondaire CTEB)
        const nameLower = name.toLowerCase();
        const numMatch = name.match(/\d+/);
        const num = numMatch ? numMatch[0] : "";

        // Extract trailing section letter if present, e.g. "7e CTEB A" -> "A", "1e Primaire B" -> "B"
        const sectionMatch = name.match(/\s+([A-Z])$/);
        const section = sectionMatch ? sectionMatch[1] : "";

        if (nameLower.includes("maternelle")) {
            // For Maternelle: 1M, 2M, 3M...
            const suffix = section || "";
            return `${num}M${suffix}`.trim();
        } else if (nameLower.includes("primaire")) {
            // For Primaire: 1P or 1PA, 1PB...
            const suffix = section || "";
            return `${num}P${suffix}`.trim();
        } else {
            // For Secondaire standard (like 7e CTEB, 8e CTEB): 7A, 7B, 8A...
            // It must always contain a letter, with 'A' by default when single classroom
            const letter = section || "A";
            return `${num}${letter}`.trim();
        }
    };

    const classrooms = useMemo(() => {
        if (!schoolData) return [];
        const rooms = getClassroomsByLevel(selectedLevel, schoolData);
        if (!rooms) return [];
        
        const gradeOrder = [7, 8, 1, 2, 3, 4, 5, 6];
        
        return [...rooms].sort((a, b) => {
            const codeA = getClassCode(a);
            const codeB = getClassCode(b);
            
            const matchA = codeA.match(/\d+/);
            const matchB = codeB.match(/\d+/);
            
            const numA = matchA ? parseInt(matchA[0], 10) : null;
            const numB = matchB ? parseInt(matchB[0], 10) : null;
            
            const rankA = numA !== null && gradeOrder.includes(numA) ? gradeOrder.indexOf(numA) : 999;
            const rankB = numB !== null && gradeOrder.includes(numB) ? gradeOrder.indexOf(numB) : 999;
            
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            
            // Alphabetic sorting of the codes (e.g. "1A" < "1B" < "2A" etc)
            return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
        });
    }, [selectedLevel, schoolData]);

    const readOnly = useMemo(() => {
        const role = (user?.role || "").toUpperCase();
        return !(
            role === "ADMIN" || 
            role === "SUPERADMIN" || 
            role === "ADMIN_SYSTEM" || 
            role === "SECRETARY" || 
            role === "SECRETARY_CASHIER"
        );
    }, [user?.role]);

    const courseDBKeyMap = useMemo(() => {
        return schoolData ? getCourseDBKeyMap(schoolData) : {};
    }, [schoolData]);

    const teachersForLevel = useMemo(() => {
        if (!schoolData?.teachers) return [];
        return (schoolData.teachers as StaffProfile[]).filter(
            (t) => t.category === STAFF_CATEGORIES.ENSEIGNANT && 
            (t.level === selectedLevel || (t.levels && t.levels.includes(selectedLevel)))
        );
    }, [schoolData?.teachers, selectedLevel]);

    const getTitulaire = (classroomName: string): StaffProfile | undefined => {
        if (!schoolData?.teachers) return undefined;
        return (schoolData.teachers as StaffProfile[]).find(
            (t) => t.assignedClassroom && classroomNamesMatch(t.assignedClassroom, classroomName)
        );
    };

    const getStudentCount = (classroomName: string): number => {
        if (!typedSchoolData?.students) return 0;
        return (typedSchoolData.students as Student[]).filter((s) => s.classroomName === classroomName).length;
    };

    const getCoursesCount = (classroomName: string): number => {
        if (!typedSchoolData?.courses) return 0;
        const dbKey = courseDBKeyMap[classroomName] || classroomName;
        return (typedSchoolData.courses[dbKey] || []).length;
    };

    const handleOpenAssignDialog = (classroomName: string) => {
        setSelectedClassroom(classroomName);
        const currentTitulaire = getTitulaire(classroomName);
        setSelectedTeacherId(currentTitulaire?.id || "");
        setAssignDialogOpen(true);
    };

    const doesTeacherTeachInClassroom = (teacherId: string, classroomName: string): boolean => {
        if (!schoolData?.timetables) return false;
        const teacher = (schoolData?.teachers as StaffProfile[])?.find((t) => t.id === teacherId);
        if (!teacher) return false;

        const teacherFullName = getTeacherFullName(teacher);
        const firstLast = `${teacher.firstName} ${teacher.lastName}`;
        const lastFirst = `${teacher.lastName} ${teacher.firstName}`;

        const isMatch = (name1: string, name2: string) => {
            if (!name1 || !name2) return false;
            return name1.toLowerCase().trim() === name2.toLowerCase().trim();
        };

        const classroomTimetable = typedSchoolData?.timetables?.[classroomName];
        if (!classroomTimetable || typeof classroomTimetable !== "object") return false;

        for (const key in classroomTimetable) {
            const entry = (classroomTimetable as any)[key];
            if (entry && (isMatch(entry.teacher, teacherFullName) || isMatch(entry.teacher, firstLast) || isMatch(entry.teacher, lastFirst))) return true;
            if (entry && entry.teacherId === teacherId) return true;
        }
        return false;
    };

    const handlePreAssignTitulaire = () => {
        if (!selectedClassroom) return;
        const warnings: { replacement?: string; notTeaching?: boolean } = {};
        const currentTitulaire = getTitulaire(selectedClassroom);
        if (currentTitulaire && selectedTeacherId && currentTitulaire.id !== selectedTeacherId) {
            warnings.replacement = getTeacherFullName(currentTitulaire);
        }
        if (selectedTeacherId && !doesTeacherTeachInClassroom(selectedTeacherId, selectedClassroom)) {
            warnings.notTeaching = true;
        }
        if (warnings.replacement || warnings.notTeaching) {
            setConfirmWarnings(warnings);
            setConfirmDialogOpen(true);
        } else {
            handleAssignTitulaire();
        }
    };

    const handleAssignTitulaire = async () => {
        if (!selectedClassroom) return;
        setIsSaving(true);
        setConfirmDialogOpen(false);
        try {
            const previousTitulaire = getTitulaire(selectedClassroom);
            if (previousTitulaire && previousTitulaire.id !== selectedTeacherId) {
                await fetch("/api/staff", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: previousTitulaire.id,
                        staffData: { assignedClassroom: "" },
                        executorName: user?.name || 'Administrateur',
                    }),
                });
            }
            if (selectedTeacherId) {
                const res = await fetch("/api/staff", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: selectedTeacherId,
                        staffData: { assignedClassroom: selectedClassroom },
                        executorName: user?.name || 'Administrateur',
                    }),
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Échec de l'assignation.");
                }
            }
            toast.success("Le titulaire a été assigné.");
            refreshData();
            setAssignDialogOpen(false);
            setConfirmWarnings({});
        } catch (error: any) {
            toast.error(error.message || "Échec de l'assignation.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:ethos-dark-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-6 sm:p-10 lg:p-16 text-slate-800 dark:text-slate-200 transition-colors duration-300">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/20">
                        <School className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2">Locaux & Classes</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">Gérez l&apos;affectation des titulaires et surveillez les effectifs par local.</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-5">
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-none backdrop-blur-xl rounded-2xl py-4 px-8 shadow-sm dark:shadow-none">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Total Locaux</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                            {classrooms.length}
                        </p>
                    </div>
                    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-none backdrop-blur-xl rounded-2xl py-4 px-8 shadow-sm dark:shadow-none">
                        <p className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1">Effectif Total</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                            {classrooms.reduce((acc, curr) => acc + getStudentCount(curr), 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Glass Navigation Tabs */}
            <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-slate-200 dark:border-white/5 w-fit mb-16 shadow-lg dark:shadow-2xl">
                {levels.map((levelObj) => (
                    <button
                        key={levelObj.key}
                        onClick={() => setSelectedLevel(levelObj.key)}
                        className={cn(
                            "relative px-10 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.15em] transition-all duration-500 flex items-center gap-3 overflow-hidden group",
                            selectedLevel === levelObj.key
                                ? "text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        )}
                    >
                        {selectedLevel === levelObj.key && (
                            <motion.div 
                                layoutId="activeTab"
                                className="absolute inset-0 bg-white dark:bg-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                        )}
                        <levelObj.icon className={cn(
                            "h-4 w-4 transition-colors duration-500 relative z-10",
                            selectedLevel === levelObj.key ? levelObj.color : "text-slate-600 group-hover:text-slate-400"
                        )} />
                        <span className="relative z-10">{levelObj.label}</span>
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {classrooms.length === 0 ? (
                    <motion.div 
                        key="empty"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white dark:bg-transparent p-24 text-center border-dashed border-2 border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none rounded-3xl"
                    >
                        <div className="h-24 w-24 rounded-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 flex items-center justify-center mx-auto mb-10 shadow-inner">
                            <School className="h-10 w-10 text-slate-400 dark:text-slate-700" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Aucun local configuré</h3>
                        <p className="text-slate-500 text-lg max-w-md mx-auto">
                            Il n&apos;y a actuellement aucune salle de classe définie pour le niveau <span className="text-primary font-bold uppercase">{selectedLevel}</span>.
                        </p>
                    </motion.div>
                ) : (
                    <motion.div 
                        key={selectedLevel}
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: {
                                opacity: 1,
                                transition: { staggerChildren: 0.05 }
                            }
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                    >
                        {classrooms.map((classroomName) => {
                            const studentsCount = getStudentCount(classroomName);
                            const titulaire = getTitulaire(classroomName);
                            const classCode = getClassCode(classroomName);
                            const levelObj = levels.find(l => l.key === selectedLevel);
                            return (
                                <motion.div 
                                    key={classroomName}
                                    variants={{
                                        hidden: { opacity: 0, scale: 0.9, y: 20 },
                                        show: { opacity: 1, scale: 1, y: 0 }
                                    }}
                                    className="bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] backdrop-blur-xl rounded-2xl p-5 group flex flex-col h-full relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:hover:bg-slate-900/80"
                                >
                                    {/* Subtle Glow Effect on Hover */}
                                    <div className={cn(
                                        "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-[80px] opacity-0 dark:group-hover:opacity-20 group-hover:opacity-10 transition-opacity duration-700",
                                        levelObj?.bgColor || "bg-primary/20"
                                    )} />

                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-11 h-11 rounded-xl flex items-center justify-center border shadow-md transition-all duration-500 group-hover:scale-105",
                                                    selectedLevel === "maternelle" ? "bg-pink-500/10 border-pink-500/20 shadow-pink-500/5" :
                                                    selectedLevel === "primaire" ? "bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5" :
                                                    "bg-blue-500/10 border-blue-500/20 shadow-blue-500/5"
                                                )}>
                                                    <School className={cn(
                                                        "h-5.5 w-5.5",
                                                        selectedLevel === "maternelle" ? "text-pink-400" :
                                                        selectedLevel === "primaire" ? "text-emerald-400" :
                                                        "text-blue-400"
                                                    )} />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase leading-none tracking-tight">
                                                        {classCode}
                                                    </h2>
                                                    <span className="text-[10px] font-bold text-slate-400/80 mt-1 block">
                                                        {classroomName}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3 mb-5">
                                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 group-hover:bg-slate-100/50 dark:group-hover:bg-white/[0.04] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                                        <Users className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Élèves</span>
                                                </div>
                                                <span className="text-base font-black text-slate-900 dark:text-white">{studentsCount}</span>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-3 px-1">
                                                    <UserCog className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Titulaire de classe</span>
                                                </div>
                                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 group-hover:bg-slate-100/50 dark:group-hover:bg-white/[0.04] transition-colors">
                                                    <p className={cn(
                                                        "text-xs font-bold truncate",
                                                        titulaire ? "text-slate-800 dark:text-white" : "text-slate-400 dark:text-slate-500 italic"
                                                    )}>
                                                        {titulaire ? getTeacherFullName(titulaire) : "Aucun enseignant assigné"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center gap-2 relative z-10 pt-3 border-t border-slate-100 dark:border-white/5">
                                        <Link 
                                            href={`/classrooms/${encodeURIComponent(classroomName)}`}
                                            className="flex-1"
                                        >
                                            <button className="w-full h-9 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-center justify-center gap-1.5 group/btn">
                                                Gérer
                                                <ArrowRight className="h-3 w-3 group-hover/btn:translate-x-0.5 transition-transform" />
                                            </button>
                                        </Link>
                                        {!readOnly && (
                                            <button 
                                                onClick={() => handleOpenAssignDialog(classroomName)}
                                                className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all flex items-center justify-center shadow-md shadow-primary/5"
                                                title="Assigner un titulaire"
                                            >
                                                <UserCog className="h-4.5 w-4.5" />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dialogs remain similar but with premium styling */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="bg-white dark:bg-slate-950/90 backdrop-blur-3xl border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 max-w-lg rounded-[2rem] p-10 shadow-2xl">
                    <DialogHeader className="mb-8">
                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Assigner un Titulaire</DialogTitle>
                        <DialogDescription className="text-slate-500 dark:text-slate-400 text-lg">
                            Choisissez un enseignant responsable pour le local <span className="text-primary font-black">{selectedClassroom}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-8">
                        <div className="space-y-4">
                            <Label className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] ml-1">Sélectionner l&apos;enseignant</Label>
                            <Combobox
                                items={[
                                    { value: "__none__", label: "Aucun (retirer le titulaire)" },
                                    ...teachersForLevel.map((t) => ({ 
                                        value: t.id, 
                                        label: `${getTeacherFullName(t)}${t.assignedClassroom ? ` (Déjà Titulaire: ${t.assignedClassroom})` : ""}`
                                    }))
                                ]}
                                value={selectedTeacherId || "__none__"}
                                onChange={(val) => setSelectedTeacherId(val === "__none__" ? "" : (val || ""))}
                                placeholder="Rechercher un membre du personnel..."
                                triggerClass="w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-16 rounded-2xl focus:border-primary/50"
                            />
                        </div>

                        <div className="p-6 rounded-[1.5rem] bg-blue-500/5 border border-blue-500/10 flex gap-5">
                            <AlertTriangle className="h-6 w-6 text-blue-400 shrink-0" />
                            <p className="text-sm text-blue-300/80 leading-relaxed font-medium">
                                Le titulaire aura un accès privilégié aux rapports et à la gestion des élèves de ce local spécifique.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="mt-12 flex gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setAssignDialogOpen(false)} 
                            className="flex-1 h-16 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-black uppercase tracking-widest text-[10px]"
                        >
                            Annuler
                        </Button>
                        <Button 
                            onClick={handlePreAssignTitulaire} 
                            disabled={isSaving}
                            className="flex-1 h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/20"
                        >
                            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmer l'assignation"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent className="bg-white dark:bg-slate-950/90 backdrop-blur-3xl border-slate-200 dark:border-white/5 text-slate-800 dark:text-slate-200 max-w-md rounded-[2rem] p-10 shadow-2xl">
                    <DialogHeader className="mb-8 text-center">
                        <div className="h-20 w-20 rounded-3xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
                            <AlertTriangle className="h-10 w-10 text-amber-500" />
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Attention</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        {confirmWarnings.replacement && (
                            <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                                <p className="text-sm text-amber-500/90 leading-relaxed font-bold text-center">
                                    {confirmWarnings.replacement} est déjà titulaire de ce local.
                                </p>
                            </div>
                        )}
                        {confirmWarnings.notTeaching && (
                            <div className="p-6 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                                <p className="text-sm text-orange-500/90 leading-relaxed font-bold text-center">
                                    Cet enseignant n&apos;est pas répertorié dans l&apos;horaire de ce local.
                                </p>
                            </div>
                        )}
                        <p className="text-center text-slate-500 dark:text-slate-400 font-medium px-4">
                            Voulez-vous vraiment confirmer ce changement de titulaire ?
                        </p>
                    </div>

                    <DialogFooter className="mt-10 flex gap-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setConfirmDialogOpen(false)} 
                            className="flex-1 h-16 rounded-2xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 font-black uppercase tracking-widest text-[10px]"
                        >
                            Annuler
                        </Button>
                        <Button 
                            onClick={handleAssignTitulaire} 
                            disabled={isSaving}
                            className="flex-1 h-16 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-[10px]"
                        >
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
