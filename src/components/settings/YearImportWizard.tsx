"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importYearData } from "@/app/setup/actions";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { 
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface YearImportWizardProps {
    targetYear: string;
    availableYears: string[];
    matricule: string;
    onComplete: () => void;
}

export function YearImportWizard({ targetYear, availableYears, matricule, onComplete }: YearImportWizardProps) {
    const { user } = useSchoolData();
    const [sourceYear, setSourceYear] = useState<string>("");
    const [isImporting, setIsImporting] = useState(false);
    const [options, setOptions] = useState({
        structure: true,
        finance: true,
        staff: true
    });

    const otherYears = availableYears.filter(y => y !== targetYear);

    const handleImport = async () => {
        if (!sourceYear) {
            toast.error("Veuillez sélectionner une année source.");
            return;
        }

        setIsImporting(true);
        try {
            const executorName = user?.name || user?.username || "Administrateur";
            const result = await importYearData(matricule, sourceYear, targetYear, options, executorName);
            if (result.success) {
                toast.success("Importation réussie !", {
                    description: `Les données de ${sourceYear} ont été copiées vers ${targetYear}.`
                });
                onComplete();
            } else {
                toast.error("Erreur d'importation", { description: result.error });
            }
        } catch (error) {
            toast.error("Erreur réseau lors de l'importation.");
        } finally {
            setIsImporting(false);
        }
    };

    if (otherYears.length === 0) return null;

    return (
        <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Assistant de préparation ({targetYear})
                </CardTitle>
                <CardDescription>
                    Gagnez du temps en important la configuration d'une année précédente.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>Année source (Copier depuis...)</Label>
                    <Select value={sourceYear} onValueChange={setSourceYear}>
                        <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Sélectionnez l'année de référence" />
                        </SelectTrigger>
                        <SelectContent>
                            {otherYears.map(y => (
                                <SelectItem key={y} value={y}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Éléments à importer</Label>
                    <div className="grid gap-3">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                            <Checkbox 
                                id="import-structure" 
                                checked={options.structure} 
                                onCheckedChange={(val) => setOptions(prev => ({ ...prev, structure: !!val }))} 
                            />
                            <div className="grid gap-0.5 leading-none">
                                <Label htmlFor="import-structure" className="font-bold cursor-pointer">Structure & Cours</Label>
                                <p className="text-xs text-muted-foreground">Classes, locaux, matières, pondérations et horaires.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                            <Checkbox 
                                id="import-finance" 
                                checked={options.finance} 
                                onCheckedChange={(val) => setOptions(prev => ({ ...prev, finance: !!val }))} 
                            />
                            <div className="grid gap-0.5 leading-none">
                                <Label htmlFor="import-finance" className="font-bold cursor-pointer">Paramètres Financiers</Label>
                                <p className="text-xs text-muted-foreground">Types de frais, montants par classe et devises.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
                            <Checkbox 
                                id="import-staff" 
                                checked={options.staff} 
                                onCheckedChange={(val) => setOptions(prev => ({ ...prev, staff: !!val }))} 
                            />
                            <div className="grid gap-0.5 leading-none">
                                <Label htmlFor="import-staff" className="font-bold cursor-pointer">Assignations du Personnel</Label>
                                <p className="text-xs text-muted-foreground">Lien entre enseignants, classes et cours.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full gradient-btn gap-2 font-bold" disabled={!sourceYear || isImporting}>
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Lancer l'importation
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                Attention : Écrasement des données
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                L'importation de <strong>{sourceYear}</strong> vers <strong>{targetYear}</strong> remplacera la configuration actuelle de l'année cible par celle de l'année source.<br /><br />
                                Les données opérationnelles (inscriptions d'élèves, paiements, notes) ne seront pas affectées.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={handleImport} className="bg-primary rounded-xl font-bold">
                                Confirmer l'importation
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
