"use client";

import { useEffect, useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
    Check, 
    X, 
    Clock, 
    Calendar as CalendarIcon,
    Save,
    Loader2,
    Users
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { getInitials, matchTeacherName } from "@/lib/utils";
import { toast } from "sonner";
import { SmartStudentName } from "@/components/ui/SmartStudentName";
import { useStudentDisplay } from "@/components/providers/StudentDisplayProvider";

type AttendanceStatus = "PRESENT" | "ABSENCE" | "LATE";

export default function AttendancePage() {
    const { schoolData, user, isLoading } = useSchoolData();
    const { globalDisplayMode, setGlobalDisplayMode } = useStudentDisplay();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClassroomName, setSelectedClassroomName] = useState("");
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [isSaving, setIsSaving] = useState(false);

    const assignedCourses = useMemo(() => {
        try {
            return JSON.parse(user?.profile?.assignedCourses || "[]");
        } catch {
            return [];
        }
    }, [user]);

    const availableClassrooms = useMemo(() => {
        const timetables = schoolData?.timetables || {};
        const teacherProfileName = user?.name || "";
        const classrooms = new Set<string>();
        
        if (user?.profile?.assignedClassroom) {
            classrooms.add(user.profile.assignedClassroom);
        }

        assignedCourses.forEach((assignment: any) => {
            if (typeof assignment === 'object' && assignment !== null) {
                if (assignment.classroom) classrooms.add(assignment.classroom);
            }
        });

        Object.entries(timetables).forEach(([classroom, slots]: [string, any]) => {
            Object.values(slots || {}).forEach((slot: any) => {
                if (matchTeacherName(teacherProfileName, slot.teacher)) {
                    classrooms.add(classroom);
                }
            });
        });

        return Array.from(classrooms).sort();
    }, [assignedCourses, schoolData, user]);

    useEffect(() => {
        if (availableClassrooms.length > 0 && !selectedClassroomName) {
            setSelectedClassroomName(user?.profile?.assignedClassroom || availableClassrooms[0]);
        }
    }, [availableClassrooms, selectedClassroomName, user]);

    const students = useMemo(() => {
        if (!selectedClassroomName) return [];
        return (schoolData?.students as any[])?.filter(
            (s: any) => s.classroomName === selectedClassroomName
        ) || [];
    }, [schoolData, selectedClassroomName]);

    useEffect(() => {
        if (students.length > 0 && Object.keys(attendance).length === 0) {
            const initial: Record<string, AttendanceStatus> = {};
            students.forEach(s => initial[s.id] = "PRESENT");
            setAttendance(initial);
        }
    }, [students, attendance]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const records = Object.entries(attendance).map(([studentId, type]) => ({
                studentId,
                type,
                description: type === "ABSENCE" ? "Absent à l'appel" : (type === "LATE" ? "Arrivé en retard" : "")
            }));

            const res = await fetch("/api/teacher/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    classroomId: selectedClassroomName, 
                    classroomName: selectedClassroomName,
                    records,
                    schoolMatricule: schoolData?.matricule
                })
            });

            if (res.ok) {
                toast.success("Pointage de présence enregistré !");
            } else {
                toast.error("Erreur lors de l'enregistrement.");
            }
        } catch (error) {
            toast.error("Erreur de connexion.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (availableClassrooms.length === 0) {
        return (
            <div className="glass-card py-16 flex flex-col items-center justify-center text-center">
                <Users className="h-14 w-14 text-muted-foreground/20 mb-4" />
                <p className="font-semibold text-muted-foreground">Aucun local assigné pour le pointage.</p>
            </div>
        );
    }

    const presentCount = Object.values(attendance).filter(v => v === "PRESENT").length;
    const absentCount = Object.values(attendance).filter(v => v === "ABSENCE").length;
    const lateCount = Object.values(attendance).filter(v => v === "LATE").length;

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-2xl font-extrabold tracking-tight">Pointage de Présence</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-sm">Local :</span>
                        <Select value={selectedClassroomName} onValueChange={setSelectedClassroomName}>
                            <SelectTrigger className="w-[180px] h-8 font-bold uppercase rounded-xl border-border/50 text-sm">
                                <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {availableClassrooms.map(c => (
                                    <SelectItem key={c} value={c} className="uppercase font-bold">{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select 
                            value={globalDisplayMode} 
                            onValueChange={(v: any) => setGlobalDisplayMode(v)}
                        >
                            <SelectTrigger className="w-[140px] h-8 rounded-xl border-border/50 text-sm">
                                <SelectValue placeholder="Affichage" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="compact">Noms Courts</SelectItem>
                                <SelectItem value="full">Noms Complets</SelectItem>
                                <SelectItem value="id">Avec Matricule</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="date" 
                            className="pl-9 w-full sm:w-[180px] rounded-xl border-border/50" 
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                    <button onClick={handleSave} disabled={isSaving} className="gradient-btn gap-2 px-5 py-2 rounded-xl text-sm font-bold flex items-center shrink-0">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="hidden sm:inline">Enregistrer</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="stat-card text-center">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{presentCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Présents</p>
                </div>
                <div className="stat-card text-center">
                    <p className="text-2xl font-black text-red-500">{absentCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Absents</p>
                </div>
                <div className="stat-card text-center">
                    <p className="text-2xl font-black text-amber-500">{lateCount}</p>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Retards</p>
                </div>
            </div>

            {/* Student List */}
            <div className="glass-card overflow-hidden p-0">
                <div className="px-5 py-4 tonal-surface-raised">
                    <h3 className="font-extrabold text-sm">Liste d&apos;appel</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Cochez le statut de chaque élève</p>
                </div>
                <div className="divide-y divide-border/30">
                    {students.map((student: any) => (
                        <div key={student.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9 border border-border/30">
                                    <AvatarImage src={student.photo} />
                                    <AvatarFallback className="text-[10px] bg-muted font-bold">{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                </Avatar>
                                <SmartStudentName student={student} className="font-semibold text-sm" />
                            </div>
                            <div className="flex gap-1.5">
                                {/* Present */}
                                <button
                                    onClick={() => handleStatusChange(student.id, "PRESENT")}
                                    className={`h-10 w-10 sm:h-9 sm:w-auto sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                        attendance[student.id] === "PRESENT" 
                                            ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
                                            : "bg-muted/50 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600"
                                    }`}
                                >
                                    <Check className="h-4 w-4" />
                                    <span className="hidden sm:inline">Présent</span>
                                </button>
                                {/* Absent */}
                                <button
                                    onClick={() => handleStatusChange(student.id, "ABSENCE")}
                                    className={`h-10 w-10 sm:h-9 sm:w-auto sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                        attendance[student.id] === "ABSENCE" 
                                            ? "bg-red-500 text-white shadow-md shadow-red-500/20" 
                                            : "bg-muted/50 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                                    }`}
                                >
                                    <X className="h-4 w-4" />
                                    <span className="hidden sm:inline">Absent</span>
                                </button>
                                {/* Late */}
                                <button
                                    onClick={() => handleStatusChange(student.id, "LATE")}
                                    className={`h-10 w-10 sm:h-9 sm:w-auto sm:px-3 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                        attendance[student.id] === "LATE" 
                                            ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                                            : "bg-muted/50 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500"
                                    }`}
                                >
                                    <Clock className="h-4 w-4" />
                                    <span className="hidden sm:inline">Retard</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
