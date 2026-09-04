// src/app/(main)/timetable/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saveTimetable } from '@/app/setup/actions';
import { Loader2, GripVertical, Copy, User, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn, getTeacherFullName, getTeacherShortName } from '@/lib/utils';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { isReadOnlyRole } from "@/lib/role-permissions";
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { StaffProfile, SchoolData, TimeSlot, Course, AcademicLevel } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getClassroomsByLevel, isSecondaireClass, classroomNamesMatch, getCourseDBKeyMap } from '@/lib/classroom-utils';

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

type TimetableEntry = {
    course: string;
    teacher?: string; // Teacher's name
};

type TimetableData = Record<string, TimetableEntry>; // { [day_slotId]: { course, teacher? } }

type ConflictsMap = Record<string, string[]>; // { teacher_day_slotId: [classroom1, classroom2] }

export default function TimetablePage() {
    const { schoolData: layoutData, isLoading: layoutLoading, refreshData, user: currentUser } = useSchoolData();
    const effectiveRole = ((currentUser?.role as string) || 'ADMIN').toUpperCase();
    const readOnly = isReadOnlyRole(effectiveRole);
    const [selectedClassroom, setSelectedClassroom] = useState<string | null>(null);
    const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<{ name: string, teacher?: string } | null>(null);
    const [conflicts, setConflicts] = useState<ConflictsMap>({});
    // Local timetable state for optimistic updates (prevents focus loss)
    const [localTimetables, setLocalTimetables] = useState<Record<string, any> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const lastSyncedRef = useRef<any>(null);

    // Cast schoolData to SchoolData type for better DX
    const schoolData = layoutData as unknown as SchoolData;

    // Sync local timetables from server data ONLY when server data truly changes
    // (not when isSaving flag changes — that caused stale data overwriting optimistic updates)
    useEffect(() => {
        if (!schoolData?.timetables) return;
        const serverData = typeof schoolData.timetables === 'string'
            ? JSON.parse(schoolData.timetables)
            : schoolData.timetables;

        // Only sync if the server reference is actually new (different object identity)
        if (schoolData.timetables !== lastSyncedRef.current && !isSaving) {
            lastSyncedRef.current = schoolData.timetables;
            setLocalTimetables(serverData);
        }
    }, [schoolData?.timetables]);

    // Get available levels
    const availableLevels = useMemo(() => {
        if (!schoolData?.levels) return [];
        return ['maternelle', 'primaire', 'secondaire'].filter(level => schoolData.levels[level as AcademicLevel]);
    }, [schoolData?.levels]);

    // Set default level when available
    useEffect(() => {
        if (availableLevels.length > 0 && !selectedLevel) {
            setSelectedLevel(availableLevels[0]);
        }
    }, [availableLevels, selectedLevel]);

    const allClassroomsMemo = useMemo(() => {
        if (!schoolData) return [];

        const levels = ['maternelle', 'primaire', 'secondaire'];
        return levels
            .filter(level => schoolData.levels[level as AcademicLevel])
            .flatMap(level => getClassroomsByLevel(level, schoolData as any));
    }, [schoolData]);

    // Filtered classrooms by selected level
    const filteredClassrooms = useMemo(() => {
        if (!schoolData || !selectedLevel) return allClassroomsMemo;
        return getClassroomsByLevel(selectedLevel, schoolData as any);
    }, [schoolData, selectedLevel, allClassroomsMemo]);

    useEffect(() => {
        if (filteredClassrooms.length > 0 && (!selectedClassroom || !filteredClassrooms.includes(selectedClassroom))) {
            setSelectedClassroom(filteredClassrooms[0]);
        }
    }, [filteredClassrooms, selectedClassroom]);

    useEffect(() => {
        if (!localTimetables || !schoolData?.teachers || !allClassroomsMemo.length) {
            setConflicts({});
            return;
        }

        const secondaryClassrooms = allClassroomsMemo.filter(name => isSecondaireClass(name, schoolData as any));

        const scheduleMap: Record<string, string[]> = {}; // { teacher_day_slotId: [classroom1, ...] }

        secondaryClassrooms.forEach(classroom => {
            const timetable = localTimetables[classroom];
            if (timetable) {
                Object.entries(timetable).forEach(([key, entry]: [string, any]) => {
                    if (entry && entry.teacher) {
                        const scheduleKey = `${entry.teacher}_${key}`;
                        if (!scheduleMap[scheduleKey]) {
                            scheduleMap[scheduleKey] = [];
                        }
                        scheduleMap[scheduleKey].push(classroom);
                    }
                });
            }
        });

        const detectedConflicts: ConflictsMap = {};
        Object.entries(scheduleMap).forEach(([key, classrooms]) => {
            if (classrooms.length > 1) {
                detectedConflicts[key] = classrooms;
            }
        });
        setConflicts(detectedConflicts);
    }, [localTimetables, schoolData?.teachers, allClassroomsMemo]);

    const selectedClassroomLevel = useMemo(() => {
        if (!selectedClassroom || !schoolData) return null;

        if (isSecondaireClass(selectedClassroom, schoolData as any)) return 'secondaire';
        if (getClassroomsByLevel('primaire', schoolData as any).includes(selectedClassroom)) return 'primaire';
        if (getClassroomsByLevel('maternelle', schoolData as any).includes(selectedClassroom)) return 'maternelle';

        return null;
    }, [selectedClassroom, schoolData]);

    const classroomTitular = useMemo((): StaffProfile | undefined => {
        if (!selectedClassroom || !schoolData?.teachers) return undefined;
        // Try direct match first, then try classroomNamesMatch for format differences
        return (schoolData.teachers as StaffProfile[]).find(t => {
            if (!t.assignedClassroom) return false;
            // Direct case-insensitive comparison
            const n1 = t.assignedClassroom.trim().toUpperCase().replace(/\s+/g, ' ');
            const n2 = selectedClassroom.trim().toUpperCase().replace(/\s+/g, ' ');
            if (n1 === n2) return true;
            // Check via ordinal equivalence (e.g. "1e" == "1ère" == "1EME")
            const normalizeOrdinal = (s: string) => s
                .replace(/(\d+)(E|ÈRE|ERE|ÈME|EME)\b/gi, '$1')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
            if (normalizeOrdinal(t.assignedClassroom) === normalizeOrdinal(selectedClassroom)) return true;
            // Fallback to classroomNamesMatch (handles CTEB format differences)
            return classroomNamesMatch(t.assignedClassroom, selectedClassroom);
        });
    }, [selectedClassroom, schoolData?.teachers]);

    const timeSlots: TimeSlot[] = useMemo(() => {
        const activeYear = schoolData?.activeYear;
        if (!selectedClassroomLevel || !schoolData?.timeSlots) return [];

        // Support for both year-based and level-based structures
        const slotsData = typeof schoolData.timeSlots === 'string'
            ? JSON.parse(schoolData.timeSlots)
            : schoolData.timeSlots;

        const yearSlots = (activeYear && slotsData[activeYear])
            ? slotsData[activeYear]
            : (slotsData[selectedClassroomLevel] ? slotsData : {});

        return yearSlots[selectedClassroomLevel] || [];
    }, [selectedClassroomLevel, schoolData]);

    const courseDBKeyMap = useMemo(() => {
        if (!schoolData) return {};
        return getCourseDBKeyMap(schoolData as any);
    }, [schoolData]);

    const classroomCourses: string[] = useMemo(() => {
        if (!selectedClassroom || !schoolData?.courses) return [];
        const coursesData = typeof schoolData.courses === 'string'
            ? JSON.parse(schoolData.courses)
            : schoolData.courses;

        const dbKey = courseDBKeyMap[selectedClassroom] || selectedClassroom;
        const courses = coursesData[dbKey] || [];
        return courses.filter(Boolean).map((c: string | Course) => typeof c === 'string' ? c : c.name);
    }, [selectedClassroom, schoolData?.courses, courseDBKeyMap]);

    const secondaryTeachers = useMemo(() => {
        if (!schoolData?.teachers) return [];
        return schoolData.teachers.filter((t: StaffProfile) => t.level === 'secondaire');
    }, [schoolData?.teachers]);

    // Build a map: courseName -> teacher name (single teacher per course per classroom)
    const courseTeacherMap = useMemo(() => {
        const map: Record<string, string> = {};
        if (!secondaryTeachers || !selectedClassroom) return map;
        secondaryTeachers.forEach((teacher: StaffProfile) => {
            // assignedCourses may be a JSON string from DB — parse it safely
            let courses: any[] = [];
            if (typeof teacher.assignedCourses === 'string') {
                try { courses = JSON.parse(teacher.assignedCourses); } catch { courses = []; }
            } else if (Array.isArray(teacher.assignedCourses)) {
                courses = teacher.assignedCourses;
            }

            courses.forEach((courseObj: any) => {
                if (!courseObj) return;
                if (typeof courseObj === 'string') {
                    // Simple string assignment — teacher teaches this course
                    if (!map[courseObj]) {
                        map[courseObj] = getTeacherFullName(teacher);
                    }
                } else if (typeof courseObj === 'object' && courseObj !== null && courseObj.classroom && courseObj.courses) {
                    // Structured assignment { classroom, courses[] }
                    const assignedClassroom = courseObj.classroom;
                    const matchesClassroom = classroomNamesMatch(assignedClassroom, selectedClassroom) ||
                        assignedClassroom.trim().toUpperCase() === selectedClassroom.trim().toUpperCase();
                    if (matchesClassroom) {
                        if (Array.isArray(courseObj.courses)) {
                            (courseObj.courses as string[]).forEach((courseName: string) => {
                                map[courseName] = getTeacherFullName(teacher);
                            });
                        }
                    }
                }
            });
        });
        return map;
    }, [secondaryTeachers, selectedClassroom]);

    const currentTimetable: TimetableData = useMemo(() => {
        if (!selectedClassroom || !localTimetables) return {};
        const dbKey = courseDBKeyMap[selectedClassroom] || selectedClassroom;
        return localTimetables[dbKey] || localTimetables[selectedClassroom] || {};
    }, [selectedClassroom, localTimetables, courseDBKeyMap]);

    const courseUsage = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.values(currentTimetable).forEach((entry: any) => {
            if (entry && entry.course) {
                counts[entry.course] = (counts[entry.course] || 0) + 1;
            }
        });
        return counts;
    }, [currentTimetable]);

    // Charge horaire: count how many slots each teacher has across ALL secondary classrooms
    const chargeHoraire = useMemo(() => {
        if (!localTimetables || selectedClassroomLevel !== 'secondaire') return {};
        const teacherHours: Record<string, number> = {};

        allClassroomsMemo.forEach(classroom => {
            if (!isSecondaireClass(classroom, schoolData as any)) return;
            const timetable = localTimetables[classroom];
            if (!timetable) return;
            Object.values(timetable).forEach((entry: any) => {
                if (entry && entry.teacher) {
                    teacherHours[entry.teacher] = (teacherHours[entry.teacher] || 0) + 1;
                }
            });
        });
        return teacherHours;
    }, [localTimetables, selectedClassroomLevel, allClassroomsMemo, schoolData]);

    const handleUpdateTimetable = useCallback(async (day: string, slotId: string, course: { name: string, teacher?: string } | null) => {
        if (!selectedClassroom || !schoolData || !localTimetables) return;

        // Optimistic update: modify local state immediately (no re-fetch, no focus loss)
        const updatedTimetables = JSON.parse(JSON.stringify(localTimetables));
        if (!updatedTimetables[selectedClassroom]) {
            updatedTimetables[selectedClassroom] = {};
        }

        const key = `${day}_${slotId}`;
        if (course) {
            const courseToSave: TimetableEntry = {
                course: course.name,
            };
            if (selectedClassroomLevel === 'secondaire') {
                // For secondaire: use the teacher from courseTeacherMap (single teacher per course)
                courseToSave.teacher = course.teacher || courseTeacherMap[course.name];
            } else if (classroomTitular) {
                courseToSave.teacher = `${classroomTitular.firstName} ${classroomTitular.lastName}`;
            }
            updatedTimetables[selectedClassroom][key] = courseToSave;
        } else {
            delete updatedTimetables[selectedClassroom][key];
        }

        // Update local state immediately (optimistic)
        setLocalTimetables(updatedTimetables);
        setIsSaving(true);

        const result = await saveTimetable(schoolData.matricule, updatedTimetables);
        setIsSaving(false);
        if (!result.success) {
            toast.error('Impossible de sauvegarder l\'horaire.');
            // Revert on failure
            refreshData();
        }
    }, [selectedClassroom, schoolData, localTimetables, selectedClassroomLevel, classroomTitular, courseTeacherMap, refreshData]);

    const handleCopyTimetable = useCallback(async (sourceClassroom: string) => {
        if (!sourceClassroom || !selectedClassroom || !localTimetables) {
            toast.error('Classe source invalide ou horaire source vide.');
            return;
        }

        const sourceTimetable = localTimetables[sourceClassroom];
        if (!sourceTimetable) return;

        const updatedTimetables = JSON.parse(JSON.stringify(localTimetables));
        updatedTimetables[selectedClassroom] = { ...sourceTimetable };

        toast.info(`Application de l'horaire de ${sourceClassroom} à ${selectedClassroom}...`);

        setLocalTimetables(updatedTimetables);
        setIsSaving(true);

        const result = await saveTimetable(schoolData!.matricule, updatedTimetables);
        setIsSaving(false);
        if (result.success) {
            toast.success('Horaire copié avec succès.');
        } else {
            toast.error('La copie de l\'horaire a échoué.');
            refreshData();
        }
    }, [selectedClassroom, localTimetables, schoolData, refreshData]);

    const handleCellClick = useCallback((day: string, slotId: string) => {
        const key = `${day}_${slotId}`;
        if (currentTimetable[key]) {
            handleUpdateTimetable(day, slotId, null);
        } else if (selectedCourse) {
            handleUpdateTimetable(day, slotId, selectedCourse);
            setSelectedCourse(null);
        }
    }, [currentTimetable, selectedCourse, handleUpdateTimetable]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, course: { name: string, teacher?: string }) => {
        e.dataTransfer.setData("application/json", JSON.stringify(course));
        setSelectedCourse(course);
    };

    const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>) => {
        e.preventDefault();
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLTableCellElement>, day: string, slotId: string) => {
        e.preventDefault();
        const courseJSON = e.dataTransfer.getData("application/json");
        if (courseJSON) {
            const course = JSON.parse(courseJSON);
            handleUpdateTimetable(day, slotId, course);
            setSelectedCourse(null);
        }
    }, [handleUpdateTimetable]);

    const timetableSources = useMemo(() => {
        if (!selectedClassroom || !localTimetables) return [];
        return allClassroomsMemo.filter(name =>
            name !== selectedClassroom &&
            localTimetables[name] &&
            Object.keys(localTimetables[name]).length > 0
        );
    }, [selectedClassroom, localTimetables, allClassroomsMemo]);

    if (layoutLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!schoolData) {
        return <p>Impossible de charger les données de l'école.</p>;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-headline font-bold">Gestion des Horaires</h1>
                <p className="text-muted-foreground">Créez, consultez et optimisez les horaires de cours.</p>
            </div>

            {Object.keys(conflicts).length > 0 && selectedClassroomLevel === 'secondaire' && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Conflits d'horaires détectés !</AlertTitle>
                    <AlertDescription>
                        Un ou plusieurs enseignants sont assignés à plusieurs classes en même temps. Les cours en conflit sont surlignés en rouge.
                    </AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Horaire de la semaine</CardTitle>
                                <CardDescription>Sélectionnez un local pour voir ou modifier son horaire.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                                <div className="w-72">
                                    <Select value={selectedClassroom || ''} onValueChange={setSelectedClassroom}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choisir un local..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredClassrooms.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Level Toggle */}
                        {availableLevels.length > 1 && (
                            <div className="flex justify-center">
                                <div className="inline-flex items-center rounded-xl bg-muted/50 p-1 shadow-inner">
                                    {availableLevels.map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setSelectedLevel(level)}
                                            className={cn(
                                                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 capitalize",
                                                selectedLevel === level
                                                    ? "bg-gradient-to-r from-teal-400 to-cyan-400 text-white shadow-md"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedClassroom && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <span className="font-semibold">Titulaire:</span>
                            <span>{classroomTitular ? `${classroomTitular.firstName} ${classroomTitular.lastName}` : 'Aucun titulaire assigné'}</span>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {selectedClassroom ? (
                        <div className={cn("grid grid-cols-1 gap-6", !readOnly && "lg:grid-cols-4")}>
                            {!readOnly && (
                            <div className="lg:col-span-1 space-y-6">
                                <div>
                                    <h3 className="font-headline font-semibold mb-2">Cours disponibles</h3>
                                    <p className="text-xs text-muted-foreground mb-4">Cliquez sur un cours pour le sélectionner, puis cliquez sur une case vide pour le placer. Ou glissez-déposez.</p>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                        {classroomCourses.map((courseName, courseIndex) => {
                                            const teacherName = selectedClassroomLevel === 'secondaire' ? courseTeacherMap[courseName] : undefined;
                                            const course = { name: courseName, teacher: teacherName };
                                            return (
                                                <div key={`${courseIndex}-${courseName}`} draggable onDragStart={(e) => handleDragStart(e, course)} onClick={() => setSelectedCourse(course)}
                                                    className={cn("flex items-center justify-between p-2 rounded-md border cursor-grab active:cursor-grabbing",
                                                        selectedCourse?.name === courseName ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted')}>
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                                                        <div>
                                                            <span className="font-medium text-sm">{courseName}</span>
                                                            {selectedClassroomLevel === 'secondaire' && (
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {teacherName ? getTeacherShortName(teacherName) : 'Non assigné'}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px]">{courseUsage[courseName] || 0}</Badge>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {timetableSources.length > 0 && (
                                    <div className="border-t pt-4">
                                        <h3 className="font-headline font-semibold mb-2 text-sm">Outils</h3>
                                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                                            <Copy className="h-4 w-4 text-primary" />
                                            <div className="flex-1">
                                                <p className="text-[10px] font-medium">Copier un horaire</p>
                                                <Select onValueChange={handleCopyTimetable}>
                                                    <SelectTrigger className="h-7 text-xs mt-1">
                                                        <SelectValue placeholder="Choisir une classe..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {timetableSources.map(source => (
                                                            <SelectItem key={source} value={source} className="text-xs">{source}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Charge horaire section (Secondaire only) */}
                                {selectedClassroomLevel === 'secondaire' && Object.keys(chargeHoraire).length > 0 && (
                                    <div className="border-t pt-4">
                                        <h3 className="font-headline font-semibold mb-2 text-sm flex items-center gap-1.5">
                                            <Clock className="h-4 w-4 text-primary" />
                                            Charge horaire
                                        </h3>
                                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                                            {Object.entries(chargeHoraire)
                                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                                .map(([teacher, hours]) => (
                                                    <div key={teacher} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                                                        <span className="truncate font-medium">{getTeacherShortName(teacher)}</span>
                                                        <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{hours as number}h</Badge>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}

                            </div>
                            )}

                            <div className={cn("overflow-x-auto", !readOnly && "lg:col-span-3")}>
                                <Table className="border">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px] font-bold text-center bg-muted/50 text-xs text-primary">Heure</TableHead>
                                            {days.map(day => <TableHead key={day} className="font-bold text-center text-xs text-primary">{day}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {timeSlots.map(slot => (
                                            <TableRow key={slot.id}>
                                                <TableCell className="font-medium text-center align-middle bg-muted/50 h-20">
                                                    <Badge variant={slot.type === 'recreation' ? 'default' : 'secondary'} className="text-[10px] px-1">
                                                        {slot.label}
                                                    </Badge>
                                                    <p className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">{slot.value}</p>
                                                </TableCell>
                                                {days.map(day => {
                                                    const key = `${day}_${slot.id}`;

                                                    if (slot.type === 'recreation' || slot.type === 'end') {
                                                        return (
                                                            <TableCell key={day} className="bg-muted/30 text-center align-middle text-muted-foreground text-[10px] italic">
                                                                {slot.label}
                                                            </TableCell>
                                                        )
                                                    }

                                                    const event = currentTimetable[key];
                                                    const conflictKey = `${event?.teacher}_${key}`;
                                                    const isConflict = selectedClassroomLevel === 'secondaire' && conflicts[conflictKey]?.includes(selectedClassroom as string);

                                                    return (
                                                        <TableCell
                                                            key={key}
                                                            className={cn(
                                                                "h-20 p-1 align-top transition-colors",
                                                                !readOnly && "cursor-pointer hover:bg-primary/5",
                                                                !readOnly && selectedCourse && !event && "bg-green-100/50",
                                                                isConflict && "bg-destructive/10 ring-1 ring-destructive"
                                                            )}
                                                            onClick={readOnly ? undefined : () => handleCellClick(day, slot.id)}
                                                            onDragOver={readOnly ? undefined : handleDragOver}
                                                            onDrop={readOnly ? undefined : (e) => handleDrop(e, day, slot.id)}
                                                        >
                                                            {event ? (
                                                                <div className="p-1 rounded-md bg-white border border-primary/20 shadow-sm h-full flex flex-col justify-center">
                                                                    <p className="font-bold text-[10px] leading-tight text-primary text-center uppercase">{event.course}</p>
                                                                    {event.teacher && <p className="text-[9px] text-muted-foreground text-center mt-0.5">{getTeacherShortName(event.teacher)}</p>}
                                                                </div>
                                                            ) : (
                                                                <div className="h-full w-full"></div>
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">Veuillez sélectionner un local pour afficher l'horaire.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
