"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Database, ShieldCheck, Info, HardDrive, Cloud, AlertTriangle, RotateCcw, FileArchive, Clock, CheckCircle, XCircle, Download, Upload } from "lucide-react";
import { runAdminBackup, listAdminBackups, restoreAdminBackup, getBackupGuide } from "./actions";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";

interface BackupFile {
    filename: string;
    type: string;
    matricule: string | null;
    schoolName: string | null;
    timestamp: string;
    sizeBytes: number;
    dbSizeBytes: number;
}

export default function BackupsPage() {
    const [loading, setLoading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [guide, setGuide] = useState("");
    const [backups, setBackups] = useState<BackupFile[]>([]);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<'actions' | 'guide'>('actions');

    const { schoolData } = useSchoolData();
    const matricule = schoolData?.matricule || '';
    const schoolName = schoolData?.name || '';

    const loadBackups = useCallback(async () => {
        if (!matricule) return;
        const res = await listAdminBackups(matricule);
        if (res.success && res.files) {
            setBackups(res.files);
        }
    }, [matricule]);

    useEffect(() => {
        loadBackups();
        async function loadGuide() {
            const res = await getBackupGuide();
            if (res.success) setGuide(res.content || '');
        }
        loadGuide();
    }, [loadBackups]);

    async function handleBackup() {
        setLoading(true);
        setResult(null);
        const res = await runAdminBackup(matricule, schoolName);
        if (res.success) {
            setResult({ success: true, msg: `Sauvegarde créée avec succès : ${(res as any).filename || ''}` });
            loadBackups();
        } else {
            setResult({ success: false, msg: `Erreur: ${res.error}` });
        }
        setLoading(false);
    }

    async function handleRestore() {
        if (!selectedFile) return;
        setRestoring(true);
        setResult(null);
        const res = await restoreAdminBackup(selectedFile, matricule);
        if (res.success) {
            setResult({ success: true, msg: "Restauration réussie ! L'application va se recharger..." });
            setTimeout(() => window.location.reload(), 3000);
        } else {
            setResult({ success: false, msg: `Erreur: ${res.error}` });
        }
        setRestoring(false);
        setShowRestoreConfirm(false);
        setSelectedFile(null);
    }

    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center gap-3 mb-2">
                    <Database className="w-8 h-8 text-blue-500" />
                    <h1 className="text-3xl font-bold tracking-tight">Sauvegardes & Restauration</h1>
                </div>
                <p className="text-muted-foreground">
                    Protégez les données de votre école ({matricule}) avec des sauvegardes chiffrées.
                </p>
            </motion.div>

            {/* Tab switcher */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl w-fit">
                <button
                    onClick={() => setActiveView('actions')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'actions' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <div className="flex items-center gap-2"><Database className="w-4 h-4" /> Actions</div>
                </button>
                <button
                    onClick={() => setActiveView('guide')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'guide' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <div className="flex items-center gap-2"><Info className="w-4 h-4" /> Guide</div>
                </button>
            </div>

            {/* Result message */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-xl border text-sm ${result.success
                        ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400"
                        : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    }`}
                >
                    <div className="flex gap-2 items-start">
                        {result.success ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                        <p className="font-medium">{result.msg}</p>
                    </div>
                </motion.div>
            )}

            {activeView === 'actions' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Backup Panel */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="border-none shadow-lg overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <ShieldCheck className="w-24 h-24 text-blue-500" />
                            </div>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Download className="w-5 h-5 text-blue-500" />
                                    Sauvegarder
                                </CardTitle>
                                <CardDescription>
                                    Créez un fichier .odsm chiffré de votre base de données.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button
                                    onClick={handleBackup}
                                    disabled={loading || !matricule}
                                    className="w-full py-6 text-lg font-bold gap-3 shadow-md hover:shadow-blue-500/20 transition-all"
                                >
                                    {loading ? (
                                        <span className="flex items-center gap-2">
                                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sauvegarde en cours...
                                        </span>
                                    ) : (
                                        <>
                                            <Database className="w-5 h-5" />
                                            Sauvegarder Maintenant
                                        </>
                                    )}
                                </Button>

                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                                        <Info className="w-4 h-4 text-blue-500" />
                                        Destination
                                    </h4>
                                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs">
                                        <div className="flex items-center gap-2">
                                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="font-medium">C:\ODSM_Backups\</span>
                                        </div>
                                        <span className="text-green-500 font-bold uppercase tracking-tighter">Actif</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Backup Files List + Restore */}
                    <div className="lg:col-span-2">
                        <Card className="border-none shadow-lg h-full">
                            <CardHeader className="border-b border-slate-50 dark:border-slate-900">
                                <CardTitle className="flex items-center gap-2">
                                    <FileArchive className="w-5 h-5 text-blue-500" />
                                    Fichiers de Sauvegarde ({backups.length})
                                </CardTitle>
                                <CardDescription>
                                    Sélectionnez un fichier pour le restaurer. Seules les sauvegardes de votre établissement sont affichées.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {backups.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Database className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                                        <p className="text-sm font-bold text-slate-400">Aucune sauvegarde trouvée</p>
                                        <p className="text-xs text-slate-400 mt-1">Cliquez sur "Sauvegarder Maintenant" pour créer votre première sauvegarde.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[500px] overflow-y-auto">
                                        {backups.map(file => (
                                            <div
                                                key={file.filename}
                                                className={`flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer ${selectedFile === file.filename ? 'bg-blue-50 dark:bg-blue-500/10 border-l-4 border-blue-500' : ''}`}
                                                onClick={() => setSelectedFile(file.filename === selectedFile ? null : file.filename)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-2 bg-blue-500/10 rounded-lg flex-shrink-0">
                                                        <FileArchive className="w-4 h-4 text-blue-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{file.filename}</p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {formatDate(file.timestamp)}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {formatSize(file.sizeBytes)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {selectedFile === file.filename && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="flex-shrink-0 gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowRestoreConfirm(true);
                                                        }}
                                                    >
                                                        <Upload className="w-3.5 h-3.5" />
                                                        Restaurer
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {activeView === 'guide' && (
                <Card className="border-none shadow-lg">
                    <CardHeader className="border-b border-slate-50 dark:border-slate-900">
                        <CardTitle className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-500" />
                            Guide de Procédure de Sauvegarde
                        </CardTitle>
                        <CardDescription>
                            Instructions complètes pour la sauvegarde et restauration manuelle.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="p-6 prose prose-slate max-w-none dark:prose-invert">
                            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
                                {guide || "Chargement du guide..."}
                            </pre>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Restore Confirmation Modal */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-2xl">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Confirmer la Restauration</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Action irréversible</p>
                            </div>
                        </div>

                        <div className="mb-6 space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Cette action va <strong className="text-red-600">remplacer toute la base de données</strong> par le contenu du fichier sélectionné. 
                                Une sauvegarde de sécurité sera automatiquement créée avant la restauration.
                            </p>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-xs font-mono text-slate-500 truncate">{selectedFile}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowRestoreConfirm(false); setSelectedFile(null); }}
                                className="flex-1 py-3 px-4 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleRestore}
                                disabled={restoring}
                                className="flex-1 py-3 px-4 rounded-2xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {restoring ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Restauration...
                                    </>
                                ) : (
                                    <>
                                        <RotateCcw className="w-4 h-4" />
                                        Restaurer
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
