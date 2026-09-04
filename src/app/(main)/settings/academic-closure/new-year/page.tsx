"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, ArrowRight, ShieldAlert, CheckCircle2, Info, Users, GraduationCap, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function NewYearActivationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [confirmCode, setConfirmCode] = useState("");
    const [success, setSuccess] = useState(false);
    
    const REQUIRED_CODE = "NOUVELLE-ANNEE-ODSM";

    useEffect(() => {
        fetchPreview();
    }, []);

    const fetchPreview = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/activate-new-year");
            if (res.ok) {
                const data = await res.json();
                setPreviewData(data);
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur de chargement de la prévisualisation.");
                if (err.error?.includes("clôturés")) {
                    router.push('/settings/academic-closure');
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("Erreur réseau.");
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async () => {
        if (confirmCode !== REQUIRED_CODE) {
            toast.error("Code de confirmation incorrect.");
            return;
        }

        setActivating(true);
        try {
            const res = await fetch("/api/admin/activate-new-year", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmCode })
            });

            if (res.ok) {
                setSuccess(true);
                toast.success("Nouvelle année scolaire activée avec succès !");
            } else {
                const err = await res.json();
                toast.error(err.error || "Erreur lors de l'activation.");
            }
        } catch (e) {
            toast.error("Erreur réseau.");
        } finally {
            setActivating(false);
        }
    };

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-lg mx-auto">
                <div className="h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-emerald-800">Nouvelle Année Activée !</h1>
                <p className="text-muted-foreground text-lg">
                    Le basculement vers la nouvelle année scolaire s'est déroulé avec succès. Les élèves ont été mis à jour selon leurs décisions de fin d'année.
                </p>
                <Alert className="bg-blue-50 border-blue-200 text-left mt-4">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 font-bold">Prochaines étapes</AlertTitle>
                    <AlertDescription className="text-blue-700 mt-2 space-y-2">
                        <p>1. Allez dans les paramètres de l'école pour mettre à jour la date et l'année scolaire en cours dans le calendrier.</p>
                        <p>2. Commencez l'affectation des élèves en attente d'inscription dans leurs nouveaux locaux.</p>
                    </AlertDescription>
                </Alert>
                <div className="flex gap-4 mt-6">
                    <Button onClick={() => router.push('/settings/school-setup')} variant="outline" className="font-bold">
                        Paramètres de l'école
                    </Button>
                    <Button onClick={() => router.push('/students')} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
                        Voir les élèves
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Activation de la Nouvelle Année</h1>
                    <p className="text-muted-foreground">Prévisualisez et validez le basculement des élèves.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : !previewData ? (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Impossible de continuer</AlertTitle>
                    <AlertDescription>Les données de prévisualisation n'ont pas pu être chargées. Assurez-vous que tous les niveaux sont clôturés.</AlertDescription>
                </Alert>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <Card className="shadow-sm border-emerald-100">
                            <CardHeader className="bg-emerald-50/50 pb-4 border-b border-emerald-100">
                                <CardTitle className="text-emerald-800 flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Bilan des Élèves ({previewData.totalProcessed})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col p-4 rounded-xl border bg-card">
                                        <span className="text-xs font-bold text-muted-foreground uppercase mb-1">Passent en Attente d'Inscription</span>
                                        <span className="text-3xl font-black text-blue-600">{previewData.promoted + previewData.maintained + previewData.demoted}</span>
                                        <div className="flex gap-2 mt-2 text-xs">
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">{previewData.promoted} Promus</Badge>
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">{previewData.maintained} Maintenus</Badge>
                                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">{previewData.demoted} Démis</Badge>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col p-4 rounded-xl border bg-card">
                                        <span className="text-xs font-bold text-muted-foreground uppercase mb-1">Passent en Exclus / Retirés</span>
                                        <span className="text-3xl font-black text-rose-600">{previewData.excluded}</span>
                                        <div className="text-xs text-muted-foreground mt-2">
                                            Élèves ayant échoué définitivement ou ayant été renvoyés.
                                        </div>
                                    </div>

                                    <div className="col-span-2 flex flex-col p-4 rounded-xl border bg-card">
                                        <span className="text-xs font-bold text-muted-foreground uppercase mb-1">Sans Décision (Passent en Exclus par défaut)</span>
                                        <span className="text-3xl font-black text-slate-600">{previewData.noDecision}</span>
                                        <div className="text-xs text-muted-foreground mt-2">
                                            Ces élèves n'ont reçu aucune décision dans les fiches de suivi.
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                            <Info className="h-5 w-5 text-amber-600" />
                            <AlertTitle className="font-bold">Ce qui va se passer</AlertTitle>
                            <AlertDescription className="mt-2 space-y-2 text-sm text-amber-700">
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Tous les élèves <strong>promus, maintenus ou démis</strong> perdront leur affectation de local et passeront au statut <Badge variant="outline" className="text-[10px] h-4 bg-white">En attente d'inscription</Badge>.</li>
                                    <li>Leur classe nominale (Grade) sera mise à jour automatiquement selon la décision.</li>
                                    <li>Les élèves <strong>exclus ou retirés</strong> passeront au statut <Badge variant="outline" className="text-[10px] h-4 bg-white text-rose-600">Exclu</Badge> et n'apparaîtront plus dans les listes actives.</li>
                                    <li>Un historique de transfert sera ajouté à leur dossier.</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                    </div>

                    <div className="md:col-span-1">
                        <Card className="border-rose-200 shadow-sm sticky top-6">
                            <CardHeader className="bg-rose-50/50 pb-4 border-b border-rose-100">
                                <CardTitle className="text-rose-800 flex items-center gap-2 text-lg">
                                    <ShieldAlert className="h-5 w-5" />
                                    Zone de Danger
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <p className="text-sm text-rose-900 font-medium">
                                    Cette action modifiera le statut et la classe de <strong>tous</strong> les élèves de l'école. Elle est irréversible.
                                </p>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-rose-700 uppercase">Code de confirmation</label>
                                    <Input 
                                        placeholder="NOUVELLE-ANNEE-ODSM" 
                                        value={confirmCode}
                                        onChange={(e) => setConfirmCode(e.target.value)}
                                        className="border-rose-300 focus-visible:ring-rose-500 font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-rose-600 italic">Veuillez taper "NOUVELLE-ANNEE-ODSM" pour confirmer.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-rose-50/30 pt-4">
                                <Button 
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold"
                                    disabled={confirmCode !== REQUIRED_CODE || activating}
                                    onClick={handleActivate}
                                >
                                    {activating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                                    Lancer le basculement
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
