"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Clock, ListTodo, Loader2, Plus, Trash2 } from "lucide-react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { matchTeacherName } from "@/lib/utils";
import { getClassroomLevel } from "@/lib/classroom-utils";

type Assignment = { id: string; name: string; classroomId: string; classroomName: string; level: string };
type Period = { id: string; name: string; type?: string; startDate?: string; endDate?: string; isActive?: boolean };
type Classroom = { id: string; name: string; level?: string };
type AssessmentRecord = { id: string; title: string; type: string; date: string; maxScore: number; pondere?: number | null };
type AssignmentInput = { classroom?: string; level?: string; courses?: string[] };
type AcademicLevel = "maternelle" | "primaire" | "secondaire";

export default function AssessmentPlanningPage() {
    const { user, schoolData } = useSchoolData();
    const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
    const [selectedPeriodId, setSelectedPeriodId] = useState("");
    const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ title: "", type: "Devoir", date: "", maxScore: "20", pondere: "20" });

    const assignments = useMemo<Assignment[]>(() => {
        const result: Assignment[] = [];
        const classrooms = (schoolData?.classrooms as Classroom[] | undefined) || [];
        const timetables = (schoolData?.timetables || {}) as Record<string, Record<string, any>>;
        const teacherName = user?.name || "";
        const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const findClassroom = (ref: string) => classrooms.find(item =>
            item.id === ref || normalize(item.name) === normalize(ref)
        );
        const addAssignment = (courseName: string, classroomRef: string, level?: string) => {
            const classroom = findClassroom(classroomRef);
            const classroomId = classroom?.id || classroomRef;
            if (!courseName || !classroomId) return;
            const id = `${classroomId}-${courseName}`;
            if (result.some(item => item.id === id)) return;
            result.push({
                id,
                name: courseName,
                classroomId,
                classroomName: classroom?.name || classroomRef,
                level: getClassroomLevel(classroom?.name || classroomRef, schoolData) || classroom?.level || level || ""
            });
        };

        let raw: unknown[] = [];
        try {
            raw = JSON.parse(user?.profile?.assignedCourses || "[]") as unknown[];
        } catch {
            raw = [];
        }

        raw.forEach(value => {
            if (typeof value === "string") {
                Object.entries(timetables).forEach(([classroomRef, slots]) => {
                    Object.values(slots).forEach(slot => {
                        if (slot?.course && normalize(slot.course) === normalize(value) &&
                            matchTeacherName(teacherName, slot.teacher)) {
                            addAssignment(value, classroomRef);
                        }
                    });
                });
                return;
            }
            const assignment = value as AssignmentInput;
            if (!assignment || typeof assignment !== "object") return;
            const classroomRef = String(assignment.classroom || "");
            (assignment.courses || []).forEach(name => addAssignment(name, classroomRef, assignment.level));
        });

        // The timetable is authoritative for secondary teachers and also resolves
        // assignments stored with a classroom name instead of its UUID.
        Object.entries(timetables).forEach(([classroomRef, slots]) => {
            Object.values(slots).forEach(slot => {
                if (slot?.course && matchTeacherName(teacherName, slot.teacher)) {
                    addAssignment(slot.course, classroomRef);
                }
            });
        });

        const assignedClassroom = String(user?.profile?.assignedClassroom || "");
        const level = String(user?.profile?.level || "").toLowerCase();
        if (assignedClassroom && (level.includes("primaire") || level.includes("maternelle"))) {
            const classroomRef = findClassroom(assignedClassroom)?.id || assignedClassroom;
            Object.values(timetables[classroomRef] || timetables[assignedClassroom] || {}).forEach(slot => {
                if (slot?.course) addAssignment(slot.course, classroomRef, level);
            });
        }

        return result;
    }, [schoolData?.classrooms, schoolData?.timetables, user]);

    const selectedAssignment = assignments.find(item => item.id === selectedAssignmentId);
    const periods = useMemo<Period[]>(() => {
        if (!selectedAssignment) return [];
        const level = String(selectedAssignment.level || "").toLowerCase();
        const calendar = schoolData?.calendar || {};
        const calendarLevel: AcademicLevel | null =
            level.includes("maternelle") ? "maternelle" :
            level.includes("primaire") ? "primaire" :
            level.includes("secondaire") ? "secondaire" :
            getClassroomLevel(selectedAssignment.classroomName, schoolData);
        if (!calendarLevel) return [];
        return Array.isArray(calendar[calendarLevel]?.periods)
            ? calendar[calendarLevel].periods
            : [];
    }, [schoolData, selectedAssignment]);

    useEffect(() => {
        if (!selectedAssignmentId && assignments[0]) setSelectedAssignmentId(assignments[0].id);
    }, [assignments, selectedAssignmentId]);

    useEffect(() => {
        const active = periods.find(period => period.isActive) || periods[0];
        if (active) {
            if (!periods.some(period => period.id === selectedPeriodId)) setSelectedPeriodId(active.id);
        } else {
            setSelectedPeriodId("");
        }
    }, [periods, selectedPeriodId]);

    const fetchAssessments = async () => {
        if (!selectedAssignment || !selectedPeriodId || !schoolData?.matricule) return;
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                courseId: selectedAssignment.id,
                classroomId: selectedAssignment.classroomId,
                periodId: selectedPeriodId,
                matricule: schoolData.matricule
            });
            const response = await fetch(`/api/teacher/grades?${params}`, { cache: "no-store" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Chargement impossible.");
            setAssessments(data.assessments || []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Chargement impossible.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAssessments();
    }, [selectedAssignmentId, selectedPeriodId, schoolData?.matricule]);

    const saveAssessment = async () => {
        if (!selectedAssignment || !selectedPeriodId || !form.title || !form.date) {
            toast.error("Renseignez le titre, la date et la période.");
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch(editingId ? "/api/teacher/grades" : "/api/teacher/grades", {
                method: editingId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    ...(editingId ? { assessmentId: editingId } : {}),
                    maxScore: Number(form.maxScore),
                    pondere: Number(form.pondere),
                    courseId: selectedAssignment.id,
                    classroomId: selectedAssignment.classroomId,
                    periodId: selectedPeriodId,
                    schoolMatricule: schoolData?.matricule,
                    source: "planning"
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Création impossible.");
            toast.success(editingId ? "Épreuve modifiée." : "Épreuve confirmée et ajoutée à la période.");
            setForm({ title: "", type: "Devoir", date: "", maxScore: "20", pondere: "20" });
            setEditingId(null);
            await fetchAssessments();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Création impossible.");
        } finally {
            setIsSaving(false);
        }
    };

    const startEditing = (assessment: AssessmentRecord) => {
        setEditingId(assessment.id);
        setForm({
            title: assessment.title,
            type: assessment.type,
            date: assessment.date.slice(0, 10),
            maxScore: String(assessment.maxScore),
            pondere: String(assessment.pondere ?? assessment.maxScore)
        });
    };

    const deleteAssessment = async (assessmentId: string) => {
        const response = await fetch(`/api/teacher/grades?assessmentId=${assessmentId}&source=planning`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
            toast.error(data.error || "Suppression impossible.");
            return;
        }
        toast.success("Épreuve supprimée.");
        await fetchAssessments();
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight md:text-3xl">
                    <CalendarIcon className="h-7 w-7 text-primary" /> Planification des épreuves
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Préparez les épreuves de la période active ou des périodes à venir.</p>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-base">Cours et période</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Cours</Label>
                        <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                            <SelectTrigger><SelectValue placeholder="Sélectionner un cours" /></SelectTrigger>
                            <SelectContent>{assignments.map(item => <SelectItem key={item.id} value={item.id}>{item.classroomName} — {item.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Période</Label>
                        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                            <SelectTrigger><SelectValue placeholder="Sélectionner une période" /></SelectTrigger>
                            <SelectContent>
                                {periods.map(period => (
                                    <SelectItem key={period.id} value={period.id}>
                                        {period.name}{period.isActive ? " — active" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> {editingId ? "Modifier une épreuve" : "Confirmer une épreuve"}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <Input placeholder="Titre de l'épreuve" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <Input placeholder="Type" value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} />
                            <Input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
                            <Input type="number" min="0" placeholder="Max" value={form.maxScore} onChange={event => setForm({ ...form, maxScore: event.target.value })} />
                            <Input type="number" min="0" placeholder="Pondération" value={form.pondere} onChange={event => setForm({ ...form, pondere: event.target.value })} />
                        </div>
                        <Button className="w-full" onClick={saveAssessment} disabled={isSaving || !selectedAssignment}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {editingId ? "Enregistrer les modifications" : "Confirmer la création"}
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4" /> Épreuves confirmées</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : assessments.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucune épreuve confirmée pour cette période.</p> : assessments.map(assessment => (
                            <div key={assessment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                                <div><div className="font-semibold">{assessment.title}</div><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">{assessment.type}</Badge><span>Max : {assessment.maxScore}</span><span>Pondération : {assessment.pondere ?? assessment.maxScore}</span><span><Clock className="mr-1 inline h-3 w-3" />{new Date(assessment.date).toLocaleDateString("fr-FR")}</span></div></div>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => startEditing(assessment)}>Modifier</Button>
                                    <Button variant="ghost" size="icon" onClick={() => deleteAssessment(assessment.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
