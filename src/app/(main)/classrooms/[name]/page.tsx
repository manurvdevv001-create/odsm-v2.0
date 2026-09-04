"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Loader2, User, Users, BookOpen, School, ArrowLeft, GraduationCap, ChevronRight, AlertTriangle, Trash2, RotateCcw, ArrowRight, ShieldAlert, UserPlus, UserMinus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getTeacherFullName } from "@/lib/utils";
import { classroomNamesMatch, getCourseDBKeyMap, isSecondaryClassroom, getClassroomLevel } from "@/lib/classroom-utils";
import type { StaffProfile, Student } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { cleanupClassroomData } from "./actions";
import BulkAssignmentPanel from "./BulkAssignmentPanel";

type Course = { name: string; max: number } | string;

export default function ClassroomDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { schoolData, isLoading: isSchoolLoading, refreshData, user } = useSchoolData();
    const classroomName = decodeURIComponent(params.name as string);
    const typedSchoolData = schoolData as any;
    const executorName = user?.name || "Administrateur";

    const students = useMemo((): Student[] => {
        if (!typedSchoolData?.students) return [];
        return typedSchoolData.students.filter((s: Student) => s.classroomName === classroomName && s.status === 'active');
    }, [typedSchoolData?.students, classroomName]);

    const [teachers, setTeachers] = useState<StaffProfile[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isCleaning, setIsCleaning] = useState(false);
    const [cleanupOptions, setCleanupOptions] = useState({
        courses: true,
        grades: false,
        timetables: true
    });

    useEffect(() => {
        const fetchTeachers = async () => {
            if (!typedSchoolData?.matricule) return;
            setIsLoadingData(true);
            try {
                const res = await fetch(`/api/staff?matricule=${typedSchoolData.matricule}`);
                if (res.ok) {
                    const data = await res.json();
                    setTeachers(data);
                }
            } catch (error) {
                toast.error("Échec du chargement des enseignants.");
            }
            setIsLoadingData(false);
        };

        if (typedSchoolData?.matricule) {
            fetchTeachers();
        } else if (!isSchoolLoading) {
            setIsLoadingData(false);
        }
    }, [typedSchoolData?.matricule, isSchoolLoading]);

    const titulaire = useMemo((): StaffProfile | undefined => {
        return teachers.find(t => t.assignedClassroom && classroomNamesMatch(t.assignedClassroom, classroomName));
    }, [teachers, classroomName]);

    const courseDBKeyMap = useMemo(() => {
        return schoolData ? getCourseDBKeyMap(schoolData) : {};
    }, [schoolData]);

    const courses = useMemo((): Course[] => {
        if (!typedSchoolData?.courses) return [];
        const dbKey = courseDBKeyMap[classroomName] || classroomName;
        return typedSchoolData.courses[dbKey] || [];
    }, [typedSchoolData?.courses, classroomName, courseDBKeyMap]);

    const getPlacedTeachersForCourse = (courseName: string): string[] => {
        if (!typedSchoolData?.timetables?.[classroomName]) return [];
        const timetable = typedSchoolData.timetables[classroomName];
        const placedTeachers = new Set<string>();
        Object.values(timetable).forEach((entry: any) => {
            if (entry && entry.course === courseName && entry.teacher) {
                placedTeachers.add(entry.teacher);
            }
        });
        return Array.from(placedTeachers);
    };

    const getAssignedTeachersForCourse = (courseName: string): StaffProfile[] => {
        return teachers.filter(t => {
            let assignedCourses: string[] = [];
            if (typeof t.assignedCourses === 'string') {
                try {
                    assignedCourses = JSON.parse(t.assignedCourses);
                } catch (e) {
                    assignedCourses = [];
                }
            } else if (Array.isArray(t.assignedCourses)) {
                assignedCourses = t.assignedCourses as unknown as string[];
            }
            return assignedCourses.includes(courseName);
        });
    };

    const getCoursePeriods = (courseName: string): number => {
        if (!typedSchoolData?.timetables?.[classroomName]) return 0;
        const timetable = typedSchoolData.timetables[classroomName];
        return Object.values(timetable).filter((entry: any) => entry && entry.course === courseName).length;
    };

    const getTeacherDisplay = (courseName: string): { text: string; count: number } => {
        const placedTeachers = getPlacedTeachersForCourse(courseName);
        if (placedTeachers.length === 0) {
            const assignedTeachers = getAssignedTeachersForCourse(courseName);
            if (assignedTeachers.length > 0) {
                return { text: `${assignedTeachers.length} assigné(s)`, count: assignedTeachers.length };
            }
            return { text: "Non assigné", count: 0 };
        } else if (placedTeachers.length === 1) {
            return { text: placedTeachers[0], count: 1 };
        } else {
            return { text: `${placedTeachers.length} enseignants`, count: placedTeachers.length };
        }
    };

    const handleCleanup = async () => {
        if (!cleanupOptions.courses && !cleanupOptions.grades && !cleanupOptions.timetables) {
            toast.error("Veuillez sélectionner au moins une option de nettoyage.");
            return;
        }
        setIsCleaning(true);
        try {
            const res = await cleanupClassroomData(
                typedSchoolData.matricule,
                classroomName,
                cleanupOptions,
                "Administrateur"
            );
            if (res.success) {
                toast.success(res.message || "Nettoyage effectué avec succès.");
                router.refresh();
            } else {
                toast.error(res.error || "Une erreur est survenue lors du nettoyage.");
            }
        } catch (error) {
            toast.error("Erreur de connexion au serveur.");
        } finally {
            setIsCleaning(false);
        }
    };

    const isSecondary = useMemo(() => isSecondaryClassroom(classroomName, schoolData), [classroomName, schoolData]);
    const classroomLevel = useMemo(() => getClassroomLevel(classroomName, schoolData), [classroomName, schoolData]);

    if (isSchoolLoading || (isLoadingData && !typedSchoolData)) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header with Navigation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col gap-6"
            >
                <Link href="/classrooms">
                    <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground font-bold">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Retour aux Locaux
                    </Button>
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
                            <School className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight uppercase">{classroomName}</h1>
                            <div className="flex items-center gap-3 mt-1">
                                {titulaire ? (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold px-3 py-0.5 rounded-lg flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" />
                                        Titulaire: {getTeacherFullName(titulaire)}
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold px-3 py-0.5 rounded-lg flex items-center gap-1.5">
                                        <ShieldAlert className="h-3.5 w-3.5" />
                                        Aucun titulaire assigné
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href={`/classrooms/${encodeURIComponent(classroomName)}/evaluations`}>
                            <Button className="font-bold rounded-xl h-11 px-6 shadow-md hover:shadow-lg transition-all">
                                <GraduationCap className="h-5 w-5 mr-2" />
                                Évaluation Académique
                            </Button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card className="border-none shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-500/10">
                                <Users className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Effectif</p>
                                <p className="text-2xl font-bold">{students.length} Élèves</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-violet-500/10">
                                <BookOpen className="h-6 w-6 text-violet-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Charge Horaire</p>
                                <p className="text-2xl font-bold">{courses.length} Matières</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-md">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-emerald-500/10">
                                <GraduationCap className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Niveau</p>
                                <p className="text-2xl font-bold capitalize">
                                    {classroomLevel === "secondaire" ? "Secondaire" : classroomLevel === "maternelle" ? "Maternelle" : classroomLevel === "primaire" ? "Primaire" : isSecondary ? "Secondaire" : "Primaire"}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Students Table with Bulk Assignment */}
                <BulkAssignmentPanel
                    classroomName={classroomName}
                    students={students}
                    allStudents={typedSchoolData?.students || []}
                    matricule={typedSchoolData?.matricule || ""}
                    executorName={executorName}
                    onComplete={() => refreshData()}
                />

                {/* Courses Table */}
                <Card className="border-none shadow-md flex flex-col h-full">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-violet-500" />
                            Liste des Cours
                        </CardTitle>
                        <CardDescription>Structure pédagogique et enseignants assignés.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {courses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <BookOpen className="h-12 w-12 opacity-20 mb-3" />
                                <p className="font-medium">Aucun cours configuré</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead className="font-bold">Matière</TableHead>
                                            <TableHead className="font-bold">Enseignant</TableHead>
                                            <TableHead className="text-center font-bold">Heures</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {courses.map((course, idx) => {
                                            const courseName = typeof course === "string" ? course : course.name;
                                            const teacherDisplay = getTeacherDisplay(courseName);
                                            const periods = getCoursePeriods(courseName);

                                            return (
                                                <TableRow key={idx} className="group hover:bg-muted/30">
                                                    <TableCell className="font-bold uppercase text-xs tracking-tight">
                                                        {isSecondary ? (
                                                            <Link
                                                                href={`/classrooms/courses/${encodeURIComponent(courseName)}?classroom=${encodeURIComponent(classroomName)}`}
                                                                className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                                                            >
                                                                {courseName}
                                                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                                            </Link>
                                                        ) : (
                                                            <span>{courseName}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {teacherDisplay.count > 0 ? (
                                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold py-0.5">
                                                                    {teacherDisplay.text}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs italic">{teacherDisplay.text}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant={periods > 0 ? "default" : "secondary"} className="font-bold">
                                                            {periods}h
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Maintenance Zone */}
            <Card className="border-none shadow-md bg-red-500/[0.03] border-red-500/10">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/10">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg text-red-600">Zone de Maintenance</CardTitle>
                            <CardDescription className="text-red-600/70">Outils de récupération et de nettoyage des données.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-5 rounded-2xl bg-background border border-red-500/20">
                        <div>
                            <h3 className="font-bold text-foreground">Réinitialisation des données</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                Corrigez les anomalies de structure ou supprimez les notes corrompues pour ce local spécifiquement.
                            </p>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="rounded-xl font-bold h-11 px-6 shadow-sm">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Nettoyer le Local
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl p-8 max-w-lg">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-bold flex items-center gap-3 text-red-600 mb-2">
                                        <AlertTriangle className="h-8 w-8" />
                                        Nettoyage : {classroomName}
                                    </AlertDialogTitle>
                                    <AlertDialogDescription asChild>
                                        <div className="space-y-5 pt-4">
                                            <p className="text-sm font-bold text-foreground uppercase tracking-widest text-muted-foreground">Sélectionnez les éléments à supprimer :</p>
                                            
                                            <div className="space-y-3">
                                                <div className="flex items-start space-x-3 p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all cursor-pointer group" 
                                                     onClick={() => setCleanupOptions(prev => ({ ...prev, courses: !prev.courses }))}>
                                                    <Checkbox checked={cleanupOptions.courses} className="mt-1" />
                                                    <div className="grid gap-1">
                                                        <label className="text-sm font-bold leading-none cursor-pointer group-hover:text-primary transition-colors">
                                                            Réinitialiser la liste des cours
                                                        </label>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            Supprime les branches configurées. Idéal pour corriger les erreurs de structure.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start space-x-3 p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-primary/20 transition-all cursor-pointer group"
                                                     onClick={() => setCleanupOptions(prev => ({ ...prev, timetables: !prev.timetables }))}>
                                                    <Checkbox checked={cleanupOptions.timetables} className="mt-1" />
                                                    <div className="grid gap-1">
                                                        <label className="text-sm font-bold leading-none cursor-pointer group-hover:text-primary transition-colors">
                                                            Réinitialiser l&apos;horaire
                                                        </label>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            Efface l&apos;emploi du temps hebdomadaire complet de ce local.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start space-x-3 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all cursor-pointer group"
                                                     onClick={() => setCleanupOptions(prev => ({ ...prev, grades: !prev.grades }))}>
                                                    <Checkbox checked={cleanupOptions.grades} className="mt-1 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" />
                                                    <div className="grid gap-1">
                                                        <label className="text-sm font-bold leading-none text-red-600 cursor-pointer">
                                                            Supprimer TOUTES les notes (DANGER)
                                                        </label>
                                                        <p className="text-xs text-red-600/70 leading-relaxed">
                                                            Action irréversible. Efface définitivement toutes les évaluations et notes saisies.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3 bg-muted/50 rounded-xl border flex items-start gap-2.5">
                                                <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <p className="text-[11px] italic text-muted-foreground">
                                                    Cette action sera enregistrée dans le journal d&apos;audit de l&apos;établissement.
                                                </p>
                                            </div>
                                        </div>
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-8 gap-3">
                                    <AlertDialogCancel disabled={isCleaning} className="rounded-2xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px]">Annuler</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handleCleanup}
                                        disabled={isCleaning}
                                        className="bg-red-600 hover:bg-red-700 text-white border-0 rounded-2xl h-12 flex-1 font-bold uppercase tracking-widest text-[10px]"
                                    >
                                        {isCleaning ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <RotateCcw className="h-4 w-4 mr-2" />
                                        )}
                                        Confirmer le Nettoyage
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
