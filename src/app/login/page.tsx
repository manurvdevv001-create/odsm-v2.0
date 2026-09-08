"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, LogIn, ShieldAlert, ShieldX } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { verifyLogin } from "./actions";
import OdsmLogo from "@/components/odsm-logo";

import { useSearchParams } from "next/navigation";

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [matricule, setMatricule] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [requires2FA, setRequires2FA] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [loginData, setLoginData] = useState<{ matricule: string; userId: string } | null>(null);

    useEffect(() => {
        const error = searchParams.get("error");
        if (error === "restricted_hours") {
            toast.error("Accès restreint", {
                description: "Votre compte n'est pas autorisé à accéder au système en dehors des heures de service configurées.",
                duration: 6000
            });
        }
        if (error === "license_suspended") {
            toast.error("Accès bloqué — Licence invalide", {
                description: "La licence de votre établissement a expiré ou a été suspendue. Veuillez contacter l'administration ODSM pour régulariser votre situation.",
                duration: 10000,
                icon: <ShieldX className="h-5 w-5 text-red-500" />,
            });
        }
    }, [searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("handleLogin triggered", { matricule, username });
        setIsLoading(true);

        if (!matricule || !password) {
            toast.error("Veuillez entrer le matricule et le mot de passe.");
            setIsLoading(false);
            return;
        }

        try {
            const result = await verifyLogin(matricule.trim(), password, username.trim() || undefined);
            console.log("verifyLogin result", result);

            if (result.success) {
                if ((result as any).requires2FA) {
                    setRequires2FA(true);
                    setLoginData({ matricule: matricule.trim(), userId: (result as any).userId });
                    toast.info("Veuillez saisir votre code Google Authenticator.");
                } else {
                    if (typeof window !== "undefined") {
                        localStorage.setItem("odsm-matricule", matricule.trim());
                        if (result.user) {
                            localStorage.setItem("odsm-user", JSON.stringify(result.user));
                        }
                    }
                    
                    // Role-based redirection
                    if (result.user?.role === "TEACHER") {
                        router.push("/teacher");
                    } else {
                        router.push("/dashboard");
                    }
                }
            } else {
                toast.error(result.error || "Identifiants incorrects.");
            }
        } catch (error) {
            toast.error("Une erreur inattendue s'est produite.");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginData || !twoFactorCode) return;
        
        setIsLoading(true);
        try {
            const { verify2FAAction } = await import("./actions");
            const result = await verify2FAAction(loginData.matricule, loginData.userId, twoFactorCode);
            
            if (result.success) {
                if (typeof window !== "undefined") {
                    localStorage.setItem("odsm-matricule", loginData.matricule);
                    if (result.user) {
                        localStorage.setItem("odsm-user", JSON.stringify(result.user));
                    }
                }
                
                toast.success("Authentification réussie !");
                if (result.user?.role === "TEACHER") {
                    router.push("/teacher");
                } else {
                    router.push("/dashboard");
                }
            } else {
                toast.error(result.error || "Code invalide.");
            }
        } catch (error) {
            toast.error("Erreur lors de la vérification.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-gradient-to-br from-accent to-background relative overflow-hidden">
            {/* Background orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full max-w-sm relative z-10"
            >
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex justify-center mb-4"
                    >
                        <OdsmLogo variant="full" size="xl" className="items-center" />
                    </motion.div>
                    <p className="text-muted-foreground text-sm">Connectez-vous à votre espace scolaire.</p>
                </div>

                {/* Login Card */}
                <Card className="neuglass-card border-none shadow-2xl">
                    <CardContent className="p-6">
                        {!requires2FA ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                {/* Matricule ODSM */}
                                <div className="space-y-2">
                                    <Label htmlFor="matricule" className="font-medium">Matricule ODSM</Label>
                                    <Input
                                        id="matricule"
                                        placeholder="Ex : A3K9X2"
                                        required
                                        value={matricule}
                                        onChange={(e) => setMatricule(e.target.value)}
                                        className="h-11"
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Username (optional) */}
                                <div className="space-y-2">
                                    <Label htmlFor="username" className="font-medium">
                                        Nom d&apos;utilisateur <span className="text-muted-foreground font-normal">(Optionnel pour Admin)</span>
                                    </Label>
                                    <Input
                                        id="username"
                                        placeholder="Votre login personnel"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="h-11"
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Password */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="font-medium">Mot de passe</Label>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-11 pr-12"
                                            placeholder="Votre mot de passe"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="pt-2">
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 h-11"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Connexion...
                                            </>
                                        ) : (
                                            <>
                                                <LogIn className="mr-2 h-4 w-4" />
                                                Se Connecter
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleVerify2FA} className="space-y-6">
                                <div className="text-center space-y-2">
                                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                                        <ShieldAlert className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-lg">Vérification 2FA</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Entrez le code à 6 chiffres de votre application Google Authenticator.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="2fa-code" className="sr-only">Code de vérification</Label>
                                    <Input
                                        id="2fa-code"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        placeholder="000000"
                                        className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                                        required
                                        autoFocus
                                        value={twoFactorCode}
                                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 h-11"
                                        disabled={isLoading || twoFactorCode.length !== 6}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Vérification...
                                            </>
                                        ) : (
                                            "Vérifier et se connecter"
                                        )}
                                    </Button>
                                    
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full text-xs"
                                        onClick={() => setRequires2FA(false)}
                                    >
                                        Retour au login
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* Footer links */}
                        <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
                            <p>
                                Nouvelle école ?{" "}
                                <Link href="/setup" className="font-semibold text-primary hover:underline">
                                    Configurez votre établissement
                                </Link>
                            </p>
                            <p className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                Superadmin ?{" "}
                                <Link href="/superadmin/login" className="font-semibold text-primary/70 hover:text-primary hover:underline transition-all">
                                    Console Superadmin
                                </Link>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer Copyright */}
                <div className="mt-8 text-center space-y-1">
                    <p className="text-[10px] font-medium tracking-widest text-muted-foreground/50 uppercase">
                        © {new Date().getFullYear()} ODSM. Tous droits réservés.
                    </p>
                    <p className="text-[9px] text-muted-foreground/30 italic">
                        Conçu et développé par <span className="text-primary/40 font-semibold not-italic">Emmanuel Massey</span>
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
