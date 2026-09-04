"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Loader2, Calendar, BookOpenCheck, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { saveStandardization } from "./actions";

export default function SetupStandardizationPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const matricule = searchParams.get("matricule");

    const [config, setConfig] = useState({
        schoolYear: "2024-2025",
        postCTEB: false,
    });

    async function handleSubmit() {
        if (!matricule) {
            toast.error("Identifiant de l'école manquant.");
            return;
        }

        setIsLoading(true);

        if (!config.schoolYear || !/^\d{4}-\d{4}$/.test(config.schoolYear)) {
            toast.error("Veuillez entrer une année scolaire valide (ex. 2024-2025).");
            setIsLoading(false);
            return;
        }

        try {
            const result = await saveStandardization(matricule, config);

            if (result.success) {
                toast.success("Normalisation enregistrée avec succès !");
                router.push(`/setup/admin?matricule=${matricule}`);
            } else {
                toast.error(result.message || "Échec de l'enregistrement.");
            }
        } catch (error) {
            toast.error("Une erreur inattendue s'est produite.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
        >
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Normalisation</h1>
                <p className="text-muted-foreground text-lg">Définissez l&apos;année scolaire et les paramètres de base.</p>
            </div>

            <Card className="neuglass-card border-none shadow-2xl">
                <CardHeader>
                    <CardTitle>Paramètres de l&apos;Année Scolaire</CardTitle>
                    <CardDescription>Configurez l&apos;année scolaire en cours et les options supplémentaires.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Année scolaire */}
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5 ring-1 ring-primary/20">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                            <Calendar size={20} />
                        </div>
                        <div className="flex-1 space-y-3">
                            <div>
                                <h3 className="font-semibold">Année Scolaire</h3>
                                <p className="text-sm text-muted-foreground">L&apos;année académique en cours</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Label className="text-sm whitespace-nowrap">Année :</Label>
                                <Input
                                    type="text"
                                    value={config.schoolYear}
                                    onChange={(e) => setConfig(prev => ({ ...prev, schoolYear: e.target.value }))}
                                    placeholder="2024-2025"
                                    className="w-40 h-9"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/50" />

                    {/* Post CTEB */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl transition-all ${config.postCTEB ? 'bg-primary/5 ring-1 ring-primary/20' : 'opacity-60'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${config.postCTEB ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <BookOpenCheck size={20} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold">Post CTEB (Humanités & Professionnel)</h3>
                            <p className="text-sm text-muted-foreground">Activez si votre école propose des sections post-CTEB (1ère à 4ème des Humanités)</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.postCTEB}
                                onChange={(e) => setConfig(prev => ({ ...prev, postCTEB: e.target.checked }))}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                    </div>

                    {/* Note */}
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            Le calendrier scolaire détaillé, les classes, cours et horaires seront configurés dans <strong>Paramètres</strong> après la création de l&apos;école.
                        </p>
                    </div>

                    <div className="pt-6 flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={() => router.push("/setup/structure")}
                        >
                            <ArrowLeft className="mr-2 w-4 h-4" /> Retour
                        </Button>

                        <Button
                            type="button"
                            size="lg"
                            className="w-[250px] bg-primary hover:bg-primary/90"
                            disabled={isLoading}
                            onClick={handleSubmit}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                <>
                                    Étape 4 : Compte Admin <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
