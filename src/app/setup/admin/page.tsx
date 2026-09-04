"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Eye, EyeOff, Sparkles, CheckCircle2, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createAdminAndFinalize } from "./actions";

export default function SetupAdminPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [copied, setCopied] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [odsmMatricule, setOdsmMatricule] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const existingMatricule = searchParams.get("matricule");

    const [form, setForm] = useState({
        password: "",
        confirmPassword: "",
    });

    async function handleSubmit() {
        if (!existingMatricule) {
            toast.error("Identifiant de l'école manquant.");
            return;
        }

        if (form.password.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        if (form.password !== form.confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas.");
            return;
        }

        setIsLoading(true);

        try {
            const result = await createAdminAndFinalize(existingMatricule, form.password);

            if (result.success) {
                setOdsmMatricule(result.matricule || "");
                setCompleted(true);
                toast.success("École créée avec succès !");
            } else {
                toast.error(result.message || "Échec de la création.");
            }
        } catch (error) {
            toast.error("Une erreur inattendue s'est produite.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    function copyMatricule() {
        navigator.clipboard.writeText(odsmMatricule);
        setCopied(true);
        toast.success("Matricule copié !");
        setTimeout(() => setCopied(false), 2000);
    }

    // Completed confirmation view
    if (completed) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <div className="mb-8 text-center">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", duration: 0.6, delay: 0.2 }}
                        className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
                    >
                        <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
                    </motion.div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Félicitations !</h1>
                    <p className="text-muted-foreground text-lg">Votre école a été créée avec succès.</p>
                </div>

                <Card className="neuglass-card border-none shadow-2xl">
                    <CardContent className="p-8 space-y-6">
                        {/* Matricule ODSM */}
                        <div className="text-center space-y-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Votre Matricule ODSM</p>
                            <div className="flex items-center justify-center gap-3">
                                <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">{odsmMatricule}</span>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={copyMatricule}
                                    className="shrink-0"
                                >
                                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Conservez ce matricule précieusement. Il vous servira d&apos;identifiant pour vous connecter.
                            </p>
                        </div>

                        <div className="border-t border-border/50" />

                        {/* Info */}
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                            <Sparkles size={18} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                            <div className="text-sm text-blue-900 dark:text-blue-100">
                                <p className="font-semibold mb-1">Prochaines étapes :</p>
                                <p>Configurez les classes, cours, horaires et le calendrier scolaire dans <strong>Paramètres</strong> après la connexion.</p>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-center">
                            <Button
                                size="lg"
                                className="w-[250px] bg-primary hover:bg-primary/90"
                                onClick={() => router.push("/dashboard")}
                            >
                                Accéder au Tableau de Bord
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    // Admin password form
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
        >
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Compte Administrateur</h1>
                <p className="text-muted-foreground text-lg">Créez le mot de passe administrateur pour sécuriser votre école.</p>
            </div>

            <Card className="neuglass-card border-none shadow-2xl">
                <CardHeader>
                    <CardTitle>Mot de Passe Administrateur</CardTitle>
                    <CardDescription>Ce mot de passe sera utilisé avec votre matricule ODSM pour accéder à l&apos;application.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={form.password}
                                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="Minimum 6 caractères"
                                className="h-11 pr-12"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmer le mot de passe <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <Input
                                id="confirmPassword"
                                type={showConfirm ? "text" : "password"}
                                value={form.confirmPassword}
                                onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                placeholder="Retapez le mot de passe"
                                className="h-11 pr-12"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowConfirm(!showConfirm)}
                            >
                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    <div className="pt-6 flex justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={() => router.push("/setup/standardization")}
                        >
                            <ArrowLeft className="mr-2 w-4 h-4" /> Retour
                        </Button>

                        <Button
                            type="button"
                            size="lg"
                            className="w-[220px] bg-primary hover:bg-primary/90"
                            disabled={isLoading}
                            onClick={handleSubmit}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Création...
                                </>
                            ) : (
                                "Créer mon École"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
