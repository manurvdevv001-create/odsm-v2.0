"use client";

import { useState, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getAllGrades, getClassroomsByGrade } from "@/lib/classroom-utils";

interface StudentTransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: any;
    onSuccess?: () => void;
}

export function StudentTransferDialog({ open, onOpenChange, student, onSuccess }: StudentTransferDialogProps) {
    const { schoolData } = useSchoolData() as any;
    const [submitting, setSubmitting] = useState(false);
    const [transferType, setTransferType] = useState<string>("CORRECTION");
    const [targetGradeName, setTargetGradeName] = useState<string>("");
    const [targetClassroomName, setTargetClassroomName] = useState<string>("");
    const [reason, setReason] = useState<string>("");

    const availableGrades = useMemo(() => {
        if (!schoolData?.levels) return [];
        return getAllGrades(schoolData);
    }, [schoolData]);

    const availableClassrooms = useMemo(() => {
        if (!targetGradeName || !schoolData?.levels || !schoolData?.structure) return [];
        for (const level of Object.keys(schoolData.levels)) {
            if (!schoolData.levels[level]) continue;
            const classrooms = getClassroomsByGrade(level, targetGradeName, schoolData);
            if (classrooms.length > 0) return classrooms;
        }
        return [];
    }, [targetGradeName, schoolData]);

    // Handle initial state setup when dialog opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            setTransferType("CORRECTION");
            setTargetGradeName("");
            setTargetClassroomName("");
            setReason("");
        }
        onOpenChange(isOpen);
    };

    const handleTransfer = async () => {
        if (!targetGradeName || !targetClassroomName || !reason.trim()) {
            toast.error("Veuillez remplir tous les champs obligatoires.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/student-transfer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: student.id,
                    targetGradeName,
                    targetClassroomName,
                    transferType,
                    reason,
                    executorName: "Administrateur" // Simplification
                })
            });

            if (res.ok) {
                toast.success("Transfert effectué avec succès.");
                onOpenChange(false);
                if (onSuccess) onSuccess();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors du transfert.");
            }
        } catch (e) {
            toast.error("Erreur réseau.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        Transférer l'élève
                    </DialogTitle>
                    <DialogDescription>
                        Déplacer cet élève vers une autre classe en cours d'année. L'historique, les paiements et le matricule seront conservés.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Local Actuel</Label>
                        <div className="p-2 bg-muted/50 rounded-md border text-sm font-semibold">
                            {student.classroomName || "Aucun (En attente)"} - {student.gradeName}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="after:content-['*'] after:ml-0.5 after:text-red-500">Type de Transfert</Label>
                        <Select value={transferType} onValueChange={setTransferType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez le type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CORRECTION">Correction d'inscription (Erreur initiale)</SelectItem>
                                <SelectItem value="SECTION_CHANGE">Changement de section / option</SelectItem>
                                <SelectItem value="PROMOTION">Promotion en cours d'année</SelectItem>
                                <SelectItem value="DEMOTION">Démotion en cours d'année</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="after:content-['*'] after:ml-0.5 after:text-red-500">Classe Nominale de Destination</Label>
                        <Select value={targetGradeName} onValueChange={(v) => { setTargetGradeName(v); setTargetClassroomName(""); }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionnez la classe nominale" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableGrades.map((grade: string) => (
                                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="after:content-['*'] after:ml-0.5 after:text-red-500">Local de Destination</Label>
                        <Select 
                            value={targetClassroomName} 
                            onValueChange={setTargetClassroomName}
                            disabled={!targetGradeName || availableClassrooms.length === 0}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={
                                    !targetGradeName ? "Sélectionnez d'abord la classe nominale" 
                                    : availableClassrooms.length === 0 ? "Aucun local disponible" 
                                    : "Sélectionnez le local"
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {availableClassrooms.map((c: any) => (
                                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="after:content-['*'] after:ml-0.5 after:text-red-500">Raison détaillée</Label>
                        <Textarea 
                            value={reason} 
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Veuillez expliquer la raison de ce transfert..."
                            className="resize-none"
                            rows={3}
                        />
                    </div>
                    
                    {transferType !== 'CORRECTION' && (
                        <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200 text-xs">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                                Ce type de transfert sera noté dans l'historique de l'élève. Ses résultats académiques de la période en cours seront perdus s'il change de niveau académique (démotion/promotion).
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Annuler
                    </Button>
                    <Button onClick={handleTransfer} disabled={submitting || !targetGradeName || !targetClassroomName || !reason.trim()}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Valider le transfert
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
