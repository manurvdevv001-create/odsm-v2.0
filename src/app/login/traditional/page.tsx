
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { verifyLogin } from "../actions";
import OdsmLogo from "@/components/odsm-logo";

/**
 * Traditional Login Page (Dev/Local mode)
 * This page allows authentication without 2FA enforcement, 
 * useful for local testing or when offline.
 */
export default function TraditionalLoginPage() {
    const router = useRouter();
    const [matricule, setMatricule] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Note: In a real production app, we would add a server-side check
            // to ensure this "bypass" page is only accessible from localhost or authorized IPs.
            const result = await verifyLogin(matricule.trim(), password, username.trim() || undefined, true);

            if (result.success) {
                if (typeof window !== "undefined") {
                    localStorage.setItem("odsm-matricule", matricule.trim());
                    if (result.user) {
                        localStorage.setItem("odsm-user", JSON.stringify(result.user));
                    }
                }
                
                toast.success("Connexion réussie (Mode Traditionnel)");
                
                if (result.user?.role === "TEACHER") {
                    router.push("/teacher");
                } else {
                    router.push("/dashboard");
                }
            } else {
                toast.error(result.error || "Identifiants incorrects.");
            }
        } catch (error) {
            toast.error("Erreur de connexion.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-sm space-y-6">
                <div className="flex justify-center mb-2">
                    <OdsmLogo variant="full" size="lg" />
                </div>

                <Card className="border-amber-200 bg-amber-50/30">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2 text-amber-600 mb-1">
                            <ShieldAlert className="h-5 w-5" />
                            <CardTitle className="text-lg">Accès de Test</CardTitle>
                        </div>
                        <CardDescription>
                            Mode d&apos;authentification traditionnel sans 2FA. 
                            Réservé aux tests locaux et hors-ligne.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="matricule">Matricule École</Label>
                                <Input
                                    id="matricule"
                                    value={matricule}
                                    onChange={(e) => setMatricule(e.target.value)}
                                    placeholder="Ex: ODSM001"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="username">Utilisateur (Optionnel Admin)</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Login"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Mot de passe</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Se connecter"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                
                <p className="text-center text-xs text-muted-foreground">
                    Utilisez la page de connexion standard pour la production sécurisée.
                </p>
            </div>
        </div>
    );
}
