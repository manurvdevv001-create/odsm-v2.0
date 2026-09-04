"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUser } from "@/app/(main)/settings/users/actions";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }

        setIsLoading(true);
        try {
            const matricule = localStorage.getItem("odsm-matricule");
            const storedUser = localStorage.getItem("odsm-user");
            
            if (!matricule || !storedUser) {
                toast.error("Session invalide");
                return;
            }

            const user = JSON.parse(storedUser);
            if (!user.id) {
                toast.error("Utilisateur non trouvé");
                return;
            }

            const result = await updateUser(matricule, user.id, { password: newPassword });
            
            if (result.success) {
                toast.success("Mot de passe mis à jour avec succès");
                onOpenChange(false);
                setNewPassword("");
                setConfirmPassword("");
            } else {
                toast.error(result.error || "Une erreur est survenue lors de la mise à jour");
            }
        } catch (error) {
            console.error(error);
            toast.error("Une erreur inattendue est survenue");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-primary" />
                            Changer le mot de passe
                        </DialogTitle>
                        <DialogDescription>
                            Entrez votre nouveau mot de passe ci-dessous. Il doit contenir au moins 6 caractères.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="new-password">Nouveau mot de passe</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 6 caractères"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Retapez votre nouveau mot de passe"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Annuler
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                "Mettre à jour"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
