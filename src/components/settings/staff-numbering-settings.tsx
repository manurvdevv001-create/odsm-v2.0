'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, RotateCcw, CircleHelp, Info, X, Hash, Layers, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { updateSchoolConfig } from '@/app/setup/actions';
import { cn } from "@/lib/utils";
import { StaffNumberingConfig, DEFAULT_STAFF_NUMBERING, previewStaffNumber, NumberingPolicy } from '@/lib/numbering-utils';
import { toast } from 'sonner';

export default function StaffNumberingSettings() {
    const { schoolData, refreshData } = useSchoolData();
    const [config, setConfig] = useState<StaffNumberingConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<Record<string, string>>({});
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        if (schoolData) {
            const loadedConfig = (schoolData.configuration as any)?.staffNumbering || DEFAULT_STAFF_NUMBERING;
            // Backward compatibility: infer mode if missing
            if (!loadedConfig.mode) {
                loadedConfig.mode = 'default';
            }
            setConfig(loadedConfig);
        }
    }, [schoolData]);

    // Update previews whenever config changes
    useEffect(() => {
        if (!config || !schoolData) return;
        const matricule = (schoolData.matricule as string) || 'ECO';
        setPreview({
            default: previewStaffNumber(config.default, 'Tout profil', matricule),
            direction: config.direction ? previewStaffNumber(config.direction, 'Direction', matricule) : '',
            enseignant: config.enseignant ? previewStaffNumber(config.enseignant, 'Enseignant', matricule) : '',
            administratif: config.administratif ? previewStaffNumber(config.administratif, 'Administratif', matricule) : '',
            technique: config.technique ? previewStaffNumber(config.technique, 'Technique', matricule) : '',
            autre: config.autre ? previewStaffNumber(config.autre, 'Autre', matricule) : '',
            informaticien: config.informaticien ? previewStaffNumber(config.informaticien, 'Système', matricule) : '',
        });
    }, [config, schoolData]);

    const handlePolicyChange = (category: keyof StaffNumberingConfig, field: keyof NumberingPolicy, value: any) => {
        if (!config) return;
        setConfig(prev => {
            if (!prev) return null;
            const currentPolicy = prev[category] || (DEFAULT_STAFF_NUMBERING as any)[category] || prev.default;
            return {
                ...prev,
                [category]: {
                    ...currentPolicy,
                    [field]: value
                }
            };
        });
    };

    const handleModeChange = (mode: 'default' | 'per-profile') => {
        if (!config) return;
        setConfig(prev => {
            if (!prev) return null;
            return { ...prev, mode };
        });
    };

    const handleSave = async () => {
        if (!schoolData || !config) return;
        setLoading(true);
        try {
            const result = await updateSchoolConfig(schoolData.matricule as string, {
                staffNumbering: config
            });

            if (result.success) {
                toast.success("Configuration Personnel mise à jour avec succès");
                refreshData();
            } else {
                toast.error("Erreur: " + result.error);
            }
        } catch (error) {
            toast.error("Erreur inattendue");
        } finally {
            setLoading(false);
        }
    };

    if (!config) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

    const renderPolicyForm = (category: keyof StaffNumberingConfig, title: string) => {
        const policy = config[category] || (DEFAULT_STAFF_NUMBERING as any)[category] || config.default;

        return (
            <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
                    <div className="space-y-6 sm:space-y-8">
                        {/* Format Input */}
                        <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Format du Matricule</Label>
                                <div className="h-px flex-1 bg-primary/5 mx-3 sm:mx-4" />
                            </div>
                            <Input
                                value={policy.format}
                                onChange={(e) => handlePolicyChange(category, 'format', e.target.value)}
                                placeholder="ex: PRF-{YY}-{####}"
                                className="h-11 sm:h-14 rounded-xl sm:rounded-2xl border-primary/10 bg-background/40 focus:ring-primary/20 font-mono font-bold text-primary text-sm sm:text-base shadow-sm transition-all"
                            />
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 pt-1">
                                {['{YY}', '{YYYY}', '{CAT}', '{####}', '{PREFIX}'].map(token => (
                                    <span key={token} className="text-[8px] sm:text-[9px] font-black bg-primary/5 text-primary/60 px-1.5 sm:px-2 py-0.5 rounded-md border border-primary/5">
                                        {token}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Sequence Input */}
                        <div className="space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Séquence Actuelle</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 sm:h-7 px-2 sm:px-3 text-[8px] sm:text-[9px] font-black uppercase tracking-wider sm:tracking-widest text-destructive hover:bg-destructive/10 rounded-lg sm:rounded-xl transition-all"
                                    onClick={() => {
                                        if (window.confirm("Attention: Réinitialiser la séquence peut causer des doublons. Continuer ?")) {
                                            handlePolicyChange(category, 'currentSequence', 0);
                                        }
                                    }}
                                >
                                    <RotateCcw className="mr-1 sm:mr-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5" /> RÉINITIALISER
                                </Button>
                            </div>
                            <div className="relative group">
                                <Input
                                    type="number"
                                    value={policy.currentSequence}
                                    onChange={(e) => handlePolicyChange(category, 'currentSequence', parseInt(e.target.value) || 0)}
                                    className="h-11 sm:h-14 rounded-xl sm:rounded-2xl border-primary/10 bg-background/40 focus:ring-primary/20 font-black text-foreground text-sm sm:text-base shadow-sm transition-all"
                                />
                                <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] font-black text-muted-foreground/40 uppercase tracking-wider sm:tracking-widest">
                                    Suivant: <span className="text-primary">{policy.currentSequence + 1}</span>
                                </div>
                            </div>
                        </div>

                        {/* Reset Switch */}
                        <div className="flex items-center justify-between p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-background/40 border border-primary/5 hover:border-primary/10 transition-all group/switch shadow-sm">
                            <div className="space-y-0.5 sm:space-y-1 pr-3">
                                <Label htmlFor={`reset-${category}`} className="text-[11px] sm:text-xs font-black text-foreground/80 uppercase tracking-wider sm:tracking-widest cursor-pointer">Réinitialisation annuelle</Label>
                                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground opacity-60">Repartir de 1 à chaque nouvelle année scolaire</p>
                            </div>
                            <Switch
                                id={`reset-${category}`}
                                checked={policy.resetYearly}
                                onCheckedChange={(checked) => handlePolicyChange(category, 'resetYearly', checked)}
                                className="data-[state=checked]:bg-primary shrink-0"
                            />
                        </div>
                    </div>

                    {/* Preview Card */}
                    <div className="relative h-full min-h-[180px] sm:min-h-[220px]">
                        <div className="absolute inset-0 bg-primary/5 rounded-2xl sm:rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                        <motion.div
                            whileHover={{ scale: 1.02, rotate: 1 }}
                            className="relative h-full p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-gradient-to-br from-primary/10 via-background/40 to-background/60 border border-primary/10 flex flex-col justify-center items-center text-center space-y-4 sm:space-y-6 overflow-hidden shadow-2xl"
                        >
                            <div className="absolute -top-10 -right-10 p-2 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
                                <Info size={280} />
                            </div>

                            <div className="space-y-1.5 sm:space-y-2 relative">
                                <Label className="text-[9px] sm:text-[10px] font-black uppercase text-primary tracking-[0.2em] sm:tracking-[0.3em] opacity-60">Aperçu Matricule</Label>
                                <div className="h-1 w-6 sm:w-8 bg-primary/20 mx-auto rounded-full" />
                            </div>

                            <div className="relative group/preview max-w-full">
                                <div className="absolute inset-0 bg-primary blur-xl opacity-10 group-hover/preview:opacity-20 transition-opacity" />
                                <div className="relative text-xl sm:text-3xl md:text-4xl font-mono font-black text-primary bg-background/80 backdrop-blur-md px-5 sm:px-10 py-3.5 sm:py-6 rounded-2xl sm:rounded-3xl border-2 border-primary/10 shadow-2xl transition-all hover:scale-105 hover:rotate-1 duration-500 tracking-tighter truncate max-w-full">
                                    {preview[category as string]}
                                </div>
                            </div>

                            <div className="space-y-0.5 sm:space-y-1">
                                <p className="text-[10px] sm:text-[11px] font-black text-foreground/70 uppercase tracking-wider sm:tracking-widest">Profil: {title}</p>
                                <p className="text-[9px] sm:text-[10px] font-medium text-muted-foreground italic opacity-60 max-w-[200px]">
                                    Format appliqué aux prochains membres
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        );
    };

    const isPerProfile = config.mode === 'per-profile';

    return (
        <div className="relative group/main">
            {/* Background Decorative Elements */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -z-10 animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] -z-10 animate-pulse" />

            <div className="glass-card bg-card/40 backdrop-blur-3xl rounded-2xl sm:rounded-[2.5rem] border border-white/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col transition-all duration-700 hover:shadow-[0_48px_80px_-16px_rgba(0,0,0,0.15)]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 p-4 sm:p-8 md:p-12 border-b border-primary/5 bg-white/5">
                    <div className="space-y-1.5 sm:space-y-2 text-left">
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight">Politique de <span className="text-primary italic font-light">Matricule</span></h2>
                        <div className="flex items-center gap-2 sm:gap-3 justify-start">
                            <div className="h-1 w-8 sm:w-12 bg-primary rounded-full" />
                            <p className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] sm:tracking-[0.3em] opacity-60">
                                Configuration structurelle
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 h-10 sm:h-12 px-4 sm:px-8 rounded-xl sm:rounded-2xl border-primary/10 bg-background/40 hover:bg-primary/10 text-primary font-black text-[9px] sm:text-[10px] uppercase tracking-[0.2em] transition-all shadow-sm group/help self-start sm:self-auto"
                        onClick={() => setShowHelp(true)}
                    >
                        <CircleHelp className="h-4 w-4 group-hover/help:rotate-12 transition-transform" />
                        Guide Technique
                    </Button>
                </div>

                <div className="p-4 sm:p-8 md:p-12 space-y-8 sm:space-y-12 md:space-y-16">
                    {/* ÉTAPE 1 — Mode Selector */}
                    <div className="space-y-4 sm:space-y-8">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="bg-primary text-white rounded-xl sm:rounded-2xl w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-primary/20 font-black shrink-0">01</div>
                            <div className="space-y-0.5">
                                <Label className="text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.2em] sm:tracking-[0.3em]">Étape 1</Label>
                                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Choisir le mode de numérotation</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                            {/* Option 1: Matricule unique */}
                            <button
                                type="button"
                                onClick={() => handleModeChange('default')}
                                className={cn(
                                    "relative flex flex-col gap-4 sm:gap-6 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 text-left transition-all duration-500 group/btn overflow-hidden",
                                    !isPerProfile
                                        ? "border-primary bg-primary/5 shadow-2xl shadow-primary/10 ring-4 sm:ring-8 ring-primary/5 scale-[1.01] sm:scale-[1.02]"
                                        : "border-primary/5 bg-muted/20 hover:border-primary/20 hover:bg-muted/30"
                                )}
                            >
                                {!isPerProfile && (
                                    <div className="absolute top-4 sm:top-6 right-4 sm:right-6 animate-in zoom-in duration-500">
                                        <div className="bg-primary text-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg">
                                            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </div>
                                    </div>
                                )}
                                <div className={cn(
                                    "p-3 sm:p-4 rounded-xl sm:rounded-2xl w-fit transition-all duration-500",
                                    !isPerProfile ? "bg-primary text-white shadow-xl shadow-primary/30 rotate-3" : "bg-background/60 text-muted-foreground group-hover/btn:text-primary group-hover/btn:scale-110"
                                )}>
                                    <Hash className="h-6 w-6 sm:h-8 sm:w-8" />
                                </div>
                                <div>
                                    <h3 className={cn(
                                        "font-black text-lg sm:text-xl tracking-tight transition-colors",
                                        !isPerProfile ? "text-primary" : "text-foreground/70"
                                    )}>
                                        Matricule unique
                                    </h3>
                                    <p className="text-xs font-medium text-muted-foreground mt-1.5 sm:mt-2 leading-relaxed opacity-70">
                                        Un format <strong>standardisé</strong> pour l'ensemble du personnel. Simple et efficace.
                                    </p>
                                </div>
                            </button>

                            {/* Option 2: Par profil */}
                            <button
                                type="button"
                                onClick={() => handleModeChange('per-profile')}
                                className={cn(
                                    "relative flex flex-col gap-4 sm:gap-6 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 text-left transition-all duration-500 group/btn overflow-hidden",
                                    isPerProfile
                                        ? "border-primary bg-primary/5 shadow-2xl shadow-primary/10 ring-4 sm:ring-8 ring-primary/5 scale-[1.01] sm:scale-[1.02]"
                                        : "border-primary/5 bg-muted/20 hover:border-primary/20 hover:bg-muted/30"
                                )}
                            >
                                {isPerProfile && (
                                    <div className="absolute top-4 sm:top-6 right-4 sm:right-6 animate-in zoom-in duration-500">
                                        <div className="bg-primary text-white p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg">
                                            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </div>
                                    </div>
                                )}
                                <div className={cn(
                                    "p-3 sm:p-4 rounded-xl sm:rounded-2xl w-fit transition-all duration-500",
                                    isPerProfile ? "bg-primary text-white shadow-xl shadow-primary/30 -rotate-3" : "bg-background/60 text-muted-foreground group-hover/btn:text-primary group-hover/btn:scale-110"
                                )}>
                                    <Layers className="h-6 w-6 sm:h-8 sm:w-8" />
                                </div>
                                <div>
                                    <h3 className={cn(
                                        "font-black text-lg sm:text-xl tracking-tight transition-colors",
                                        isPerProfile ? "text-primary" : "text-foreground/70"
                                    )}>
                                        Par profil
                                    </h3>
                                    <p className="text-xs font-medium text-muted-foreground mt-1.5 sm:mt-2 leading-relaxed opacity-70">
                                        Des formats <strong>spécifiques</strong> (Direction, Enseignant, Admin…). Idéal pour les structures complexes.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ÉTAPE 2 — Configuration Forms */}
                    <div className="space-y-6 sm:space-y-10">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="bg-primary text-white rounded-xl sm:rounded-2xl w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs sm:text-sm shadow-lg shadow-primary/20 font-black shrink-0">02</div>
                            <div className="space-y-0.5">
                                <Label className="text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-[0.2em] sm:tracking-[0.3em]">Étape 2</Label>
                                <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">Définir les structures de données</h3>
                            </div>
                        </div>

                        {!isPerProfile ? (
                            <div className="p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[3rem] bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 shadow-inner animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-10">
                                    <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl sm:rounded-2xl shadow-sm">
                                        <Hash className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-foreground tracking-tight uppercase text-xs tracking-[0.2em]">Format Universel Actif</h3>
                                        <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground opacity-60">Configuration globale pour tout le personnel</p>
                                    </div>
                                </div>
                                {renderPolicyForm('default', 'Tout profil')}
                            </div>
                        ) : (
                            <Tabs defaultValue="direction" className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <TabsList className="bg-muted/30 p-1.5 sm:p-2 rounded-xl sm:rounded-[2rem] border border-primary/5 mb-6 sm:mb-10 grid grid-cols-3 sm:grid-cols-6 w-full h-auto gap-1 sm:gap-1.5 shadow-inner">
                                    <TabsTrigger value="direction" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Direction</TabsTrigger>
                                    <TabsTrigger value="enseignant" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Enseignants</TabsTrigger>
                                    <TabsTrigger value="administratif" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Admin</TabsTrigger>
                                    <TabsTrigger value="technique" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Technique</TabsTrigger>
                                    <TabsTrigger value="autre" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Autre</TabsTrigger>
                                    <TabsTrigger value="informaticien" className="rounded-lg sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all duration-300 h-10 sm:h-12">Système</TabsTrigger>
                                </TabsList>

                                <div className="p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[3rem] bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 shadow-inner">
                                    <TabsContent value="direction" className="mt-0 outline-none">
                                        {renderPolicyForm('direction', 'Direction')}
                                    </TabsContent>
                                    <TabsContent value="enseignant" className="mt-0 outline-none">
                                        {renderPolicyForm('enseignant', 'Enseignant')}
                                    </TabsContent>
                                    <TabsContent value="administratif" className="mt-0 outline-none">
                                        {renderPolicyForm('administratif', 'Administratif')}
                                    </TabsContent>
                                    <TabsContent value="technique" className="mt-0 outline-none">
                                        {renderPolicyForm('technique', 'Technique')}
                                    </TabsContent>
                                    <TabsContent value="autre" className="mt-0 outline-none">
                                        {renderPolicyForm('autre', 'Autre')}
                                    </TabsContent>
                                    <TabsContent value="informaticien" className="mt-0 outline-none">
                                        {renderPolicyForm('informaticien', 'Système')}
                                    </TabsContent>
                                </div>
                            </Tabs>
                        )}
                    </div>
                </div>

                <div className="flex justify-end p-5 sm:p-8 md:p-12 bg-primary/5 border-t border-primary/5">
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full sm:w-auto gap-3 sm:gap-4 rounded-2xl sm:rounded-3xl px-6 sm:px-12 h-14 sm:h-20 font-black text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-[0_20px_40px_-12px_rgba(var(--primary-rgb),0.3)] transition-all hover:scale-[1.03] active:scale-[0.97] bg-primary hover:bg-primary/90 text-white"
                    >
                        {loading ? <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" /> : <Save className="h-5 w-5 sm:h-6 sm:w-6" />}
                        Valider &amp; Appliquer
                    </Button>
                </div>
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 bg-background/40 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-card/80 backdrop-blur-2xl rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-primary/10"
                    >
                        <div className="p-10 border-b border-primary/5 flex justify-between items-center bg-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                                    <Info size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-foreground tracking-tight">Guide de <span className="text-primary italic font-light">Numérotation</span></h2>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">Documentation technique</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="p-4 hover:bg-primary/10 rounded-2xl transition-all text-muted-foreground hover:text-primary hover:rotate-90 duration-300"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <ScrollArea className="flex-1 p-10">
                            <div className="space-y-12">
                                <section className="space-y-4">
                                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="w-8 h-[1px] bg-primary/20" />
                                        Principes de base
                                    </h3>
                                    <p className="text-sm font-medium text-foreground/70 leading-relaxed">
                                        Combinez du texte fixe, des séparateurs (/, -, .) et des jetons dynamiques. Les jetons sont remplacés automatiquement lors de la génération du matricule.
                                    </p>
                                </section>

                                {/* Tokens */}
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="w-8 h-[1px] bg-primary/20" />
                                        Jetons Disponibles
                                    </h3>
                                    <div className="grid gap-3">
                                        {[
                                            { t: '{YY}', d: 'Année courte (ex: 26)', n: 'Année civile' },
                                            { t: '{YYYY}', d: 'Année longue (ex: 2026)', n: 'Année civile' },
                                            { t: '{SY2}', d: 'Année scol. courte (ex: 25-26)', n: 'Année scolaire' },
                                            { t: '{SY4}', d: 'Année scol. longue (ex: 2025-2026)', n: 'Année scolaire' },
                                            { t: '{CAT}', d: 'Code du profil (ex: DIR, PRF, ADM)', n: 'Profil' },
                                            { t: '{PREFIX}', d: 'Matricule de l\'école', n: 'Identifiant global' },
                                            { t: '{#}, {##}, ...', d: 'Séquence numérique', n: 'Compteur (0-9)' },
                                            { t: '{A}, {AA}, ...', d: 'Séquence alphabétique', n: 'Compteur (A-Z)' },
                                        ].map((item, i) => (
                                            <div key={i} className="p-4 bg-muted/20 rounded-2xl border border-primary/5 flex gap-5 items-center group hover:bg-primary/5 hover:border-primary/20 transition-all duration-300">
                                                <code className="bg-background px-4 py-2 rounded-xl border border-primary/10 text-primary font-mono font-black text-xs shadow-sm">{item.t}</code>
                                                <div>
                                                    <p className="font-black text-foreground/80 text-xs uppercase tracking-widest">{item.n}</p>
                                                    <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{item.d}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Examples */}
                                <section className="space-y-6">
                                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
                                        <div className="w-8 h-[1px] bg-primary/20" />
                                        Exemples de Formats
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { fmt: 'PRF-{YY}-{####}', res: 'PRF-26-0042', lab: 'Enseignant classique' },
                                            { fmt: '{CAT}/{YYYY}/{####}', res: 'DIR/2026/0042', lab: 'Administratif' },
                                            { fmt: '{YY}{####}', res: '260042', lab: 'Compact' },
                                            { fmt: 'STF/{SY2}/{####}', res: 'STF/25-26/0042', lab: 'Scolaire' },
                                        ].map((ex, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 bg-muted/10 rounded-[1.5rem] border border-transparent hover:border-primary/10 transition-all duration-300 group/ex">
                                                <div className="space-y-1">
                                                    <span className="font-black text-muted-foreground uppercase tracking-[0.2em] text-[8px] opacity-60">{ex.lab}</span>
                                                    <p className="font-mono font-bold text-foreground/70 text-xs">{ex.fmt}</p>
                                                </div>
                                                <div className="font-mono font-black text-primary bg-primary/10 px-4 py-2 rounded-xl text-xs border border-primary/10 shadow-inner">
                                                    {ex.res}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </ScrollArea>

                        <div className="p-8 border-t border-primary/5 flex justify-end bg-primary/5">
                            <Button
                                onClick={() => setShowHelp(false)}
                                className="rounded-2xl px-10 h-12 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20"
                            >
                                Compris
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
