"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Loader2, ArrowLeft, Search, BookOpen, GraduationCap, Check, X, UserPlus, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getTeacherFullName, getTeacherShortName, cn } from "@/lib/utils";
import { STAFF_CATEGORIES } from "@/lib/staff-definitions";
import type { StaffProfile } from "@/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function CourseAssignmentPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { schoolData, isLoading: isSchoolLoading, user } = useSchoolData();
    const courseName = decodeURIComponent(params.name as string);
    const sourceClassroom = searchParams.get("classroom");

    const [searchTerm, setSearchTerm] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [teachers, setTeachers] = useState<StaffProfile[]>([]);
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

    const typedSchoolData = schoolData as any;

    const fetchTeachers = async () => {
        if (!typedSchoolData?.matricule) return;
        setIsLoadingTeachers(true);
        try {
            const res = await fetch(`/api/staff?matricule=${typedSchoolData.matricule}`);
            if (res.ok) {
                const data = await res.json();
                const secondaryTeachers = (data as StaffProfile[])
                    .filter((t) => 
                        t.level?.toLowerCase() === "secondaire" && 
                        t.category === STAFF_CATEGORIES.ENSEIGNANT
                    )
                    .sort((a, b) => a.lastName.localeCompare(b.lastName));
                setTeachers(secondaryTeachers);
            }
        } catch (error) {
            toast.error("Échec du chargement des enseignants.");
        }
        setIsLoadingTeachers(false);
    };

    useEffect(() => {
        if (typedSchoolData?.matricule) {
            fetchTeachers();
        } else if (!isSchoolLoading) {
            setIsLoadingTeachers(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typedSchoolData?.matricule, isSchoolLoading]);

    const filteredTeachers = useMemo(() => {
        if (!searchTerm.trim()) return teachers;
        const term = searchTerm.toLowerCase();
        return teachers.filter(
            (t) =>
                t.firstName.toLowerCase().includes(term) ||
                t.lastName.toLowerCase().includes(term) ||
                (t.middleName && t.middleName.toLowerCase().includes(term))
        );
    }, [teachers, searchTerm]);

    const getAssignedCourses = (teacher: StaffProfile): string[] => {
        let assigned: string[] = [];
        if (typeof teacher.assignedCourses === "string") {
            try {
                assigned = JSON.parse(teacher.assignedCourses);
            } catch (e) {
                assigned = [];
            }
        } else if (Array.isArray(teacher.assignedCourses)) {
            assigned = teacher.assignedCourses as unknown as string[];
        }
        return assigned.map(c => typeof c === 'object' && c !== null ? (c as any).name : String(c));
    };

    const assignedTeachers = useMemo(() => {
        return teachers.filter((t) => {
            const courses = getAssignedCourses(t);
            const isPending = pendingChanges[t.id];
            const wasAssigned = courses.includes(courseName);
            if (isPending !== undefined) return isPending;
            return wasAssigned;
        });
    }, [teachers, courseName, pendingChanges]);

    const isTeacherSelected = (teacher: StaffProfile): boolean => {
        const courses = getAssignedCourses(teacher);
        const isPending = pendingChanges[teacher.id];
        if (isPending !== undefined) return isPending;
        return courses.includes(courseName);
    };

    const handleToggleTeacher = (teacherId: string) => {
        const teacher = teachers.find((t) => t.id === teacherId);
        if (!teacher) return;

        const courses = getAssignedCourses(teacher);
        const currentlyAssigned = courses.includes(courseName);
        const pendingState = pendingChanges[teacherId];

        const isCurrentlySelected = pendingState !== undefined ? pendingState : currentlyAssigned;

        setPendingChanges((prev) => ({
            ...prev,
            [teacherId]: !isCurrentlySelected,
        }));
    };

    const handleRemoveTeacher = (teacherId: string) => {
        setPendingChanges((prev) => ({
            ...prev,
            [teacherId]: false,
        }));
    };

    const handleSave = async () => {
        if (Object.keys(pendingChanges).length === 0) {
            toast.info("Aucune modification à enregistrer.");
            return;
        }

        setIsSaving(true);
        const matricule = typedSchoolData?.matricule;
        if (!matricule) {
            toast.error("Matricule introuvable.");
            setIsSaving(false);
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const [teacherId, shouldHaveCourse] of Object.entries(pendingChanges)) {
            const teacher = teachers.find((t) => t.id === teacherId);
            if (!teacher) continue;

            const currentCourses = getAssignedCourses(teacher);
            const hasCourse = currentCourses.includes(courseName);

            if (shouldHaveCourse && !hasCourse) {
                const res = await fetch("/api/staff", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: teacherId,
                        staffData: { assignedCourses: [...currentCourses, courseName] },
                        executorName: user?.name || 'Administrateur',
                    }),
                });
                if (res.ok) successCount++;
                else errorCount++;
            } else if (!shouldHaveCourse && hasCourse) {
                const res = await fetch("/api/staff", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: teacherId,
                        staffData: { assignedCourses: currentCourses.filter((c) => c !== courseName) },
                        executorName: user?.name || 'Administrateur',
                    }),
                });
                if (res.ok) successCount++;
                else errorCount++;
            }
        }

        if (errorCount > 0) {
            toast.error(`Erreur partielle: ${successCount} modification(s) réussie(s), ${errorCount} échouée(s).`);
        } else if (successCount > 0) {
            toast.success(`${successCount} modification(s) enregistrée(s).`);
        }

        await fetchTeachers();
        setPendingChanges({});
        setIsSaving(false);
    };

    const hasPendingChanges = Object.keys(pendingChanges).length > 0;

    const handleBack = () => {
        if (sourceClassroom) {
            router.push(`/classrooms/${encodeURIComponent(sourceClassroom)}`);
        } else {
            router.back();
        }
    };

    if (isLoadingTeachers || isSchoolLoading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                <Button variant="ghost" onClick={handleBack} className="w-fit text-muted-foreground hover:text-foreground hover:bg-white/50 rounded-xl">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {sourceClassroom ? `Retour à ${sourceClassroom}` : "Retour"}
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="neuglass-light-icon h-16 w-16 rounded-2xl bg-amber-500/10 shadow-inner">
                            <BookOpen className="h-8 w-8 text-amber-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-headline font-bold text-foreground uppercase tracking-tight">
                                {courseName}
                            </h1>
                            <p className="text-muted-foreground mt-1 font-medium italic">Assignation des enseignants spécialisés</p>
                        </div>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={isSaving || !hasPendingChanges}
                        className="neuglass-light-btn-primary text-white h-12 px-8 rounded-xl shadow-xl shadow-primary/20 font-bold uppercase tracking-tight"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
                        Enregistrer les modifications
                        {hasPendingChanges && (
                            <Badge variant="secondary" className="ml-3 bg-white/20 hover:bg-white/30 text-white border-0 h-6 px-2 font-bold">
                                {Object.keys(pendingChanges).length}
                            </Badge>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Search and Select Teachers */}
                <div className="neuglass-light-card p-6 border-white/80">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-headline font-bold text-foreground flex items-center gap-3">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Catalogue Enseignants
                        </h2>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold">
                            {filteredTeachers.length} DISPONIBLES
                        </Badge>
                    </div>

                    {/* Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher par nom ou prénom..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="neuglass-light-input h-12 pl-12 rounded-xl text-base font-medium"
                        />
                    </div>

                    {/* Teacher List */}
                    {filteredTeachers.length === 0 ? (
                        <div className="text-center py-12 bg-white/30 rounded-2xl border border-dashed border-muted-foreground/20">
                            <GraduationCap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">
                                {searchTerm ? "Aucun résultat pour cette recherche." : "Aucun enseignant secondaire trouvé."}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-2xl bg-white/40 max-h-[500px] overflow-y-auto border border-white/60 shadow-inner custom-scrollbar">
                            {filteredTeachers.map((teacher) => {
                                const isSelected = isTeacherSelected(teacher);
                                const courses = getAssignedCourses(teacher);
                                return (
                                    <div
                                        key={teacher.id}
                                        onClick={() => handleToggleTeacher(teacher.id)}
                                        className={cn(
                                            "flex items-center gap-4 p-4 cursor-pointer transition-all border-b border-white/40 last:border-b-0",
                                            isSelected ? "bg-primary/5" : "hover:bg-white/60"
                                        )}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => handleToggleTeacher(teacher.id)}
                                            className="h-5 w-5 rounded-md"
                                        />
                                        <div className="flex-1">
                                            <p className="font-bold text-base text-foreground uppercase tracking-tight">{getTeacherFullName(teacher)}</p>
                                            {courses.length > 0 && (
                                                <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate max-w-md">
                                                    Expertise : {courses.join(", ")}
                                                </p>
                                            )}
                                        </div>
                                        <AnimatePresence>
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.8 }}
                                                >
                                                    <Badge className="bg-primary/10 text-primary border-primary/20 font-bold px-3 py-1">
                                                        SÉLECTIONNÉ
                                                    </Badge>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Assigned Teachers */}
                <div className="neuglass-light-card p-6 border-white/80">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-headline font-bold text-foreground flex items-center gap-3">
                            <GraduationCap className="h-5 w-5 text-amber-600" />
                            Équipe Pédagogique
                        </h2>
                        <Badge className="bg-amber-500 text-white border-0 font-bold px-3">
                            {assignedTeachers.length} ASSIGNÉS
                        </Badge>
                    </div>

                    {assignedTeachers.length === 0 ? (
                        <div className="text-center py-16 bg-white/30 rounded-2xl border border-dashed border-amber-200/50">
                            <div className="h-16 w-16 rounded-full bg-amber-50 mx-auto flex items-center justify-center mb-4">
                                <GraduationCap className="h-8 w-8 text-amber-300" />
                            </div>
                            <p className="text-muted-foreground font-bold">Aucun enseignant pour ce cours.</p>
                            <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
                                Utilisez la liste à gauche pour composer l&apos;équipe de ce cours.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            <AnimatePresence mode="popLayout">
                                {assignedTeachers.map((teacher) => (
                                    <motion.div
                                        key={teacher.id}
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 border border-white/80 shadow-sm group hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="neuglass-light-icon h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                                                <User className="h-5 w-5 text-primary/70" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-base text-foreground uppercase tracking-tight">{getTeacherFullName(teacher)}</p>
                                                <p className="text-xs text-muted-foreground font-medium">{getTeacherShortName(teacher)}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveTeacher(teacher.id)}
                                            className="h-10 w-10 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Info box */}
                    <div className="mt-8 p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow-inner">
                        <div className="flex gap-4">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-blue-800 uppercase tracking-tight mb-1">Architecture Pédagogique</p>
                                <p className="text-xs text-blue-600/80 leading-relaxed font-medium">
                                    Cette assignation pré-établit les experts autorisés pour ce cours. 
                                    Le placement dans l&apos;horaire de chaque local se fera ensuite dynamiquement dans l&apos;interface de planification.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
