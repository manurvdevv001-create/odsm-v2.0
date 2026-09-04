"use client";

import { useEffect, useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    BookOpen, 
    Users, 
    ChevronRight, 
    LayoutGrid, 
    Loader2
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn, matchTeacherName } from "@/lib/utils";
import { PageHelp } from "@/components/page-help";
import { AssessmentCountIndicator } from "./AssessmentCountIndicator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function TeacherDashboard() {
    const { schoolData, user, isLoading } = useSchoolData();
    const [selectedClassroomMobile, setSelectedClassroomMobile] = useState<string>("all");

    const activePeriod = useMemo(() => {
        const rawLevel = user?.profile?.level?.toLowerCase() || "";
        const level = rawLevel.includes("primaire") ? "primaire" : rawLevel;
        if (!schoolData?.calendar || !level) return null;
        const levelCalendar = (schoolData.calendar as any)[level];
        if (!levelCalendar?.periods) return null;
        const periods = levelCalendar.periods as any[];
        let active = periods.find((p: any) => p.isActive);
        if (!active) {
            const today = new Date().toISOString().split('T')[0];
            active = periods.find((p: any) => p.startDate && p.endDate && today >= p.startDate && today <= p.endDate);
        }
        return active;
    }, [schoolData, user]);

    const assignedCourses = useMemo(() => {
        try {
            return JSON.parse(user?.profile?.assignedCourses || "[]");
        } catch {
            return [];
        }
    }, [user]);

    const coursesByClassroom = useMemo(() => {
        const timetables = schoolData?.timetables || {};
        const teacherProfileName = user?.name || "";
        const groups: Record<string, any[]> = {};

        const addCourseToGroup = (course: any) => {
            // Group by the original classroom name if provided, or fallback to UUID/string
            const displayGroup = course.classroomName || course.classroom || "Non assigné";
            if (!groups[displayGroup]) groups[displayGroup] = [];
            if (!groups[displayGroup].some(c => c.name === course.name)) {
                groups[displayGroup].push(course);
            }
        };

        // 1. Process Structured Assignments from profile
        assignedCourses.forEach((assignment: any) => {
            if (typeof assignment === 'object' && assignment !== null) {
                const classroom = assignment.classroom || "Non assigné";
                (assignment.courses || []).forEach((courseName: string) => {
                        addCourseToGroup({
                            name: courseName,
                            classroom: classroom,
                            grade: (assignment.grade || classroom.split(' ')[0] || "").toUpperCase(),
                            id: `${classroom}-${courseName}`.replace(/\s+/g, '-')
                        });
                });
            } else if (typeof assignment === 'string') {
                const courseName = assignment;
                Object.entries(timetables).forEach(([classroomId, slots]: [string, any]) => {
                    const hasCourse = Object.values(slots).some((slot: any) => {
                        const sCourse = slot.course?.toLowerCase().trim();
                        const sTeacher = slot.teacher;
                        return sCourse === courseName.toLowerCase().trim() && matchTeacherName(teacherProfileName, sTeacher);
                    });

                    if (hasCourse) {
                        const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                        addCourseToGroup({
                            name: courseName,
                            classroom: classroomId,
                            classroomName: cName,
                            grade: (cName.split(' ')[0] || "").toUpperCase(),
                            id: `${classroomId}-${courseName}`.replace(/\s+/g, '-'),
                            isResolved: true
                        });
                    }
                });
            }
        });

        // 2. Safety Fallback: Scan ALL timetables for the teacher's name
        Object.entries(timetables).forEach(([classroomId, slots]: [string, any]) => {
            Object.values(slots).forEach((slot: any) => {
                if (matchTeacherName(teacherProfileName, slot.teacher)) {
                    const courseName = slot.course;
                    if (courseName) {
                        const cName = schoolData?.classrooms?.find((c: any) => c.id === classroomId)?.name || classroomId;
                        addCourseToGroup({
                            name: courseName,
                            classroom: classroomId,
                            classroomName: cName,
                            grade: (cName.split(' ')[0] || "").toUpperCase(),
                            id: `${classroomId}-${courseName}`.replace(/\s+/g, '-'),
                            isResolved: true
                        });
                    }
                }
            });
        });

        // 3. For Primary/Maternelle teachers (Titulaires)
        const roleLevel = user?.profile?.level?.toLowerCase() || "";
        const isTitulaire = roleLevel === "primaire" || roleLevel === "maternelle" || roleLevel === "primaire/maternelle";
        const titulaireClassroom = user?.profile?.assignedClassroom ? String(user.profile.assignedClassroom) : "";

        if (isTitulaire && titulaireClassroom) {
            const classroomSlots = (timetables as Record<string, any>)[titulaireClassroom] || {};
            // Get the display name from schoolData.classrooms if available
            const classroomName = schoolData?.classrooms?.find((c: any) => c.id === titulaireClassroom)?.name || titulaireClassroom;
            const grade = (classroomName.split(' ')[0] || "").toUpperCase();

            Object.values(classroomSlots).forEach((slot: any) => {
                if (slot.course) {
                    addCourseToGroup({
                        name: slot.course,
                        classroom: titulaireClassroom, // pass UUID as the classroom identifier
                        classroomName: classroomName, // new field for UI display
                        grade: grade,
                        id: `${titulaireClassroom}-${slot.course}`.replace(/\s+/g, '-'),
                        isResolved: true
                    });
                }
            });
        }

        return groups;
    }, [assignedCourses, schoolData, user]);

    const sortedClassrooms = useMemo(() => {
        const classrooms = Object.keys(coursesByClassroom);
        const level = user?.profile?.level?.toLowerCase() || "";
        
        if (level.includes("secondaire")) {
            const secondaryOrder = ["7e", "8e", "1e", "2e", "3e", "4e"];
            return classrooms.sort((a, b) => {
                const getGrade = (name: string) => name.split(' ')[0]?.toLowerCase() || "";
                const gradeA = getGrade(a);
                const gradeB = getGrade(b);
                
                const indexA = secondaryOrder.indexOf(gradeA);
                const indexB = secondaryOrder.indexOf(gradeB);
                
                if (indexA !== -1 && indexB !== -1) {
                    if (indexA !== indexB) return indexA - indexB;
                } else if (indexA !== -1) {
                    return -1;
                } else if (indexB !== -1) {
                    return 1;
                }
                
                return a.localeCompare(b);
            });
        }
        
        return classrooms.sort((a, b) => a.localeCompare(b));
    }, [coursesByClassroom, user]);

    if (isLoading) {
        return (
            <div className="flex h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-extrabold tracking-tight">Mes Cours</h2>
                <PageHelp pageId="courses" />
            </div>

            {sortedClassrooms.length > 0 ? (
                <div className="space-y-10">
                    {/* Mobile Dropdown for Secondary */}
                    {user?.profile?.level?.toLowerCase().includes("secondaire") && sortedClassrooms.length > 1 && (
                        <div className="block md:hidden mb-6">
                            <label className="text-sm font-bold text-muted-foreground mb-2 block">Filtrer par local</label>
                            <Select value={selectedClassroomMobile} onValueChange={setSelectedClassroomMobile}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="Tous les locaux" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les locaux</SelectItem>
                                    {sortedClassrooms.map(classroom => (
                                        <SelectItem key={classroom} value={classroom}>{classroom}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {sortedClassrooms
                        .filter(classroomName => selectedClassroomMobile === "all" || selectedClassroomMobile === classroomName || !user?.profile?.level?.toLowerCase().includes("secondaire"))
                        .map((classroomName) => {
                            const courses = coursesByClassroom[classroomName];
                            return (
                                <div key={classroomName} className="space-y-4">
                                    {/* Classroom Header */}
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-1 rounded-full bg-primary/60" />
                                <h3 className="text-base font-extrabold uppercase tracking-wider text-muted-foreground">
                                    Local : <span className="text-foreground">{classroomName}</span>
                                </h3>
                                <Badge className="ml-2 tonal-surface-raised text-xs font-bold text-foreground border-none px-2.5 py-0.5">
                                    {courses.length} {courses.length > 1 ? "Cours" : "Cours"}
                                </Badge>
                            </div>
                            
                            {/* Course Cards Grid */}
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {courses.map((course: any, idx: number) => (
                                    <div key={idx} className="glass-card glass-card-hover group p-0 overflow-hidden">
                                        <div className="p-5 pb-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <Badge className="bg-primary/8 text-primary border-none text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1">
                                                    {course.grade}
                                                </Badge>
                                                <div className="p-2 rounded-lg tonal-surface-raised group-hover:bg-primary/10 transition-colors duration-300">
                                                    <LayoutGrid className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-extrabold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors duration-300">
                                                {course.name}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                <Users className="h-3.5 w-3.5" />
                                                <span>-- Élèves</span>
                                            </div>
                                        </div>
                                        <div className="px-5 pb-5">
                                            <Link href={`/teacher/courses/${course.id}`}>
                                                <button className="w-full gradient-btn py-2.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer">
                                                    Cahier des Côtes <AssessmentCountIndicator courseId={course.id} classroomName={course.classroom} periodId={activePeriod?.id} matricule={schoolData?.matricule} />
                                                    <ChevronRight className="h-4 w-4 ml-auto" />
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                            );
                    })}
                </div>
            ) : (
                <div className="glass-card py-16 flex flex-col items-center justify-center text-center">
                    <BookOpen className="h-14 w-14 text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-bold text-foreground mb-1">Aucun cours assigné</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        Vous n&apos;avez pas encore de cours assignés dans votre profil.
                    </p>
                </div>
            )}
        </div>
    );
}
