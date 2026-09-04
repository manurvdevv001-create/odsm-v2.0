"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Upload, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setupSchoolIdentity } from "./actions";

export default function SetupIdentityPage() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);

        // Validation de base
        const name = formData.get("name") as string;

        if (!name) {
            toast.error("Veuillez entrer le nom de l'école.");
            setIsLoading(false);
            return;
        }

        try {
            const result = await setupSchoolIdentity(formData);

            if (result.success) {
                toast.success("Identité de l'école enregistrée avec succès !");
                router.push(`/setup/structure?matricule=${result.matricule}`);
            } else {
                toast.error(result.message || "Échec de l'enregistrement de l'identité.");
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
                <h1 className="text-3xl font-bold tracking-tight mb-2">Bienvenue sur ODSM</h1>
                <p className="text-muted-foreground text-lg">Configurons l&apos;identité numérique de votre école.</p>
            </div>

            <form onSubmit={handleSubmit}>
                <Card className="neuglass-card border-none shadow-2xl">
                    <CardHeader>
                        <CardTitle>Informations de l&apos;École</CardTitle>
                        <CardDescription>Entrez les détails officiels de votre établissement scolaire. Un matricule ODSM unique sera généré automatiquement.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nom de l&apos;École <span className="text-red-500">*</span></Label>
                                <Input id="name" name="name" placeholder="ex. Collège Boboto" className="h-11" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="secopeMatricule">N° SECOPE (Facultatif)</Label>
                                <Input id="secopeMatricule" name="secopeMatricule" placeholder="ex. 12345678" className="h-11" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Logo de l&apos;École</Label>
                            <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer group">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                                    <Upload size={24} />
                                </div>
                                <p className="font-medium">Cliquez pour télécharger ou glissez le logo ici</p>
                                <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou SVG (Max 2 Mo)</p>
                                <input type="hidden" name="logo" value="" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="slogan">Devise / Slogan (Facultatif)</Label>
                            <Input id="slogan" name="slogan" placeholder="ex. Excellence et Discipline" className="h-11" />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" size="lg" className="w-[220px] bg-primary hover:bg-primary/90" disabled={isLoading}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enregistrement...
                                    </>
                                ) : (
                                    <>
                                        Étape 2 : Structure <ArrowRight className="ml-2 w-4 h-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </motion.div>
    );
}
