'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, UserCog, ShieldCheck, ShieldAlert, UserCheck, User, Users, Scale, GraduationCap, LayoutDashboard, Loader2, LogOut, Power } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getUsers, createUser, deleteUser, updateUserManagementConfig } from './actions';
import { forceTerminateSession } from './session-actions';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { isReadOnlyRole } from "@/lib/role-permissions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { UserForm } from '@/components/user-form';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

const roleLabels: Record<string, { label: string; color: string; icon: any }> = {
    ADMIN_SYSTEM: { label: 'Admin Système', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: ShieldAlert },
    SUPERVISOR: { label: 'Superviseur', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: ShieldCheck },
    CASHIER: { label: 'Percepteur', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: UserCheck },
    SECRETARY: { label: 'Secrétaire', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: UserCog },
    SECRETARY_CASHIER: { label: 'Sec. & Percept.', color: 'bg-teal-500/10 text-teal-500 border-teal-500/20', icon: UserCog },
    PREFET: { label: 'Préfet des Études', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', icon: LayoutDashboard },
    DISCIPLINE: { label: 'Discipline', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20', icon: Scale },
    TEACHER: { label: 'Enseignant', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20', icon: User },
};

function formatSessionDate(isoDate?: string): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
}

function formatSessionTime(isoDate?: string): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds?: number): string {
    if (seconds === undefined || seconds === null) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatElapsed(isoDate?: string): string {
    if (!isoDate) return '—';
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) {
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        return `${h}h ${m}min`;
    }
    const days = Math.floor(diff / 86400);
    return `${days}j`;
}

export default function UsersPage() {
    const router = useRouter();
    const { schoolData } = useSchoolData();
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingUser, setDeletingUser] = useState<any>(null);
    const [terminatingUser, setTerminatingUser] = useState<any>(null);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [pendingConfigChecked, setPendingConfigChecked] = useState(false);

    const useStaffNumberAsLogin = (schoolData?.configuration as any)?.userManagement?.useStaffNumberAsLogin || false;
    const staffProfiles = schoolData?.teachers || [];
    const effectiveRole = ((useSchoolData().user?.role as string) || 'ADMIN').toUpperCase();
    const readOnly = isReadOnlyRole(effectiveRole);

    useEffect(() => {
        if (schoolData?.matricule) {
            loadUsers();
        }
    }, [schoolData?.matricule]);

    const loadUsers = async () => {
        if (!schoolData?.matricule) return;
        setIsLoading(true);
        const data = await getUsers(schoolData.matricule as string);
        setUsers(data);
        setIsLoading(false);
    };

    const handleCreate = async (formData: any) => {
        if (!schoolData?.matricule) return;
        setIsSubmitting(true);
        const matricule = schoolData.matricule as string;

        const result = await createUser(matricule, formData);

        if (result?.success) {
            toast.success("Compte créé", {
                description: `L'accès pour ${formData.name} a été configuré.`,
            });
            setIsDialogOpen(false);
            loadUsers();
        } else {
            toast.error("Erreur", {
                description: result?.error || "Échec de l'opération.",
            });
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!deletingUser || !schoolData?.matricule) return;

        const result = await deleteUser(schoolData.matricule as string, deletingUser.id);
        if (result?.success) {
            toast.success("Compte supprimé", {
                description: "L'accès utilisateur a été révoqué.",
            });
            loadUsers();
        } else {
            toast.error("Erreur", {
                description: result?.error || "Échec de la suppression.",
            });
        }
        setDeletingUser(null);
    };

    const handleForceTerminate = async () => {
        if (!terminatingUser || !schoolData?.matricule) return;

        const result = await forceTerminateSession(schoolData.matricule as string, terminatingUser.id);
        if (result?.success) {
            toast.success("Session clôturée", {
                description: `La session de ${terminatingUser.name} a été forcément terminée.`,
            });
            loadUsers();
        } else {
            toast.error("Erreur", {
                description: result?.error || "Échec de la clôture.",
            });
        }
        setTerminatingUser(null);
    };

    const handleConfigToggle = (checked: boolean) => {
        setPendingConfigChecked(checked);
        if (users.length > 0) {
            setIsResetDialogOpen(true);
        } else {
            executeConfigChange(checked, false);
        }
    };

    const executeConfigChange = async (checked: boolean, resetUsers: boolean) => {
        if (!schoolData?.matricule) return;
        setIsUpdatingConfig(true);
        const result = await updateUserManagementConfig(schoolData.matricule as string, { 
            useStaffNumberAsLogin: checked,
            resetUsers 
        });

        if (result.success) {
            toast.success("Configuration mise à jour");
            setIsResetDialogOpen(false);
            window.location.reload(); 
        } else {
            toast.error("Erreur", {
                description: result.error || "Impossible de mettre à jour la configuration.",
            });
        }
        setIsUpdatingConfig(false);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 p-1"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground bg-clip-text">
                        Gestion des Comptes d'Accès
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1 max-w-2xl">
                        Gérez les accès applicatifs liés aux profils de votre personnel avec une sécurité granulaire.
                    </p>
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-primary rounded-full blur-[2px] opacity-50" />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    {!readOnly && (
                        <>
                            <div className="flex items-center space-x-3 glass-card bg-muted/20 px-4 py-2.5 border-primary/10 shadow-inner">
                                <Switch
                                    id="use-staff-number"
                                    checked={useStaffNumberAsLogin}
                                    onCheckedChange={handleConfigToggle}
                                    disabled={isUpdatingConfig}
                                    className="data-[state=checked]:bg-primary"
                                />
                                <Label htmlFor="use-staff-number" className="text-sm font-bold cursor-pointer text-foreground/80">
                                    Utiliser le N° Staff comme login
                                </Label>
                            </div>
                            <Button 
                                onClick={() => setIsDialogOpen(true)} 
                                className="gradient-btn h-11 px-6 rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <Plus className="mr-2 h-5 w-5" /> Créer un accès
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card className="glass-card border-none shadow-2xl overflow-hidden bg-card/40 backdrop-blur-2xl transition-all duration-500 hover:shadow-primary/5">
                <CardHeader className="border-b border-primary/5 bg-primary/5 backdrop-blur-md py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl shadow-inner border border-primary/20 group-hover:scale-110 transition-transform">
                                <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight text-foreground">Comptes Utilisateurs</CardTitle>
                                <CardDescription className="text-muted-foreground font-bold flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    {users.length} accès configuré{users.length > 1 ? 's' : ''}
                                </CardDescription>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-320px)]">
                        <TooltipProvider>
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 border-b border-primary/5 hover:bg-muted/40 transition-colors">
                                        <TableHead className="w-[20%] font-bold text-foreground py-4">Identité (Profil)</TableHead>
                                        <TableHead className="font-bold text-foreground">Login</TableHead>
                                        <TableHead className="font-bold text-foreground">Rôle</TableHead>
                                        <TableHead className="text-center font-bold text-foreground">Créé le</TableHead>
                                        <TableHead className="text-center font-bold text-foreground">Dernier accès</TableHead>
                                        <TableHead className="text-center font-bold text-foreground">Heure</TableHead>
                                        <TableHead className="text-center font-bold text-foreground">Durée</TableHead>
                                        <TableHead className="text-center font-bold text-foreground">Depuis</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                    <span className="text-slate-500 font-medium">Chargement des comptes...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : users.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-3 text-slate-400">
                                                    <UserCog className="h-12 w-12 opacity-20" />
                                                    <p className="font-medium">Aucun compte utilisateur configuré.</p>
                                                    <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
                                                        Créer le premier accès
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <AnimatePresence mode="popLayout">
                                            {users.map((user, idx) => {
                                                const roleCfg = roleLabels[user.role] || { label: user.role, color: 'bg-slate-100 text-slate-600', icon: User };
                                                const RoleIcon = roleCfg.icon;
                                                const linkedStaff = staffProfiles.find((s: any) => s.id === user.staffId);

                                                return (
                                                    <motion.tr 
                                                        key={user.id}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.05 }}
                                                        className="group hover:bg-primary/5 border-b border-primary/5 transition-all duration-300"
                                                    >
                                                        <TableCell className="py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary border border-primary/10 shadow-sm group-hover:scale-110 transition-transform">
                                                                    {user.name.charAt(0)}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span
                                                                        className="font-bold text-foreground group-hover:text-primary cursor-pointer transition-colors text-sm lg:text-base"
                                                                        onClick={() => router.push(`/settings/users/${user.id}`)}
                                                                    >
                                                                        {user.name}
                                                                    </span>
                                                                    {linkedStaff && (
                                                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100 transition-opacity">
                                                                            {linkedStaff.function}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted/20 rounded-md py-1 px-2 group-hover:bg-primary/10 group-hover:text-primary transition-colors">{user.login}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn("px-2 py-0.5 border-none font-semibold flex items-center w-fit", roleCfg.color)}>
                                                                <RoleIcon className="mr-1.5 h-3.5 w-3.5" />
                                                                {roleCfg.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs text-slate-500 font-mono">
                                                            {formatSessionDate(user.createdAt)}
                                                        </TableCell>
                                                        {/* Session columns */}
                                                        <TableCell className="text-center text-xs text-slate-500 font-mono">
                                                            {formatSessionDate(user.lastLoginAt)}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs text-slate-500 font-mono">
                                                            {formatSessionTime(user.lastLoginAt)}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs">
                                                            {user.isSessionActive ? (
                                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5 inline-block" />
                                                                    En cours
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-slate-500 font-mono">{formatDuration(user.lastSessionDuration)}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs text-slate-400 font-mono">
                                                            {user.isSessionActive ? (
                                                                <span className="text-emerald-500">—</span>
                                                            ) : (
                                                                formatElapsed(user.lastLogoutAt)
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {!readOnly && (
                                                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    {user.isSessionActive && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                                                                                    onClick={() => setTerminatingUser(user)}
                                                                                >
                                                                                    <Power className="h-4 w-4" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Clôturer la session</TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                                                                                onClick={() => router.push(`/settings/users/${user.id}`)}
                                                                            >
                                                                                <Pencil className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Modifier le profil</TooltipContent>
                                                                    </Tooltip>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                                                                                onClick={() => setDeletingUser(user)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Supprimer le compte</TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </motion.tr>
                                                );
                                            })}
                                        </AnimatePresence>
                                    )}
                                </TableBody>
                            </Table>
                        </TooltipProvider>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* CREATE DIALOG (only for creation, not edit) */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Créer un accès</DialogTitle>
                        <DialogDescription>
                            Configurez les identifiants et les permissions pour un membre du personnel.
                        </DialogDescription>
                    </DialogHeader>
                    <UserForm
                        staffProfiles={staffProfiles}
                        onSubmit={handleCreate}
                        onCancel={() => setIsDialogOpen(false)}
                        isSubmitting={isSubmitting}
                        useStaffNumberAsLogin={useStaffNumberAsLogin}
                        mode="create"
                    />
                </DialogContent>
            </Dialog>

            {/* DELETE ALERT */}
            <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
                <AlertDialogContent className="border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Révoquer l'accès ?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Le compte de <strong>{deletingUser?.name}</strong> sera supprimé. L'accès à l'application sera immédiatement révoqué, mais son profil administratif restera intact.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-200">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
                            Révoquer l'accès
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* FORCE TERMINATE SESSION ALERT */}
            <AlertDialog open={!!terminatingUser} onOpenChange={(open) => !open && setTerminatingUser(null)}>
                <AlertDialogContent className="border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                            <Power className="h-5 w-5" />
                            Clôturer la session ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            La session active de <strong>{terminatingUser?.name}</strong> sera immédiatement terminée. L'utilisateur sera déconnecté lors de sa prochaine interaction avec l'application.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-slate-200">Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleForceTerminate} className="bg-amber-600 hover:bg-amber-700 text-white">
                            Clôturer la session
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* RESET CONFIG ALERT */}
            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent className="border-none shadow-2xl sm:max-w-[550px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                            <ShieldAlert className="h-6 w-6" />
                            ⚠️ Changement de politique critique
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4 pt-2">
                                <p className="text-slate-600 font-medium">
                                    Vous changez le mode de génération des comptes. Pour garantir la cohérence des accès :
                                </p>
                                <div className="bg-rose-50 p-4 border border-rose-100 rounded-xl text-rose-700">
                                    <p className="text-sm font-bold flex items-center gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Action destructrice
                                    </p>
                                    <p className="mt-2 text-sm">
                                        <strong>Tous les comptes actuels ({users.length}) seront supprimés.</strong> Vous devrez re-créer les accès selon la nouvelle politique.
                                    </p>
                                </div>
                                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <strong>Note :</strong> Les profils du personnel ne sont pas affectés. Seuls les accès de connexion (login/password) sont réinitialisés.
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsResetDialogOpen(false)} className="border-slate-200">Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => executeConfigChange(pendingConfigChecked, true)}
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                        >
                            Confirmer la réinitialisation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
}
