'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { getUserById, updateUserProfile, resetUserPassword } from './actions';
import { setup2FA, enable2FA, disable2FA } from '../actions';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    ArrowLeft,
    Loader2,
    Save,
    KeyRound,
    ShieldCheck,
    ShieldAlert,
    UserCog,
    UserCheck,
    User,
    Users,
    Scale,
    GraduationCap,
    LayoutDashboard,
    Clock,
    Eye,
    EyeOff,
    QrCode,
} from 'lucide-react';
import { STAFF_FUNCTIONS, STAFF_CATEGORIES, FUNCTION_TO_ROLE_MAP } from '@/lib/staff-definitions';
import { Combobox } from '@/components/ui/combobox';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

const TIMEOUT_OPTIONS = [
    { value: '10', label: '10 minutes' },
    { value: '20', label: '20 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '40', label: '40 minutes' },
    { value: '50', label: '50 minutes' },
    { value: '60', label: '1 heure' },
    { value: '70', label: '1h 10min' },
    { value: '80', label: '1h 20min' },
    { value: '90', label: '1h 30min' },
    { value: '100', label: '1h 40min' },
    { value: '110', label: '1h 50min' },
    { value: '120', label: '2 heures' },
    { value: '0', label: 'Jamais' },
];

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;
    const { schoolData } = useSchoolData();

    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [login, setLogin] = useState('');
    const [role, setRole] = useState('TEACHER');
    const [isTitulaire, setIsTitulaire] = useState(false);
    const [titulaireClassId, setTitulaireClassId] = useState('');
    const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState('30');
    const [multipleSessionsEnabled, setMultipleSessionsEnabled] = useState(false);

    // Password dialog
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // 2FA state
    const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [tempSecret, setTempSecret] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isEnabling2FA, setIsEnabling2FA] = useState(false);

    // Access Schedule state
    const [isScheduleRestricted, setIsScheduleRestricted] = useState(false);
    const [startHour, setStartHour] = useState('08:00');
    const [endHour, setEndHour] = useState('18:00');
    const [allowedDays, setAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default

    const staffProfiles = schoolData?.teachers || [];

    useEffect(() => {
        if (schoolData?.matricule && userId) {
            loadUser();
        }
    }, [schoolData?.matricule, userId]);

    const loadUser = async () => {
        setIsLoading(true);
        const data = await getUserById(schoolData.matricule as string, userId);
        if (data) {
            setUser(data);
            setName(data.name || '');
            setLogin(data.login || '');
            setRole(data.role || 'TEACHER');
            setIsTitulaire(data.isTitulaire || false);
            setTitulaireClassId(data.titulaireClassId || '');
            setSessionTimeoutMinutes(String(data.sessionTimeoutMinutes ?? 30));
            setMultipleSessionsEnabled(data.multipleSessionsEnabled || false);
            
            if (data.accessSchedule) {
                const schedule: any = data.accessSchedule;
                setIsScheduleRestricted(true);
                setStartHour(schedule.start);
                setEndHour(schedule.end);
                setAllowedDays(schedule.days);
            } else {
                setIsScheduleRestricted(false);
            }
        } else {
            toast.error("Utilisateur non trouvé");
            router.push('/settings/users');
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!schoolData?.matricule) return;
        setIsSaving(true);

        const result = await updateUserProfile(schoolData.matricule as string, userId, {
            name,
            login,
            role,
            isTitulaire,
            titulaireClassId: isTitulaire ? titulaireClassId : undefined,
            sessionTimeoutMinutes: parseInt(sessionTimeoutMinutes),
            accessSchedule: isScheduleRestricted ? {
                start: startHour,
                end: endHour,
                days: allowedDays
            } : null,
            multipleSessionsEnabled
        });

        if (result.success) {
            toast.success("Profil mis à jour", {
                description: `Les modifications pour ${name} ont été enregistrées.`,
            });
        } else {
            toast.error("Erreur", {
                description: result.error || "Échec de la mise à jour.",
            });
        }
        setIsSaving(false);
    };

    const handleResetPassword = async () => {
        if (!schoolData?.matricule) return;
        if (newPassword !== confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas.");
            return;
        }
        if (newPassword.length < 6) {
            toast.error("Le mot de passe doit avoir au moins 6 caractères.");
            return;
        }
        setIsResettingPassword(true);

        const result = await resetUserPassword(schoolData.matricule as string, userId, newPassword);

        if (result.success) {
            toast.success("Mot de passe réinitialisé", {
                description: `Le nouveau mot de passe pour ${name} a été enregistré.`,
            });
            setIsPasswordDialogOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } else {
            toast.error("Erreur", {
                description: result.error || "Échec de la réinitialisation.",
            });
        }
        setIsResettingPassword(false);
    };

    const handleSetup2FA = async () => {
        if (!schoolData?.matricule) return;
        
        setIsEnabling2FA(true);
        const email = login.includes('@') ? login : `${login}@odsm.school`;
        const result = await setup2FA(schoolData.matricule as string, userId, email);
        
        if (result.success && result.qrCode && result.secret) {
            setQrCode(result.qrCode);
            setTempSecret(result.secret);
            setIs2FADialogOpen(true);
        } else {
            toast.error(result.error || "Échec de la génération du 2FA.");
        }
        setIsEnabling2FA(false);
    };

    const handleEnable2FA = async () => {
        if (!schoolData?.matricule || !verificationCode) return;
        
        setIsEnabling2FA(true);
        const result = await enable2FA(schoolData.matricule as string, userId, tempSecret, verificationCode);
        
        if (result.success) {
            toast.success("Double authentification activée !");
            setIs2FADialogOpen(false);
            setVerificationCode('');
            loadUser(); // Reload to update UI
        } else {
            toast.error(result.error || "Code invalide.");
        }
        setIsEnabling2FA(false);
    };

    const handleDisable2FA = async () => {
        if (!schoolData?.matricule) return;
        
        if (!confirm("Êtes-vous sûr de vouloir désactiver la protection 2FA pour cet utilisateur ? Cela réduit la sécurité du compte.")) return;
        
        setIsEnabling2FA(true);
        const result = await disable2FA(schoolData.matricule as string, userId);
        
        if (result.success) {
            toast.success("2FA désactivé.");
            loadUser();
        } else {
            toast.error(result.error || "Échec de la désactivation.");
        }
        setIsEnabling2FA(false);
    };

    const linkedStaff = staffProfiles.find((s: any) => s.id === user?.staffId);
    const roleCfg = roleLabels[role] || { label: role, color: 'bg-slate-100 text-slate-600', icon: User };
    const RoleIcon = roleCfg.icon;

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="text-slate-500 font-medium">Chargement du profil...</span>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 p-1 max-w-3xl mx-auto"
        >
            {/* Header */}
            <div className="flex items-center gap-5 relative">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/settings/users')}
                    className="h-12 w-12 rounded-2xl hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 glass-card bg-muted/20"
                >
                    <ArrowLeft className="h-6 w-6 text-primary" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-2xl text-primary border border-primary/10 shadow-inner group-hover:scale-105 transition-transform">
                            {user.name?.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-foreground">{user.name}</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <Badge className={cn("px-3 py-0.5 border-none font-bold text-xs flex items-center w-fit shadow-sm", roleCfg.color)}>
                                    <RoleIcon className="mr-2 h-3.5 w-3.5" />
                                    {roleCfg.label}
                                </Badge>
                                {linkedStaff && (
                                    <span className="text-xs text-muted-foreground font-black uppercase tracking-widest opacity-70">
                                        {linkedStaff.function}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-2 h-16 bg-primary/20 rounded-full blur-[4px]" />
            </div>

            {/* Profile Edit Card */}
            <Card className="glass-card border-none shadow-2xl bg-card/40 backdrop-blur-2xl overflow-hidden hover:shadow-primary/5 transition-all duration-500">
                <CardHeader className="border-b border-primary/5 bg-primary/5 backdrop-blur-md py-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl shadow-inner border border-primary/20">
                            <UserCog className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight text-foreground">Informations du compte</CardTitle>
                            <CardDescription className="font-bold text-muted-foreground">Modifier les informations de connexion et les permissions.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Staff profile (read-only) */}
                    {linkedStaff && (
                        <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 shadow-inner relative overflow-hidden group">
                            <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-primary/10 transition-colors" />
                            <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Profil lié</Label>
                            <p className="text-base font-black text-foreground mt-1">
                                {linkedStaff.lastName} {linkedStaff.middleName || ''} {linkedStaff.firstName}
                            </p>
                            <p className="text-xs text-muted-foreground font-bold mt-0.5">{linkedStaff.function} — {linkedStaff.category}</p>
                        </div>
                    )}

                    {/* Display Name */}
                    <div className="space-y-2.5">
                        <Label htmlFor="edit-name" className="text-sm font-black text-foreground/80 tracking-wide ml-1">Nom d'affichage</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={cn(
                                "h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 focus:ring-primary/20 transition-all font-bold",
                                linkedStaff && "opacity-80 grayscale-[0.5]"
                            )}
                            readOnly={!!linkedStaff}
                        />
                    </div>

                    {/* Login */}
                    <div className="space-y-2.5">
                        <Label htmlFor="edit-login" className="text-sm font-black text-foreground/80 tracking-wide ml-1">Nom d'utilisateur (Login)</Label>
                        <Input
                            id="edit-login"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="Ex: jmukendi"
                            className="h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 focus:ring-primary/20 transition-all font-mono font-bold"
                        />
                    </div>

                    {/* Role */}
                    <div className="space-y-2.5">
                        <Label className="text-sm font-black text-foreground/80 tracking-wide ml-1">Rôle (Permissions ODSM)</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger className="h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 transition-all font-bold">
                                <SelectValue placeholder="Sélectionnez un rôle" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-primary/10 shadow-2xl">
                                <SelectItem value="ADMIN_SYSTEM">Administrateur Système (Informaticiens)</SelectItem>
                                {(() => {
                                    const roleGroups: Record<string, string[]> = {};
                                    Object.entries(STAFF_FUNCTIONS).forEach(([cat, funcs]) => {
                                        if (cat === STAFF_CATEGORIES.SOUTIEN) return;
                                        (funcs as any).forEach((func: string) => {
                                            const r = FUNCTION_TO_ROLE_MAP[func] || 'TEACHER';
                                            if (r === 'ADMIN_SYSTEM') return;
                                            if (!roleGroups[r]) roleGroups[r] = [];
                                            roleGroups[r].push(func);
                                        });
                                    });

                                    const labels: Record<string, string> = {
                                        SUPERVISOR: "Superviseur / Direction",
                                        SECRETARY: "Secrétariat",
                                        CASHIER: "Percepteur / Caisse",
                                        SECRETARY_CASHIER: "Secrétariat & Perception",
                                        PREFET: "Préfet des Études (Dir. Discipline)",
                                        DISCIPLINE: "Discipline",
                                        TEACHER: "Enseignant"
                                    };

                                    return Object.entries(roleGroups).map(([r, funcs]) => (
                                        <SelectItem key={r} value={r}>
                                            {labels[r] || r}
                                        </SelectItem>
                                    ));
                                })()}
                                <SelectItem value="SECRETARY_CASHIER">Secrétariat &amp; Perception</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Teacher-specific: Titularity */}
                    {role === 'TEACHER' && (
                        <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-5 shadow-inner">
                            <div className="flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <Label className="text-sm font-black text-foreground tracking-tight">Titularité</Label>
                                    <p className="text-[11px] text-muted-foreground font-bold">Enseignant responsable d'une classe ?</p>
                                </div>
                                <Switch
                                    checked={isTitulaire}
                                    onCheckedChange={setIsTitulaire}
                                    className="data-[state=checked]:bg-primary"
                                />
                            </div>
                            {isTitulaire && (
                                <div className="space-y-2.5 animate-in slide-in-from-top-2 duration-300">
                                    <Label className="text-xs font-black text-foreground/70 ml-1">Classe de titularité</Label>
                                    <Input
                                        value={titulaireClassId}
                                        onChange={(e) => setTitulaireClassId(e.target.value)}
                                        placeholder="Ex: 3ème Humanité A"
                                        className="h-11 rounded-xl border-primary/10 bg-background/50 focus:bg-background font-bold"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Session & Security Card */}
            <Card className="glass-card border-none shadow-2xl bg-card/40 backdrop-blur-2xl overflow-hidden hover:shadow-amber-500/5 transition-all duration-500">
                <CardHeader className="border-b border-amber-500/5 bg-amber-500/5 backdrop-blur-md py-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-2xl shadow-inner border border-amber-500/20">
                            <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight text-foreground">Sécurité & Session</CardTitle>
                            <CardDescription className="font-bold text-muted-foreground">Configurer le timeout d'inactivité et gérer le mot de passe.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Inactivity Timeout */}
                    <div className="space-y-3">
                        <Label className="text-sm font-black text-foreground/80 tracking-wide ml-1">Temps d'inactivité avant déconnexion</Label>
                        <Select value={sessionTimeoutMinutes} onValueChange={setSessionTimeoutMinutes}>
                            <SelectTrigger className="h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 transition-all font-bold">
                                <SelectValue placeholder="Sélectionnez un délai" />
                            </SelectTrigger>
                            <SelectContent className="glass-card border-primary/10 shadow-2xl">
                                {TIMEOUT_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value} className="font-bold">
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground font-bold px-1">
                            La session sera automatiquement fermée après cette période d'inactivité.
                            {sessionTimeoutMinutes === '0' && (
                                <span className="text-amber-600 font-black ml-1.5 uppercase tracking-wider">⚠️ Risque de sécurité : Jamais fermé</span>
                            )}
                        </p>
                    </div>

                    {/* Multiple Sessions Toggle */}
                    <div className="flex items-center justify-between bg-muted/20 p-5 rounded-2xl border border-primary/5 shadow-inner">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black text-foreground tracking-tight">Sessions multiples</p>
                            <p className="text-[11px] text-muted-foreground font-bold">Permettre la connexion simultanée sur plusieurs appareils.</p>
                        </div>
                        <Switch
                            checked={multipleSessionsEnabled}
                            onCheckedChange={setMultipleSessionsEnabled}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>

                    {/* Password Reset Button */}
                    <div className="flex items-center justify-between bg-amber-500/5 p-5 rounded-2xl border border-amber-500/10 shadow-inner">
                        <div className="space-y-0.5">
                            <p className="text-sm font-black text-foreground tracking-tight">Mot de passe</p>
                            <p className="text-[11px] text-muted-foreground font-bold">Réinitialiser le mot de passe de l'utilisateur.</p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setIsPasswordDialogOpen(true)}
                            className="h-10 px-5 rounded-xl border-amber-500/20 bg-background/50 hover:bg-amber-500/10 text-amber-600 font-bold transition-all shadow-sm"
                        >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Réinitialiser
                        </Button>
                    </div>

                    {/* Access Schedule Section */}
                    <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 shadow-inner space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <p className="text-sm font-black text-foreground tracking-tight">Plage horaire d'accès</p>
                                <p className="text-[11px] text-muted-foreground font-bold">Restreindre l'accès à certaines heures et jours.</p>
                            </div>
                            <Switch
                                checked={isScheduleRestricted}
                                onCheckedChange={setIsScheduleRestricted}
                                className="data-[state=checked]:bg-primary"
                            />
                        </div>
                        
                        {isScheduleRestricted && (
                            <div className="space-y-5 animate-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-hour" className="text-[11px] font-black text-foreground/70 ml-1 uppercase tracking-wider">Début</Label>
                                        <Input
                                            id="start-hour"
                                            type="time"
                                            value={startHour}
                                            onChange={(e) => setStartHour(e.target.value)}
                                            className="h-11 rounded-xl border-primary/10 bg-background/50 focus:bg-background font-bold px-4"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-hour" className="text-[11px] font-black text-foreground/70 ml-1 uppercase tracking-wider">Fin</Label>
                                        <Input
                                            id="end-hour"
                                            type="time"
                                            value={endHour}
                                            onChange={(e) => setEndHour(e.target.value)}
                                            className="h-11 rounded-xl border-primary/10 bg-background/50 focus:bg-background font-bold px-4"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[11px] font-black text-foreground/70 ml-1 uppercase tracking-wider">Jours autorisés</Label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    if (allowedDays.includes(idx)) {
                                                        setAllowedDays(allowedDays.filter(d => d !== idx));
                                                    } else {
                                                        setAllowedDays([...allowedDays, idx]);
                                                    }
                                                }}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl text-xs font-black transition-all border shadow-sm",
                                                    allowedDays.includes(idx)
                                                        ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                                                        : "bg-background/50 border-primary/10 text-muted-foreground hover:border-primary/30 hover:bg-background"
                                                )}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2FA Section */}
                    <div className="flex items-center justify-between bg-primary/5 p-5 rounded-2xl border border-primary/10 shadow-inner">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <p className="text-sm font-black text-foreground tracking-tight">Double Authentification (2FA)</p>
                                {user.twoFactorEnabled ? (
                                    <Badge className="bg-emerald-500 hover:bg-emerald-600 border-none text-[10px] h-5 font-black px-2 shadow-sm">ACTIVÉ</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-primary/10 text-[10px] h-5 font-black px-2 shadow-inner">DÉSACTIVÉ</Badge>
                                )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-bold">Google Authenticator pour une sécurité accrue.</p>
                        </div>
                        {user.twoFactorEnabled ? (
                            <Button
                                variant="outline"
                                onClick={handleDisable2FA}
                                disabled={isEnabling2FA}
                                className="h-10 px-5 rounded-xl border-rose-500/20 bg-background/50 hover:bg-rose-500/10 text-rose-600 font-bold transition-all shadow-sm"
                            >
                                {isEnabling2FA ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                                Désactiver
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={handleSetup2FA}
                                disabled={isEnabling2FA}
                                className="h-10 px-5 rounded-xl border-primary/20 bg-background/50 hover:bg-primary/10 text-primary font-bold transition-all shadow-sm"
                            >
                                {isEnabling2FA ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="mr-2 h-4 w-4" />}
                                Configurer
                            </Button>
                        )}
                    </div>

                    {/* Session Info */}
                    {user.lastLoginAt && (
                        <div className="bg-muted/20 p-5 rounded-2xl border border-primary/5 shadow-inner space-y-3">
                            <Label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Dernière session</Label>
                            <div className="grid grid-cols-2 gap-6 text-sm">
                                <div>
                                    <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Date & Heure</span>
                                    <p className="font-black text-foreground mt-1 text-sm lg:text-base">
                                        {new Date(user.lastLoginAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                        <span className="text-primary mx-2">/</span>
                                        {new Date(user.lastLoginAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground text-[10px] font-black uppercase tracking-wider">Statut</span>
                                    <p className="font-black mt-1">
                                        {user.isSessionActive ? (
                                            <span className="text-emerald-500 flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                ACTIF
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground/60 flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                                                HORS LIGNE
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pb-12 mt-4">
                <Button
                    variant="outline"
                    onClick={() => router.push('/settings/users')}
                    className="h-12 px-8 rounded-xl border-primary/10 font-bold hover:bg-muted/50 transition-all"
                >
                    Annuler
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="gradient-btn h-12 px-10 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    {isSaving ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Save className="mr-3 h-5 w-5" />}
                    Enregistrer les modifications
                </Button>
            </div>

            {/* Password Reset Dialog */}
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogContent className="sm:max-w-[450px] border-none shadow-2xl glass-card bg-card/60 backdrop-blur-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 bg-amber-500/5 border-b border-amber-500/10">
                        <DialogTitle className="text-2xl font-black flex items-center gap-3 text-foreground">
                            <div className="p-2 bg-amber-500/10 rounded-xl shadow-inner">
                                <KeyRound className="h-6 w-6 text-amber-600" />
                            </div>
                            Mot de passe
                        </DialogTitle>
                        <DialogDescription className="font-bold text-muted-foreground mt-2">
                            Définir un nouveau mot de passe pour <span className="text-foreground">{user.name}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2.5">
                            <Label htmlFor="new-password" className="text-xs font-black text-foreground/70 uppercase tracking-widest ml-1">Nouveau mot de passe</Label>
                            <div className="relative group">
                                <Input
                                    id="new-password"
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Min. 6 caractères"
                                    className="h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 transition-all font-mono font-bold pr-12"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-10 w-10 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            <Label htmlFor="confirm-password" className="text-xs font-black text-foreground/70 uppercase tracking-widest ml-1">Confirmer le mot de passe</Label>
                            <Input
                                id="confirm-password"
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Retapez le mot de passe"
                                className="h-12 rounded-xl border-primary/10 bg-muted/20 focus:bg-muted/30 transition-all font-mono font-bold"
                            />
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider px-1">Les mots de passe ne correspondent pas.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsPasswordDialogOpen(false);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                className="h-11 rounded-xl border-primary/10 font-bold"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleResetPassword}
                                disabled={isResettingPassword || !newPassword || newPassword !== confirmPassword}
                                className="h-11 px-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {isResettingPassword ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <KeyRound className="mr-2 h-5 w-5" />}
                                Réinitialiser
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 2FA Setup Dialog */}
            <Dialog open={is2FADialogOpen} onOpenChange={setIs2FADialogOpen}>
                <DialogContent className="sm:max-w-[450px] border-none shadow-2xl glass-card bg-card/60 backdrop-blur-3xl p-0 overflow-hidden">
                    <DialogHeader className="p-8 pb-4 bg-primary/5 border-b border-primary/10">
                        <DialogTitle className="text-2xl font-black flex items-center gap-3 text-foreground">
                            <div className="p-2 bg-primary/10 rounded-xl shadow-inner">
                                <QrCode className="h-6 w-6 text-primary" />
                            </div>
                            Double Auth (2FA)
                        </DialogTitle>
                        <DialogDescription className="font-bold text-muted-foreground mt-2">
                            Scannez ce code QR avec Google Authenticator pour activer la protection.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="p-8 flex flex-col items-center gap-8">
                        {qrCode ? (
                            <div className="bg-white p-5 rounded-[2rem] shadow-2xl border border-primary/10 relative group">
                                <div className="absolute inset-0 bg-primary/5 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 relative z-10" />
                            </div>
                        ) : (
                            <div className="w-48 h-48 bg-muted/30 rounded-[2rem] flex items-center justify-center animate-pulse border border-primary/5">
                                <Loader2 className="h-10 w-10 animate-spin text-primary/30" />
                            </div>
                        )}
                        
                        <div className="text-center space-y-3 w-full bg-muted/10 p-4 rounded-2xl border border-primary/5 shadow-inner">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Code secret manuel</p>
                            <code className="block bg-background/50 px-4 py-2 rounded-xl text-xs font-mono font-black text-foreground border border-primary/5 break-all select-all">{tempSecret}</code>
                        </div>

                        <div className="w-full space-y-4">
                            <Label htmlFor="v-code" className="text-[10px] font-black text-foreground/70 uppercase tracking-[0.2em] ml-1">Code de vérification</Label>
                            <Input
                                id="v-code"
                                placeholder="0 0 0 0 0 0"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                maxLength={6}
                                className="h-16 rounded-2xl border-primary/10 bg-muted/20 focus:bg-muted/30 transition-all text-center text-3xl tracking-[0.5em] font-black font-mono shadow-inner text-primary"
                            />
                            <p className="text-[10px] text-center text-muted-foreground font-bold px-4">
                                Entrez le code généré par votre application pour confirmer la liaison sécurisée.
                             </p>
                        </div>

                        <div className="flex w-full gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIs2FADialogOpen(false);
                                    setVerificationCode('');
                                }}
                                className="flex-1 h-12 rounded-xl border-primary/10 font-bold"
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleEnable2FA}
                                disabled={isEnabling2FA || verificationCode.length !== 6}
                                className="flex-[2] h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {isEnabling2FA ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-3 h-5 w-5" />}
                                Vérifier et Activer
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
