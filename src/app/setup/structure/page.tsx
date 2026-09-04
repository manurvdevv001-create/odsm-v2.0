"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Loader2, GraduationCap, BookOpen, School } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { saveStructure } from "./actions";

interface StructureState {
    maternelle: boolean;
    primaire: boolean;
    secondaire: boolean;
}

export default function SetupStructurePage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const matricule = searchParams.get("matricule");

    const [structure, setStructure] = useState<StructureState>({
        maternelle: true,
        primaire: true,
        secondaire: true,
    });

    async function handleSubmit() {
        if (!matricule) {
            toast.error("Identifiant de l'école manquant.");
            return;
        }

        setIsLoading(true);

        const hasEnabled = structure.maternelle || structure.primaire || structure.secondaire;
        if (!hasEnabled) {
            toast.error("Veuillez activer au moins un niveau académique.");
            setIsLoading(false);
            return;
        }

        try {
            const result = await saveStructure(matricule, structure);

            if (result.success) {
                toast.success("Structure scolaire enregistrée avec succès !");
                router.push(`/setup/standardization?matricule=${matricule}`);
            } else {
                toast.error(result.message || "Échec de l'enregistrement de la structure.");
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
                <h1 className="text-3xl font-bold tracking-tight mb-2">Structure Académique</h1>
                <p className="text-muted-foreground text-lg">Sélectionnez les niveaux académiques proposés par votre école.</p>
            </div>

            <Card className="neuglass-card border-none shadow-2xl">
                <CardHeader>
                    <CardTitle>Niveaux Académiques</CardTitle>
                    <CardDescription>Activez les niveaux académiques de votre école. Le nombre de classes sera configuré ultérieurement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <LevelRow
                        icon={<School size={20} />}
                        title="Maternelle"
                        description="Éducation préscolaire (3-5 ans)"
                        enabled={structure.maternelle}
                        onToggle={(v) => setStructure(prev => ({ ...prev, maternelle: v }))}
                    />

                    <div className="border-t border-border/50" />

                    <LevelRow
                        icon={<BookOpen size={20} />}
                        title="Primaire"
                        description="Éducation primaire (6-11 ans, 6 classes)"
                        enabled={structure.primaire}
                        onToggle={(v) => setStructure(prev => ({ ...prev, primaire: v }))}
                    />

                    <div className="border-t border-border/50" />

                    <LevelRow
                        icon={<GraduationCap size={20} />}
                        title="Secondaire"
                        description="Éducation secondaire (12+ ans, jusqu'à 6 classes)"
                        enabled={structure.secondaire}
                        onToggle={(v) => setStructure(prev => ({ ...prev, secondaire: v }))}
                    />

                    <div className="pt-6 flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={() => router.push("/setup")}
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
                                    Étape 3 : Normalisation <ArrowRight className="ml-2 w-4 h-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function LevelRow({
    icon,
    title,
    description,
    enabled,
    onToggle,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (value: boolean) => void;
}) {
    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl transition-all ${enabled ? 'bg-primary/5 ring-1 ring-primary/20' : 'opacity-60'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {icon}
            </div>
            <div className="flex-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
            </label>
        </div>
    );
}
