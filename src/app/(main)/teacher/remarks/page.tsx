"use client";

import { useEffect, useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
    MessageSquare, 
    Plus, 
    AlertTriangle, 
    Info, 
    History,
    Save,
    Trash2,
    Loader2
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getInitials, matchTeacherName } from "@/lib/utils";
import { toast } from "sonner";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from "@/components/ui/dialog";

export default function RemarksPage() {
    const { schoolData, user, isLoading } = useSchoolData();
    const [selectedClassroomName, setSelectedClassroomName] = useState("");
    const [remarks, setRemarks] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [remarkType, setRemarkType] = useState("OBSERVATION");
    const [severity, setSeverity] = useState("LOW");
    const [description, setDescription] = useState("");

    const assignedCourses = useMemo(() => {
        try { return JSON.parse(user?.profile?.assignedCourses || "[]"); } catch { return []; }
    }, [user]);

    const availableClassrooms = useMemo(() => {
        const timetables = schoolData?.timetables || {};
        const teacherProfileName = user?.name || "";
        const classrooms = new Set<string>();
        if (user?.profile?.assignedClassroom) classrooms.add(user.profile.assignedClassroom);
        assignedCourses.forEach((a: any) => { if (typeof a === 'object' && a?.classroom) classrooms.add(a.classroom); });
        Object.entries(timetables).forEach(([classroom, slots]: [string, any]) => {
            Object.values(slots || {}).forEach((slot: any) => {
                if (matchTeacherName(teacherProfileName, slot.teacher)) classrooms.add(classroom);
            });
        });
        return Array.from(classrooms).sort();
    }, [assignedCourses, schoolData, user]);

    useEffect(() => {
        if (availableClassrooms.length > 0 && !selectedClassroomName)
            setSelectedClassroomName(user?.profile?.assignedClassroom || availableClassrooms[0]);
    }, [availableClassrooms, selectedClassroomName, user]);

    const students = useMemo(() => {
        if (!selectedClassroomName) return [];
        return (schoolData?.students as any[])?.filter((s: any) => s.classroomName === selectedClassroomName) || [];
    }, [schoolData, selectedClassroomName]);

    const fetchRemarks = async () => {
        if (!selectedClassroomName) return;
        setIsFetching(true);
        try {
            const res = await fetch(`/api/teacher/remarks?classroomId=${selectedClassroomName}`);
            if (res.ok) setRemarks(await res.json());
        } catch {} finally { setIsFetching(false); }
    };

    useEffect(() => { if (!isLoading && selectedClassroomName) fetchRemarks(); }, [isLoading, selectedClassroomName]);

    const handleSaveRemark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId || !description) { toast.error("Veuillez remplir tous les champs."); return; }
        setIsSaving(true);
        try {
            const res = await fetch("/api/teacher/remarks", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId: selectedStudentId, type: remarkType, severity, description, schoolMatricule: schoolData?.matricule })
            });
            if (res.ok) { toast.success("Remarque enregistrée !"); setIsDialogOpen(false); setDescription(""); setSelectedStudentId(""); fetchRemarks(); }
            else toast.error("Erreur lors de l'enregistrement.");
        } catch { toast.error("Erreur de connexion."); } finally { setIsSaving(false); }
    };

    const handleDeleteRemark = async (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer cette remarque ?")) return;
        try {
            const res = await fetch(`/api/teacher/remarks?id=${id}`, { method: "DELETE" });
            if (res.ok) { toast.success("Remarque supprimée."); fetchRemarks(); }
            else toast.error("Erreur lors de la suppression.");
        } catch { toast.error("Erreur de connexion."); }
    };

    if (isLoading) return <div className="flex h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (availableClassrooms.length === 0) {
        return (
            <div className="glass-card py-16 flex flex-col items-center justify-center text-center">
                <MessageSquare className="h-14 w-14 text-muted-foreground/20 mb-4" />
                <p className="font-semibold text-muted-foreground">Aucun local assigné pour le suivi.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-2xl font-extrabold tracking-tight">Suivi & Remarques</h1>
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
                    </div>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <button className="gradient-btn gap-2 px-5 py-2.5 rounded-xl text-sm font-bold flex items-center cursor-pointer">
                            <Plus className="h-4 w-4" /> Nouvelle Remarque
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] rounded-2xl">
                        <form onSubmit={handleSaveRemark}>
                            <DialogHeader>
                                <DialogTitle className="font-extrabold">Ajouter une remarque</DialogTitle>
                                <DialogDescription>Enregistrez une observation académique ou disciplinaire.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="student">Élève <span className="text-red-500">*</span></Label>
                                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                        <SelectTrigger id="student" className="rounded-xl"><SelectValue placeholder="Choisir un élève..." /></SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            {students.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.lastName} {s.firstName}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Type</Label>
                                        <Select value={remarkType} onValueChange={setRemarkType}>
                                            <SelectTrigger id="type" className="rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="OBSERVATION">Observation</SelectItem>
                                                <SelectItem value="SANCTION">Sanction</SelectItem>
                                                <SelectItem value="LATE">Retard</SelectItem>
                                                <SelectItem value="ABSENCE">Absence Justifiée</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="severity">Sévérité</Label>
                                        <Select value={severity} onValueChange={setSeverity}>
                                            <SelectTrigger id="severity" className="rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="LOW">Faible</SelectItem>
                                                <SelectItem value="MEDIUM">Moyenne</SelectItem>
                                                <SelectItem value="HIGH">Grave</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Commentaire <span className="text-red-500">*</span></Label>
                                    <Textarea id="description" placeholder="Décrivez l'incident..." rows={4} value={description}
                                        onChange={e => setDescription(e.target.value)} required className="rounded-xl" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Annuler</Button>
                                <button type="submit" disabled={isSaving} className="gradient-btn px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                                </button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Remarks Feed */}
            <div className="glass-card overflow-hidden p-0">
                <div className="px-5 py-4 tonal-surface-raised flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <h3 className="font-extrabold text-sm">Historique des remarques</h3>
                </div>
                
                {isFetching ? (
                    <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/30" /></div>
                ) : remarks.length > 0 ? (
                    <div className="space-y-0">
                        {remarks.map((remark) => (
                            <div key={remark.id} className="p-5 hover:bg-muted/10 transition-colors flex gap-4">
                                <Avatar className="h-10 w-10 border border-border/20 shrink-0">
                                    <AvatarImage src={remark.student?.photo} />
                                    <AvatarFallback className="text-[10px] bg-muted font-bold">{getInitials(remark.student?.firstName || "", remark.student?.lastName || "")}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow space-y-2 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-bold text-sm truncate">{remark.student?.lastName} {remark.student?.firstName}</span>
                                            <span className="text-[10px] text-muted-foreground/50">•</span>
                                            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                                {new Date(remark.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge className={`text-[10px] uppercase font-extrabold border-none ${
                                                remark.type === 'SANCTION' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 
                                                remark.type === 'OBSERVATION' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 
                                                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                            }`}>
                                                {remark.type}
                                            </Badge>
                                            <button onClick={() => handleDeleteRemark(remark.id)} className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-foreground/80 leading-relaxed italic pl-3 py-1.5 tonal-surface-raised rounded-lg">
                                        &quot;{remark.description}&quot;
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                        {remark.severity === 'HIGH' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                                        {remark.severity === 'MEDIUM' && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                        {remark.severity === 'LOW' && <Info className="h-3 w-3 text-blue-500" />}
                                        SÉVÉRITÉ : {remark.severity === 'HIGH' ? 'GRAVE' : remark.severity === 'MEDIUM' ? 'MOYENNE' : 'FAIBLE'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center flex flex-col items-center justify-center">
                        <MessageSquare className="h-14 w-14 text-muted-foreground/15 mb-4" />
                        <p className="text-base font-bold text-muted-foreground/50">Aucune remarque enregistrée.</p>
                        <p className="text-xs text-muted-foreground/30 mt-1">Les observations apparaîtront ici.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
