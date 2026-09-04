"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Lock, LockKeyhole, LockOpen, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
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
} from "@/components/ui/alert-dialog";

export default function AcademicClosurePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [grades, setGrades] = useState<any[]>([]);
    const [classrooms, setClassrooms] = useState<any[]>([]);
    const [closures, setClosures] = useState<any[]>([]);
    
    const [closingGrade, setClosingGrade] = useState<string | null>(null);
    const [showClosureConfirm, setShowClosureConfirm] = useState<string | null>(null); // Grade ID

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch grades and classrooms from the school setup or dedicated API
            const resData = await fetch("/api/admin/school"); // Gives us school structure usually
            if (resData.ok) {
                const data = await resData.json();
                
                // Fetch closures
                const resClosures = await fetch("/api/admin/annual-closures");
                let closuresData = [];
                if (resClosures.ok) {
                    const cData = await resClosures.json();
                    closuresData = cData.closures || [];
                }

                setGrades(data.grades || []);
                setClassrooms(data.classrooms || []);
                setClosures(closuresData);
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur de chargement des données.");
        } finally {
            setLoading(false);
        }
    };

    const handleGradeClosure = async () => {
        if (!showClosureConfirm) return;
        setClosingGrade(showClosureConfirm);
        try {
            const res = await fetch("/api/admin/annual-closures", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    entityType: "GRADE",
                    entityId: showClosureConfirm,
                    closedByUserId: "admin",
                    closedByName: "Administrateur"
                })
            });
            if (res.ok) {
                toast.success("Niveau académique clôturé.");
                setShowClosureConfirm(null);
                fetchData();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de la clôture du niveau.");
            }
        } catch (e) {
            toast.error("Erreur réseau.");
        } finally {
            setClosingGrade(null);
        }
    };

    const allGradesClosed = useMemo(() => {
        if (!grades.length) return false;
        return grades.every(g => closures.some(c => c.entityType === 'GRADE' && c.entityId === g.id));
    }, [grades, closures]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Clôture Académique</h1>
                    <p className="text-muted-foreground">Suivez l'état de clôture de chaque local et clôturez les niveaux académiques.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-8">
                    {/* NEW YEAR ACTIVATION BANNER */}
                    <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-emerald-800 flex items-center gap-2">
                                <ArrowRight className="h-5 w-5" />
                                Activation de la Nouvelle Année
                            </CardTitle>
                            <CardDescription className="text-emerald-700">
                                Une fois tous les niveaux clôturés, vous pourrez activer la nouvelle année scolaire et transférer tous les élèves.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button 
                                onClick={() => router.push('/settings/academic-closure/new-year')}
                                disabled={!allGradesClosed}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                                {allGradesClosed ? "Préparer la nouvelle année" : "Tous les niveaux doivent être clôturés d'abord"}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* GRADES LIST */}
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                        {grades.map(grade => {
                            const gradeClassrooms = classrooms.filter(c => c.gradeId === grade.id);
                            const closedClassroomsCount = gradeClassrooms.filter(c => closures.some(cl => cl.entityType === 'CLASSROOM' && cl.entityId === c.id)).length;
                            const allClassroomsClosed = gradeClassrooms.length > 0 && closedClassroomsCount === gradeClassrooms.length;
                            const isGradeClosed = closures.some(cl => cl.entityType === 'GRADE' && cl.entityId === grade.id);

                            return (
                                <Card key={grade.id} className="shadow-sm">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{grade.name}</CardTitle>
                                                <CardDescription>
                                                    {gradeClassrooms.length} locaux attachés
                                                </CardDescription>
                                            </div>
                                            {isGradeClosed ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 font-bold">
                                                    <Lock className="h-3 w-3" />
                                                    Niveau Clôturé
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-amber-600 border-amber-200 gap-1 font-bold">
                                                    <LockOpen className="h-3 w-3" />
                                                    En cours
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3 mt-2">
                                            {gradeClassrooms.map(c => {
                                                const isClassClosed = closures.some(cl => cl.entityType === 'CLASSROOM' && cl.entityId === c.id);
                                                return (
                                                    <div key={c.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/30">
                                                        <span className="font-semibold">{c.name}</span>
                                                        {isClassClosed ? (
                                                            <span className="flex items-center text-emerald-600 text-xs font-bold gap-1">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Clôturé
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center text-amber-600 text-xs font-bold gap-1">
                                                                <AlertTriangle className="h-3.5 w-3.5" />
                                                                Non clôturé
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {gradeClassrooms.length === 0 && (
                                                <p className="text-xs text-muted-foreground italic">Aucun local dans ce niveau.</p>
                                            )}
                                        </div>

                                        <div className="mt-5 pt-4 border-t border-border/50">
                                            {!isGradeClosed && (
                                                <Button 
                                                    disabled={!allClassroomsClosed || gradeClassrooms.length === 0}
                                                    onClick={() => setShowClosureConfirm(grade.id)}
                                                    variant="outline"
                                                    className="w-full font-bold gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
                                                >
                                                    <LockKeyhole className="h-4 w-4" />
                                                    Clôturer le niveau
                                                </Button>
                                            )}
                                            {!isGradeClosed && !allClassroomsClosed && gradeClassrooms.length > 0 && (
                                                <p className="text-[10px] text-center text-muted-foreground mt-2">
                                                    Tous les locaux doivent être clôturés pour clôturer le niveau.
                                                </p>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <AlertDialog open={!!showClosureConfirm} onOpenChange={(open) => !open && setShowClosureConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <LockKeyhole className="h-5 w-5 text-amber-600" />
                            Confirmer la clôture du niveau
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <p>Vous êtes sur le point de clôturer définitivement ce niveau académique pour l'année en cours.</p>
                            <p className="text-amber-700 font-medium">Cette action est irréversible et indique que tous les locaux ont finalisé leurs délibérations.</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={!!closingGrade}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleGradeClosure}
                            disabled={!!closingGrade}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {closingGrade ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LockKeyhole className="h-4 w-4 mr-2" />}
                            Clôturer le niveau
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
