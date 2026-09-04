"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, FileText, LayoutTemplate, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { updateSchoolConfig } from '@/app/setup/actions';
import { toast } from 'sonner';

const RECEIPT_MODELS = [
    { id: 1, name: "Classique", desc: "Format standard détaillé" },
    { id: 2, name: "Minimaliste", desc: "Épuré et direct" },
    { id: 3, name: "Ticket de Caisse", desc: "Adapté pour imprimante thermique" },
    { id: 4, name: "Colonnes", desc: "Affichage tabulaire compact" },
    { id: 5, name: "Moderne", desc: "Style épuré avec couleurs" },
    { id: 6, name: "Institutionnel", desc: "Format formel complet" },
];

export default function ReceiptSettingsPage() {
    const { schoolData, refreshData } = useSchoolData();
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState({
        model: 1,
        orientation: 'portrait',
        paperSize: 'A4',
        numberFormat: 'REC-{YYYY}-{NO:4}'
    });

    useEffect(() => {
        if (schoolData) {
            const loadedConfig = (schoolData.configuration as any)?.receiptSettings;
            if (loadedConfig) {
                setConfig({
                    model: loadedConfig.model || 1,
                    orientation: loadedConfig.orientation || 'portrait',
                    paperSize: loadedConfig.paperSize || 'A4',
                    numberFormat: loadedConfig.numberFormat || 'REC-{YYYY}-{NO:4}'
                });
            }
        }
    }, [schoolData]);

    const handleSave = async () => {
        if (!schoolData) return;
        setLoading(true);
        try {
            const result = await updateSchoolConfig(schoolData.matricule as string, {
                receiptSettings: config
            });

            if (result.success) {
                toast.success("Paramètres des reçus mis à jour avec succès");
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

    const handleConfigChange = (key: string, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 h-full max-w-5xl mx-auto pb-20 px-4 md:px-0"
        >
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
                <div className="space-y-1">
                    <Link href="/settings">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 pl-0 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors font-bold group"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
                            RETOUR
                        </Button>
                    </Link>
                    <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                        Personnalisation des <span className="text-primary font-light italic">Reçus</span>
                    </h1>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                        Modèles, Impression et Numérotation
                    </p>
                </div>
                <Button onClick={handleSave} disabled={loading} className="gap-2 rounded-xl h-11 px-8 shadow-lg shadow-primary/20">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Enregistrer
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Modèle de Reçu */}
                <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-primary/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/10 rounded-xl">
                                <LayoutTemplate className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Modèle du Reçu</CardTitle>
                                <CardDescription>Sélectionnez le design par défaut</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {RECEIPT_MODELS.map((model) => (
                                <div 
                                    key={model.id}
                                    onClick={() => handleConfigChange('model', model.id)}
                                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                                        config.model === model.id 
                                            ? 'border-primary bg-primary/5' 
                                            : 'border-transparent bg-slate-50 hover:bg-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <div className="font-bold mb-1">Modèle {model.id}</div>
                                    <div className="text-sm font-medium text-foreground">{model.name}</div>
                                    <div className="text-xs text-muted-foreground mt-1">{model.desc}</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Paramètres d'Impression & Numérotation */}
                <div className="space-y-8">
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm">
                        <CardHeader className="bg-orange-500/5 pb-6 border-b border-orange-500/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-orange-500/10 rounded-xl">
                                    <FileText className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Format d'Impression</CardTitle>
                                    <CardDescription>Configuration pour la génération PDF</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-3">
                                <Label className="text-sm font-bold text-slate-700">Taille du Papier</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['A4', 'A5', '80mm'].map((size) => (
                                        <div 
                                            key={size}
                                            onClick={() => handleConfigChange('paperSize', size)}
                                            className={`cursor-pointer text-center p-3 rounded-xl border-2 transition-all font-bold ${
                                                config.paperSize === size 
                                                    ? 'border-orange-500 bg-orange-500/10 text-orange-700' 
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {size}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground">80mm est conçu pour les imprimantes thermiques de caisse.</p>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-bold text-slate-700">Orientation</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'portrait', label: 'Portrait' },
                                        { id: 'landscape', label: 'Paysage' }
                                    ].map((orient) => (
                                        <div 
                                            key={orient.id}
                                            onClick={() => handleConfigChange('orientation', orient.id)}
                                            className={`cursor-pointer text-center p-3 rounded-xl border-2 transition-all font-bold ${
                                                config.orientation === orient.id 
                                                    ? 'border-orange-500 bg-orange-500/10 text-orange-700' 
                                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {orient.label}
                                        </div>
                                    ))}
                                </div>
                                {config.paperSize === '80mm' && config.orientation === 'landscape' && (
                                    <p className="text-xs text-red-500 mt-1">Le format 80mm est généralement en portrait.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white/80 backdrop-blur-sm">
                        <CardHeader className="bg-blue-500/5 pb-6 border-b border-blue-500/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                                    <Settings2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Numérotation</CardTitle>
                                    <CardDescription>Format des numéros de reçus</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700">Format</Label>
                                <Input 
                                    value={config.numberFormat}
                                    onChange={(e) => handleConfigChange('numberFormat', e.target.value)}
                                    className="font-mono text-base"
                                    placeholder="REC-{YYYY}-{NO:4}"
                                />
                                <div className="text-xs text-muted-foreground space-y-1 mt-2 bg-slate-50 p-3 rounded-lg border">
                                    <p><strong>Variables disponibles :</strong></p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li><code className="text-blue-600 bg-blue-50 px-1 rounded">{`{YYYY}`}</code> : Année sur 4 chiffres</li>
                                        <li><code className="text-blue-600 bg-blue-50 px-1 rounded">{`{MM}`}</code> : Mois (01-12)</li>
                                        <li><code className="text-blue-600 bg-blue-50 px-1 rounded">{`{NO:4}`}</code> : Numéro incrémental (le chiffre indique le nombre de zéros, ex: 0001)</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                                <Label className="text-xs uppercase tracking-widest text-primary font-bold">Aperçu (Exemple)</Label>
                                <div className="font-mono text-xl font-black mt-1">
                                    {config.numberFormat
                                        .replace('{YYYY}', new Date().getFullYear().toString())
                                        .replace('{MM}', (new Date().getMonth() + 1).toString().padStart(2, '0'))
                                        .replace(/{NO:(\d+)}/, (match, p1) => '1'.padStart(parseInt(p1), '0'))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
}
