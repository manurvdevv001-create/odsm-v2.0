"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, UserPlus, UserMinus, Search, ArrowRight, Users } from "lucide-react";
import { toast } from "sonner";
import { bulkAssignStudents, bulkUnassignStudents } from "./actions";
import type { Student } from "@/types";
import Link from "next/link";
import { SmartStudentName } from "@/components/ui/SmartStudentName";
import { useStudentDisplay } from "@/components/providers/StudentDisplayProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";
import { sortStudentList, StudentSortOption } from "@/lib/student-sort";

interface BulkAssignmentPanelProps {
    classroomName: string;
    students: Student[];
    allStudents: Student[];
    matricule: string;
    executorName: string;
    onComplete: () => void;
}

export default function BulkAssignmentPanel({
    classroomName,
    students,
    allStudents,
    matricule,
    executorName,
    onComplete,
}: BulkAssignmentPanelProps) {
    // Unassign state
    const [selectedForUnassign, setSelectedForUnassign] = useState<Set<string>>(new Set());
    const [confirmUnassignOpen, setConfirmUnassignOpen] = useState(false);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    // Assign dialog state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [selectedForAssign, setSelectedForAssign] = useState<Set<string>>(new Set());
    const [assignSearch, setAssignSearch] = useState("");
    
    const { globalDisplayMode, setGlobalDisplayMode } = useStudentDisplay();
    const [sortOption, setSortOption] = useState<StudentSortOption>("alpha-asc");

    const sortedStudents = useMemo(() => {
        return sortStudentList(students, sortOption);
    }, [students, sortOption]);

    // Waiting list: active students with no classroom + students pending enrollment (new year)
    const waitingListStudents = useMemo((): Student[] => {
        if (!allStudents || allStudents.length === 0) return [];
        return allStudents.filter(
            (s) => (s.status === "active" || s.status === "pending_enrollment") && !s.classroomName
        );
    }, [allStudents]);


    const filteredWaitingList = useMemo(() => {
        if (!assignSearch.trim()) return waitingListStudents;
        const term = assignSearch.toLowerCase();
        return waitingListStudents.filter(
            (s) =>
                `${s.lastName} ${s.firstName} ${s.middleName || ""}`.toLowerCase().includes(term) ||
                s.matricule?.toLowerCase().includes(term) ||
                s.gradeName?.toLowerCase().includes(term)
        );
    }, [waitingListStudents, assignSearch]);

    // Toggle selection helpers
    const toggleUnassign = (id: string) => {
        setSelectedForUnassign((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllUnassign = () => {
        if (selectedForUnassign.size === students.length) {
            setSelectedForUnassign(new Set());
        } else {
            setSelectedForUnassign(new Set(students.map((s) => s.id)));
        }
    };

    const toggleAssign = (id: string) => {
        setSelectedForAssign((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllAssign = () => {
        if (selectedForAssign.size === filteredWaitingList.length) {
            setSelectedForAssign(new Set());
        } else {
            setSelectedForAssign(new Set(filteredWaitingList.map((s) => s.id)));
        }
    };

    // Bulk actions
    const handleBulkUnassign = async () => {
        if (selectedForUnassign.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const res = await bulkUnassignStudents(
                matricule,
                classroomName,
                Array.from(selectedForUnassign),
                executorName
            );
            if (res.success) {
                toast.success(`${res.count} élève(s) désaffecté(s) et renvoyé(s) en liste d'attente.`);
                setSelectedForUnassign(new Set());
                onComplete();
            } else {
                toast.error(res.error || "Erreur lors de la désaffectation.");
            }
        } catch {
            toast.error("Erreur de connexion au serveur.");
        } finally {
            setIsBulkProcessing(false);
            setConfirmUnassignOpen(false);
        }
    };

    const handleBulkAssign = async () => {
        if (selectedForAssign.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const res = await bulkAssignStudents(
                matricule,
                classroomName,
                Array.from(selectedForAssign),
                executorName
            );
            if (res.success) {
                toast.success(`${res.count} élève(s) affecté(s) au local ${classroomName}.`);
                setSelectedForAssign(new Set());
                setAssignDialogOpen(false);
                onComplete();
            } else {
                toast.error(res.error || "Erreur lors de l'affectation.");
            }
        } catch {
            toast.error("Erreur de connexion au serveur.");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    return (
        <>
            {/* Students Table Card with bulk unassign */}
            <Card className="border-none shadow-md flex flex-col h-full">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Users className="h-5 w-5 text-blue-500" />
                                Liste des Élèves
                            </CardTitle>
                            <CardDescription>Élèves inscrits dans ce local pour l&apos;année en cours.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 print:hidden">
                            <Select 
                                value={globalDisplayMode} 
                                onValueChange={(v: any) => setGlobalDisplayMode(v)}
                            >
                                <SelectTrigger className="w-[130px] h-9 rounded-xl border-border/50 text-xs">
                                    <SelectValue placeholder="Affichage" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="compact">Noms Courts</SelectItem>
                                    <SelectItem value="full">Noms Complets</SelectItem>
                                    <SelectItem value="id">Avec Matricule</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select 
                                value={sortOption} 
                                onValueChange={(v: any) => setSortOption(v)}
                            >
                                <SelectTrigger className="w-[145px] h-9 rounded-xl border-border/50 text-xs font-semibold">
                                    <SelectValue placeholder="Tri" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="alpha-asc">Nom (A → Z)</SelectItem>
                                    <SelectItem value="alpha-desc">Nom (Z → A)</SelectItem>
                                    <SelectItem value="matricule-asc">Matricule (Croissant)</SelectItem>
                                    <SelectItem value="matricule-desc">Matricule (Décroissant)</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-bold text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => window.print()}
                            >
                                <Printer className="h-4 w-4 mr-1.5" />
                                Imprimer PDF
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => {
                                    setSelectedForAssign(new Set());
                                    setAssignSearch("");
                                    setAssignDialogOpen(true);
                                }}
                            >
                                <UserPlus className="h-4 w-4 mr-1.5" />
                                Affecter
                            </Button>
                            {selectedForUnassign.size > 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="font-bold text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => setConfirmUnassignOpen(true)}
                                    disabled={isBulkProcessing}
                                >
                                    <UserMinus className="h-4 w-4 mr-1.5" />
                                    Désaffecter ({selectedForUnassign.size})
                                </Button>
                            )}
                        </div>
                    </div>
                    {waitingListStudents.length > 0 && (
                        <Badge variant="secondary" className="w-fit mt-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {waitingListStudents.length} élève(s) en liste d&apos;attente
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="flex-1">
                    {students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 opacity-20 mb-3" />
                            <p className="font-medium">Aucun élève trouvé</p>
                            {waitingListStudents.length > 0 && (
                                <Button
                                    variant="link"
                                    className="mt-2 text-emerald-600"
                                    onClick={() => {
                                        setSelectedForAssign(new Set());
                                        setAssignSearch("");
                                        setAssignDialogOpen(true);
                                    }}
                                >
                                    <UserPlus className="h-4 w-4 mr-1" />
                                    Affecter des élèves depuis la liste d&apos;attente
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedForUnassign.size === sortedStudents.length && sortedStudents.length > 0}
                                                onCheckedChange={toggleAllUnassign}
                                            />
                                        </TableHead>
                                        <TableHead className="w-12 font-bold">#</TableHead>
                                        <TableHead className="font-bold">Nom de l&apos;Élève</TableHead>
                                        <TableHead className="text-right font-bold">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedStudents.map((student, idx) => (
                                        <TableRow
                                            key={student.id}
                                            className={`group hover:bg-muted/30 ${selectedForUnassign.has(student.id) ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedForUnassign.has(student.id)}
                                                    onCheckedChange={() => toggleUnassign(student.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-muted-foreground font-medium">{idx + 1}</TableCell>
                                            <TableCell className="font-bold">
                                                <SmartStudentName student={student} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Link href={`/students/${student.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-8 font-bold text-primary hover:bg-primary/5">
                                                        Profil
                                                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Confirm Unassign Dialog */}
            <AlertDialog open={confirmUnassignOpen} onOpenChange={setConfirmUnassignOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <UserMinus className="h-5 w-5" />
                            Désaffectation Collective
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Vous allez retirer <strong>{selectedForUnassign.size} élève(s)</strong> du local <strong>{classroomName}</strong>.
                            Ils seront renvoyés en liste d&apos;attente et pourront être réaffectés ultérieurement.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isBulkProcessing}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleBulkUnassign();
                            }}
                            disabled={isBulkProcessing}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isBulkProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirmer la Désaffectation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Assign Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <UserPlus className="h-5 w-5" />
                            Affectation Collective — {classroomName}
                        </DialogTitle>
                        <DialogDescription>
                            Sélectionnez les élèves de la liste d&apos;attente à affecter dans ce local.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher par nom ou matricule..."
                            className="pl-9"
                            value={assignSearch}
                            onChange={(e) => setAssignSearch(e.target.value)}
                        />
                    </div>

                    {filteredWaitingList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Users className="h-10 w-10 opacity-20 mb-2" />
                            <p className="font-medium text-sm">
                                {waitingListStudents.length === 0
                                    ? "Aucun élève en attente d'affectation"
                                    : "Aucun résultat pour cette recherche"}
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto border rounded-xl max-h-[45vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50 hover:bg-muted/50 sticky top-0">
                                        <TableHead className="w-10">
                                            <Checkbox
                                                checked={selectedForAssign.size === filteredWaitingList.length && filteredWaitingList.length > 0}
                                                onCheckedChange={toggleAllAssign}
                                            />
                                        </TableHead>
                                        <TableHead className="font-bold text-xs">Nom Complet</TableHead>
                                        <TableHead className="font-bold text-xs">Classe</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredWaitingList.map((student) => (
                                        <TableRow
                                            key={student.id}
                                            className={`cursor-pointer hover:bg-muted/30 ${selectedForAssign.has(student.id) ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}
                                            onClick={() => toggleAssign(student.id)}
                                        >
                                            <TableCell>
                                                <Checkbox checked={selectedForAssign.has(student.id)} />
                                            </TableCell>
                                            <TableCell className="font-bold text-sm">
                                                {student.lastName} {student.firstName}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                    {student.gradeName}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Badge variant="secondary" className="mr-auto">
                            {selectedForAssign.size} sélectionné(s) / {filteredWaitingList.length}
                        </Badge>
                        <Button variant="outline" onClick={() => setAssignDialogOpen(false)} disabled={isBulkProcessing}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleBulkAssign}
                            disabled={selectedForAssign.size === 0 || isBulkProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isBulkProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Affecter ({selectedForAssign.size})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Print Only View */}
            <div className="hidden print:block absolute inset-0 bg-white p-8 z-50">
                <h1 className="text-2xl font-bold text-center mb-6">Liste des élèves - Local {classroomName}</h1>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="border-b-2 py-2 px-4">#</th>
                            <th className="border-b-2 py-2 px-4">Matricule</th>
                            <th className="border-b-2 py-2 px-4">Nom Complet</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((student, idx) => (
                            <tr key={student.id}>
                                <td className="border-b py-2 px-4">{idx + 1}</td>
                                <td className="border-b py-2 px-4">{student.matricule || "N/A"}</td>
                                <td className="border-b py-2 px-4">
                                    {student.lastName} {student.postName ? student.postName + " " : ""}- {student.firstName}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}
