'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    logoutSuperadmin, isAuthenticated, runBackup, runSchoolBackup, listSuperadminBackups, restoreSuperadminBackup,
    getGuides, getAllSchools, getAuditLogs, createSchool, updateSchoolInfo, 
    manageLicense, replicateSchool, createImpersonationToken, resetPassword,
    getSystemMetrics, deleteSchool, resetSchoolData
} from './actions';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { 
    Plus, Copy, Key, Edit, ShieldAlert, Monitor, Server, FileText, 
    LayoutDashboard, Clock, CheckCircle, Activity, Database, Cpu, 
    HardDrive, Trash2, RotateCcw, AlertTriangle, Info, Menu, X,
    ChevronRight, Users, GraduationCap, FileArchive, Download, Upload, Eye
} from 'lucide-react';

export default function SuperadminDashboard() {
    const [isAuth, setIsAuth] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'licenses' | 'audit' | 'deploy' | 'monitor'>('overview');
    const router = useRouter();

    const [schools, setSchools] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    
    // Deployment state
    const [backupLoading, setBackupLoading] = useState(false);
    const [backupResult, setBackupResult] = useState<{ success: boolean; msg: string } | null>(null);
    const [guides, setGuides] = useState<{ install: string; backup: string }>({ install: '', backup: '' });
    const [activeGuide, setActiveGuide] = useState<'install' | 'backup'>('install');

    // Modals state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReplicateModal, setShowReplicateModal] = useState(false);
    const [showLicenseModal, setShowLicenseModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showResetDataModal, setShowResetDataModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [selectedSchool, setSelectedSchool] = useState<any>(null);
    const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
    const [schoolBackups, setSchoolBackups] = useState<any[]>([]);
    const [allBackups, setAllBackups] = useState<any[]>([]);
    const [selectedRestoreFile, setSelectedRestoreFile] = useState<string | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [schoolBackupLoading, setSchoolBackupLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState<any>({});
    const [formMsg, setFormMsg] = useState({ type: '', text: '' });

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        const [schoolsRes, logsRes, metricsRes] = await Promise.all([
            getAllSchools(),
            getAuditLogs(),
            getSystemMetrics()
        ]);
        
        if (schoolsRes.success) {
            setSchools(schoolsRes.schools || []);
        } else {
            setError(schoolsRes.error || 'Erreur lors du chargement des écoles');
        }

        if (logsRes.success) setLogs(logsRes.logs || []);
        if (metricsRes.success) setMetrics(metricsRes.metrics || {});
        
        setLastUpdated(new Date());
        if (!silent) setLoading(false);
    }, []);

    useEffect(() => {
        async function checkAuth() {
            const auth = await isAuthenticated();
            if (!auth) {
                router.push('/superadmin/login');
            } else {
                setIsAuth(true);
                fetchData();
            }
        }
        checkAuth();
    }, [router, fetchData]);

    // Polling Interval (10 seconds)
    useEffect(() => {
        if (!isAuth) return;
        const interval = setInterval(() => {
            fetchData(true); // Silent update
        }, 10000);
        return () => clearInterval(interval);
    }, [isAuth, fetchData]);

    useEffect(() => {
        if (activeTab === 'deploy') {
            if (!guides.install) {
                async function loadGuides() {
                    const res = await getGuides();
                    if (res.success) setGuides(res.guides || { install: '', backup: '' });
                }
                loadGuides();
            }
            loadAllBackups();
        }
    }, [activeTab, guides]);

    async function handleBackup() {
        setBackupLoading(true);
        setBackupResult(null);
        const res: any = await runBackup();
        if (res.success) {
            setBackupResult({ success: true, msg: `Sauvegarde globale réussie : ${res.filename}` });
            loadAllBackups();
        } else {
            setBackupResult({ success: false, msg: `Erreur: ${res.error}` });
        }
        setBackupLoading(false);
    }

    async function handleSchoolBackup(matricule: string, name: string) {
        setSchoolBackupLoading(true);
        const res = await runSchoolBackup(matricule, name);
        if (res.success) {
            setBackupResult({ success: true, msg: `Sauvegarde de ${matricule} créée : ${(res as any).filename || ''}` });
            loadSchoolBackups(matricule);
        } else {
            setBackupResult({ success: false, msg: `Erreur: ${res.error}` });
        }
        setSchoolBackupLoading(false);
    }

    async function loadSchoolBackups(matricule: string) {
        const res = await listSuperadminBackups(matricule);
        if (res.success) setSchoolBackups(res.files || []);
    }

    async function loadAllBackups() {
        const res = await listSuperadminBackups();
        if (res.success) setAllBackups(res.files || []);
    }

    async function toggleExpandSchool(matricule: string) {
        if (expandedSchool === matricule) {
            setExpandedSchool(null);
            setSchoolBackups([]);
        } else {
            setExpandedSchool(matricule);
            await loadSchoolBackups(matricule);
        }
    }

    async function handleRestore() {
        if (!selectedRestoreFile) return;
        setRestoring(true);
        const res = await restoreSuperadminBackup(selectedRestoreFile);
        if (res.success) {
            setBackupResult({ success: true, msg: 'Restauration réussie ! L\'application va se recharger...' });
            setTimeout(() => window.location.reload(), 3000);
        } else {
            setBackupResult({ success: false, msg: `Erreur: ${res.error}` });
        }
        setRestoring(false);
        setShowRestoreConfirm(false);
        setSelectedRestoreFile(null);
    }

    function formatSize(bytes: number) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function formatBackupDate(iso: string) {
        return new Date(iso).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    async function handleLogout() {
        await logoutSuperadmin();
        router.push('/superadmin/login');
    }

    async function handleAction(action: string, school: any) {
        setSelectedSchool(school);
        setFormMsg({ type: '', text: '' });
        setFormData({});
        
        if (action === 'edit') {
            setFormData({ name: school.name, secopeMatricule: school.secopeMatricule, address: school.address });
            setShowEditModal(true);
        } else if (action === 'license') {
            const currentLicense = school.licenses?.[0] || {};
            setFormData({ 
                type: currentLicense.type || 'DEMO', 
                endDate: currentLicense.endDate ? new Date(currentLicense.endDate).toISOString().split('T')[0] : '',
                status: currentLicense.status || 'ACTIVE'
            });
            setShowLicenseModal(true);
        } else if (action === 'replicate') {
            setFormData({ name: `${school.name} (Copie)`, initialYear: '2025-2026' });
            setShowReplicateModal(true);
        } else if (action === 'reset_pass') {
            setShowResetModal(true);
        } else if (action === 'impersonate') {
            const res = await createImpersonationToken(school.matricule);
            if (res.success) {
                router.push('/'); // Redirect to main app
            } else {
                alert(res.error);
            }
        } else if (action === 'delete') {
            setShowDeleteModal(true);
        } else if (action === 'reset_data') {
            setShowResetDataModal(true);
        } else if (action === 'license') {
            const license = school.licenses?.[0];
            const defaultRestrictions = {
                maxStudentsPerClassroom: 4,
                maxClassesPerLevel: {
                    MATERNELLE: 1,
                    PRIMAIRE: 3,
                    SECONDAIRE: 4
                },
                maxCoursesPerClassroom: 5,
                maxPersonnel: null
            };
            let restrictionsObj = defaultRestrictions;
            try {
                if (license?.restrictions) {
                    restrictionsObj = JSON.parse(license.restrictions);
                }
            } catch(e) {}
            
            setFormData({ 
                type: license?.type || 'DEMO', 
                customName: license?.customName || '',
                endDate: license?.endDate ? new Date(license.endDate).toISOString().split('T')[0] : '', 
                status: license?.status || 'ACTIVE',
                restrictions: JSON.stringify(restrictionsObj, null, 2)
            });
            setFormMsg({type:'',text:''});
            setShowLicenseModal(true);
        }
    }

    async function submitCreateSchool(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Création en cours...' });
        const res = await createSchool({
            name: formData.name,
            initialYear: formData.initialYear || '2025-2026',
            password: formData.password
        });
        if (res.success) {
            setFormMsg({ type: 'success', text: `École créée ! Matricule: ${res.school?.matricule}, MDP: ${res.rawPassword}` });
            fetchData(true);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitEditSchool(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Mise à jour...' });
        const res = await updateSchoolInfo(selectedSchool.matricule, {
            name: formData.name,
            secopeMatricule: formData.secopeMatricule,
            address: formData.address
        });
        if (res.success) {
            setFormMsg({ type: 'success', text: 'École mise à jour !' });
            fetchData(true);
            setTimeout(() => setShowEditModal(false), 2000);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitResetPassword(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Réinitialisation...' });
        const res = await resetPassword(selectedSchool.matricule, formData.newPassword);
        if (res.success) {
            setFormMsg({ type: 'success', text: 'Mot de passe réinitialisé !' });
            setTimeout(() => setShowResetModal(false), 2000);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitReplicate(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Réplication en cours...' });
        const res = await replicateSchool(selectedSchool.matricule, {
            name: formData.name,
            initialYear: formData.initialYear || '2025-2026',
        });
        if (res.success) {
            setFormMsg({ type: 'success', text: `École répliquée ! Matricule: ${res.school?.matricule}, MDP: ${res.rawPassword}` });
            fetchData(true);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitLicense(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Mise à jour de la licence...' });
        const res = await manageLicense(selectedSchool.matricule, {
            type: formData.type,
            customName: formData.customName,
            endDate: formData.endDate,
            status: formData.status || 'ACTIVE',
            restrictions: formData.restrictions
        });
        if (res.success) {
            setFormMsg({ type: 'success', text: 'Licence mise à jour !' });
            fetchData(true);
            setTimeout(() => setShowLicenseModal(false), 2000);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitDeleteSchool(e: React.FormEvent) {
        e.preventDefault();
        if (formData.confirmMatricule !== selectedSchool.matricule) {
            setFormMsg({ type: 'error', text: 'Le matricule ne correspond pas.' });
            return;
        }
        setFormMsg({ type: 'info', text: 'Suppression en cours...' });
        const res = await deleteSchool(selectedSchool.matricule);
        if (res.success) {
            setFormMsg({ type: 'success', text: 'École supprimée définitivement.' });
            fetchData(true);
            setTimeout(() => setShowDeleteModal(false), 2000);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    async function submitResetData(e: React.FormEvent) {
        e.preventDefault();
        setFormMsg({ type: 'info', text: 'Réinitialisation des données...' });
        const res = await resetSchoolData(selectedSchool.matricule);
        if (res.success) {
            setFormMsg({ type: 'success', text: 'Données réinitialisées avec succès.' });
            fetchData(true);
            setTimeout(() => setShowResetDataModal(false), 2000);
        } else {
            setFormMsg({ type: 'error', text: res.error || 'Erreur' });
        }
    }

    if (!isAuth) return null;

    const stats = {
        totalSchools: schools.length,
        totalStudents: schools.reduce((acc, s) => acc + (s._count?.students || 0), 0),
        activeLicenses: schools.filter(s => s.licenses?.[0]?.status === 'ACTIVE').length,
        expiredLicenses: schools.filter(s => s.licenses?.[0]?.endDate && new Date(s.licenses[0].endDate) < new Date()).length,
    };

    return (
        <div className="min-h-screen neuglass-bg text-slate-900 dark:text-white font-sans flex overflow-hidden">
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 lg:static lg:flex w-64 border-r neuglass-divider bg-white/50 dark:bg-slate-900/30 flex flex-col z-50 transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} backdrop-blur-md`}>
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight mb-1 text-slate-900 dark:text-white">
                            ODSM <span className="text-blue-600 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">Super</span>
                        </h1>
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold">Système En Direct</p>
                        </div>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {[
                        { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'Vue Globale' },
                        { id: 'monitor', icon: <Activity size={18} />, label: 'Support Technique' },
                        { id: 'schools', icon: <Monitor size={18} />, label: 'Écoles (Tenants)' },
                        { id: 'licenses', icon: <ShieldAlert size={18} />, label: 'Licences' },
                        { id: 'audit', icon: <FileText size={18} />, label: 'Journaux (Audit)' },
                        { id: 'deploy', icon: <Server size={18} />, label: 'Système & Backups' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => { setActiveTab(item.id as any); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                activeTab === item.id 
                                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 shadow-[inset_0_0_12px_rgba(59,130,246,0.2)] border border-blue-200 dark:border-blue-500/30' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
                            }`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t neuglass-divider">
                    <ThemeToggle />
                    <button
                        onClick={handleLogout}
                        className="w-full mt-4 py-2 px-4 rounded-lg bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/20 transition-all text-sm font-bold flex justify-center items-center gap-2"
                    >
                        <ShieldAlert size={16} />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative z-10 h-screen">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                
                <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                    
                    {/* Header with last updated */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <button 
                                onClick={() => setMobileMenuOpen(true)}
                                className="lg:hidden p-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl border neuglass-divider text-slate-600 dark:text-slate-400"
                            >
                                <Menu size={24} />
                            </button>
                            <div>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Dernière mise à jour : {lastUpdated.toLocaleTimeString()}</p>
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                                    {activeTab === 'overview' && 'Vue d\'ensemble'}
                                    {activeTab === 'monitor' && 'Support & Monitoring'}
                                    {activeTab === 'schools' && 'Gestion des Tenants'}
                                    {activeTab === 'licenses' && 'Contrôle des Licences'}
                                    {activeTab === 'audit' && 'Historique d\'Audit'}
                                    {activeTab === 'deploy' && 'Déploiement & Système'}
                                </h2>
                            </div>
                        </div>
                        {loading && (
                            <div className="flex items-center gap-2 text-blue-500 text-xs font-bold animate-pulse">
                                <Activity size={14} /> Synchronisation...
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 animate-in fade-in zoom-in-95">
                            <ShieldAlert size={20} />
                            <div>
                                <p className="text-sm font-bold">Erreur de Synchronisation</p>
                                <p className="text-xs opacity-80">{error}</p>
                            </div>
                            <button onClick={() => fetchData()} className="ml-auto px-4 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors">Réessayer</button>
                        </div>
                    )}

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="neuglass-stat p-6 border-l-4 border-blue-500">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center gap-2"><Monitor size={16}/> Total Écoles</p>
                                    <p className="text-4xl font-bold text-slate-900 dark:text-white">{stats.totalSchools}</p>
                                </div>
                                <div className="neuglass-stat p-6 border-l-4 border-green-500">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center gap-2"><CheckCircle size={16}/> Licences Actives</p>
                                    <p className="text-4xl font-bold text-slate-900 dark:text-white">{stats.activeLicenses}</p>
                                </div>
                                <div className="neuglass-stat p-6 border-l-4 border-red-500">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center gap-2"><Clock size={16}/> Licences Expirées</p>
                                    <p className="text-4xl font-bold text-red-600 dark:text-red-400">{stats.expiredLicenses}</p>
                                </div>
                                <div className="neuglass-stat p-6 border-l-4 border-purple-500">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 flex items-center gap-2"><Monitor size={16}/> Élèves Gérés</p>
                                    <p className="text-4xl font-bold text-slate-900 dark:text-white">{stats.totalStudents.toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="neuglass-card p-6">
                                    <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                                        <Activity size={18} className="text-blue-500" /> État Système Rapide
                                    </h3>
                                    {metrics ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-slate-600 dark:text-slate-400">Mémoire (RAM)</span>
                                                <span className="text-sm font-bold">{metrics.memory.percentage}% utilisé</span>
                                            </div>
                                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${metrics.memory.percentage}%` }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>Uptime: {metrics.uptime}</span>
                                                <span>Base de données: {metrics.storage.dbSize}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-500 text-sm animate-pulse">Chargement des métriques...</p>
                                    )}
                                </div>

                                <div className="neuglass-card p-6">
                                    <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                                        <Clock size={18} className="text-purple-500" /> Activité Récente
                                    </h3>
                                    <div className="space-y-2">
                                        {logs.slice(0, 4).map(log => (
                                            <div key={log.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.action}</span>
                                                <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MONITOR TAB (New) */}
                    {activeTab === 'monitor' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="neuglass-card p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><Cpu size={24}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Processeur (CPU)</h4>
                                            <p className="text-xs text-slate-500">Charge du serveur</p>
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">{metrics?.cpu.load || '0.00'}</p>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter">{metrics?.cpu.model} ({metrics?.cpu.count} Cores)</p>
                                </div>

                                <div className="neuglass-card p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-green-500/10 rounded-2xl text-green-500"><Activity size={24}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Mémoire Vive</h4>
                                            <p className="text-xs text-slate-500">Usage RAM</p>
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">{metrics?.memory.used} / {metrics?.memory.total}</p>
                                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${metrics?.memory.percentage}%` }} />
                                    </div>
                                </div>

                                <div className="neuglass-card p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500"><Database size={24}/></div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">Base de Données</h4>
                                            <p className="text-xs text-slate-500">SQLite Storage</p>
                                        </div>
                                    </div>
                                    <p className="text-3xl font-black text-slate-900 dark:text-white mb-2">{metrics?.storage.dbSize}</p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-2 h-2 rounded-full ${metrics?.storage.dbStatus === 'Connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">{metrics?.storage.dbStatus || 'Unknown'}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-tighter truncate" title={metrics?.storage.dbPath}>Path: {metrics?.storage.dbPath || '...'}</p>
                                    <p className="text-[10px] font-bold text-purple-500 mt-2">DEBUG: Schools in DB = {metrics?.storage.schoolCount}</p>
                                </div>
                            </div>

                            <div className="neuglass-card p-6">
                                <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Analyse des Journaux Techniques</h3>
                                <div className="space-y-4">
                                    {logs.map(log => (
                                        <div key={log.id} className="p-4 rounded-2xl bg-white/50 dark:bg-slate-900/40 border neuglass-divider flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${log.action.includes('ERROR') ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`} />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{log.action}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono">{log.targetMatricule || 'SYSTÈME'}</p>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg flex-1 mx-4 italic">
                                                {log.details}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SCHOOLS TAB */}
                    {activeTab === 'schools' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white/5 dark:bg-slate-900/40 p-4 rounded-3xl border neuglass-divider backdrop-blur-md gap-4">
                                <div className="flex flex-wrap gap-4 items-center">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r pr-6 border-slate-200 dark:border-slate-800">
                                        <Info size={14} className="text-blue-500"/> Légende
                                    </div>
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg"><Monitor size={12}/></div> Login
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg"><Copy size={12}/></div> Dupliquer
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg"><Key size={12}/></div> Password
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-slate-500/10 text-slate-500 rounded-lg"><Edit size={12}/></div> Infos
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-orange-500/10 text-orange-500 rounded-lg"><RotateCcw size={12}/></div> Reset Data
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                            <div className="p-1.5 bg-red-500/10 text-red-500 rounded-lg"><Trash2 size={12}/></div> Delete
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setFormData({ initialYear: '2025-2026' }); setFormMsg({ type: '', text: '' }); setShowCreateModal(true); }}
                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-tight transition-all shadow-xl shadow-blue-500/20 text-xs w-full lg:w-auto justify-center"
                                >
                                    <Plus size={18} /> Nouvelle École
                                </button>
                            </div>

                            <div className="neuglass-card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="border-b neuglass-divider bg-slate-50/50 dark:bg-slate-800/30">
                                            <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">École & Matricule</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Statistiques</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Licence Active</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schools.map(school => {
                                            const isExpanded = expandedSchool === school.matricule;
                                            const levels = (() => { try { return JSON.parse(school.levels || '{}'); } catch { return {}; } })();
                                            const activeLevels = Object.entries(levels).filter(([, v]) => v).map(([k]) => k);
                                            return (
                                            <React.Fragment key={school.matricule}>
                                            <tr 
                                                className={`border-b neuglass-divider hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}
                                                onClick={() => toggleExpandSchool(school.matricule)}
                                            >
                                                <td className="p-6">
                                                    <div className="flex items-center gap-2">
                                                        <ChevronRight size={14} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                        <div>
                                                            <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">{school.name}</p>
                                                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{school.matricule}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex gap-4">
                                                        <div>
                                                            <p className="text-xs text-slate-900 dark:text-white font-black">{school._count?.students || 0}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Élèves</p>
                                                        </div>
                                                        <div className="border-l pl-4 border-slate-100 dark:border-slate-800">
                                                            <p className="text-xs text-slate-900 dark:text-white font-black">{school._count?.teachers || 0}</p>
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Personnel</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    {school.licenses?.[0] ? (
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`w-fit px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                                                school.licenses[0].status === 'ACTIVE' 
                                                                ? 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400' 
                                                                : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                                                            }`}>
                                                                {school.licenses[0].type} • {school.licenses[0].status}
                                                            </span>
                                                            <p className="text-[9px] text-slate-400 font-bold">Exp: {new Date(school.licenses[0].endDate).toLocaleDateString()}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400 italic font-bold uppercase tracking-widest opacity-50">Aucune</span>
                                                    )}
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => handleAction('impersonate', school)} className="p-2 bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm" title="Prendre le contrôle"><Monitor size={16} /></button>
                                                        <button onClick={() => handleAction('replicate', school)} className="p-2 bg-purple-500/10 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl transition-all shadow-sm" title="Répliquer"><Copy size={16} /></button>
                                                        <button onClick={() => handleAction('reset_pass', school)} className="p-2 bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white rounded-xl transition-all shadow-sm" title="Réinitialiser MDP"><Key size={16} /></button>
                                                        <button onClick={() => handleAction('edit', school)} className="p-2 bg-slate-500/10 text-slate-600 hover:bg-slate-600 hover:text-white rounded-xl transition-all shadow-sm" title="Modifier"><Edit size={16} /></button>
                                                        <button onClick={() => handleAction('reset_data', school)} className="p-2 bg-orange-500/10 text-orange-600 hover:bg-orange-600 hover:text-white rounded-xl transition-all shadow-sm" title="Vider les données"><RotateCcw size={16} /></button>
                                                        <button onClick={() => handleAction('delete', school)} className="p-2 bg-red-500/10 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm" title="Supprimer"><Trash2 size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expanded School Detail Panel */}
                                            {isExpanded && (
                                            <tr>
                                                <td colSpan={4} className="p-0">
                                                    <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-800/60 dark:to-slate-900/80 p-6 border-b-2 border-blue-200 dark:border-blue-500/30">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                                                            {/* Identifiants */}
                                                            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                                                                <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Info size={12} /> Identifiants</h4>
                                                                <div className="space-y-2">
                                                                    <div><p className="text-[9px] text-slate-400 font-bold">Matricule ODSM</p><p className="text-sm font-mono font-black text-slate-900 dark:text-white">{school.matricule}</p></div>
                                                                    <div><p className="text-[9px] text-slate-400 font-bold">Nom</p><p className="text-sm font-bold text-slate-700 dark:text-slate-300">{school.name}</p></div>
                                                                    {school.secopeMatricule && <div><p className="text-[9px] text-slate-400 font-bold">SECOPE</p><p className="text-xs font-mono text-slate-600 dark:text-slate-400">{school.secopeMatricule}</p></div>}
                                                                    {school.address && <div><p className="text-[9px] text-slate-400 font-bold">Adresse</p><p className="text-xs text-slate-600 dark:text-slate-400">{school.address}</p></div>}
                                                                    {school.city && <div><p className="text-[9px] text-slate-400 font-bold">Ville</p><p className="text-xs text-slate-600 dark:text-slate-400">{school.city}, {school.province || ''}</p></div>}
                                                                </div>
                                                            </div>

                                                            {/* Licence */}
                                                            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                                                                <h4 className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><ShieldAlert size={12} /> Licence</h4>
                                                                {school.licenses?.[0] ? (
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${school.licenses[0].status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-500/20 text-green-600' : 'bg-red-100 dark:bg-red-500/20 text-red-600'}`}>
                                                                                {school.licenses[0].type}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${school.licenses[0].status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                                                                                {school.licenses[0].status}
                                                                            </span>
                                                                        </div>
                                                                        <div><p className="text-[9px] text-slate-400 font-bold">Début</p><p className="text-xs text-slate-600 dark:text-slate-400">{new Date(school.licenses[0].startDate).toLocaleDateString()}</p></div>
                                                                        <div><p className="text-[9px] text-slate-400 font-bold">Expiration</p><p className="text-xs text-slate-600 dark:text-slate-400">{new Date(school.licenses[0].endDate).toLocaleDateString()}</p></div>
                                                                    </div>
                                                                ) : (<p className="text-xs text-slate-400 italic">Aucune licence</p>)}
                                                                <button onClick={() => handleAction('license', school)} className="mt-3 w-full text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"><Edit size={10} /> Configurer</button>
                                                            </div>

                                                            {/* Stats */}
                                                            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                                                                <h4 className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Activity size={12} /> Statistiques</h4>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                                                        <p className="text-lg font-black text-slate-900 dark:text-white">{school._count?.students || 0}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Élèves</p>
                                                                    </div>
                                                                    <div className="text-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                                                                        <p className="text-lg font-black text-slate-900 dark:text-white">{school._count?.teachers || 0}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Personnel</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Structure Académique */}
                                                            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                                                                <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><GraduationCap size={12} /> Structure Académique</h4>
                                                                <div className="space-y-1.5">
                                                                    {activeLevels.length > 0 ? activeLevels.map(level => (
                                                                        <div key={level} className="flex items-center gap-2 text-xs">
                                                                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                                            <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{level}</span>
                                                                        </div>
                                                                    )) : (
                                                                        <p className="text-xs text-slate-400 italic">Non configurée</p>
                                                                    )}
                                                                </div>
                                                                <button onClick={() => handleAction('impersonate', school)} className="mt-3 w-full text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1"><Users size={10} /> Gestion Utilisateurs</button>
                                                            </div>
                                                        </div>

                                                        {/* Backup & Restore Section */}
                                                        <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <h4 className="text-[10px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5"><Database size={12} /> Backup & Restauration</h4>
                                                                <button 
                                                                    onClick={() => handleSchoolBackup(school.matricule, school.name)}
                                                                    disabled={schoolBackupLoading}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-sm"
                                                                >
                                                                    {schoolBackupLoading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download size={12} />}
                                                                    Sauvegarder
                                                                </button>
                                                            </div>
                                                            {schoolBackups.length === 0 ? (
                                                                <p className="text-xs text-slate-400 italic py-2">Aucune sauvegarde pour cet établissement.</p>
                                                            ) : (
                                                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                                                    {schoolBackups.map(file => (
                                                                        <div key={file.filename} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <FileArchive size={14} className="text-teal-500 flex-shrink-0" />
                                                                                <div className="min-w-0">
                                                                                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{file.filename}</p>
                                                                                    <p className="text-[9px] text-slate-400">{formatBackupDate(file.timestamp)} • {formatSize(file.sizeBytes)}</p>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => { setSelectedRestoreFile(file.filename); setShowRestoreConfirm(true); }}
                                                                                className="flex-shrink-0 p-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all text-[9px] font-bold"
                                                                                title="Restaurer"
                                                                            >
                                                                                <Upload size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            )}
                                            </React.Fragment>
                                            );
                                        })}
                                        {schools.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-20 text-center">
                                                    <div className="flex flex-col items-center gap-4 text-slate-300 dark:text-slate-700">
                                                        <Database size={64} className="opacity-20 animate-pulse" />
                                                        <p className="font-black uppercase tracking-widest text-xs">Base de données vide</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LICENSES TAB */}
                    {activeTab === 'licenses' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Gestion des Licences</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {schools.map(school => {
                                    const license = school.licenses?.[0];
                                    return (
                                        <div key={school.matricule} className="neuglass-card p-6 flex flex-col justify-between">
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{school.name}</h3>
                                                <p className="text-sm font-mono text-slate-500 dark:text-slate-400 mb-4">{school.matricule}</p>
                                                
                                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border neuglass-divider mb-4">
                                                    {license ? (
                                                        <>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">Type</span>
                                                                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">{license.type}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">Status</span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${license.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                                                                    {license.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs text-slate-500 dark:text-slate-400">Expiration</span>
                                                                <span className={`text-sm ${new Date(license.endDate) < new Date() ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                    {new Date(license.endDate).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="text-sm text-slate-500 text-center py-4">Aucune licence enregistrée</p>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => { 
                                                    setSelectedSchool(school); 
                                                    setFormData({ 
                                                        type: license?.type || 'DEMO', 
                                                        endDate: license?.endDate ? new Date(license.endDate).toISOString().split('T')[0] : '', 
                                                        status: license?.status || 'ACTIVE' 
                                                    }); 
                                                    setFormMsg({type:'',text:''}); 
                                                    setShowLicenseModal(true); 
                                                }}
                                                className="w-full py-2 neuglass-btn-secondary text-sm font-medium"
                                            >
                                                Mettre à jour la licence
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* AUDIT LOGS TAB */}
                    {activeTab === 'audit' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Journaux d'Audit Superadmin</h2>
                            <div className="neuglass-card overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm min-w-[800px]">
                                    <thead className="bg-slate-100 dark:bg-slate-900/50 border-b neuglass-divider">
                                        <tr>
                                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Date/Heure</th>
                                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Action</th>
                                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Cible (Matricule)</th>
                                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Détails techniques</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y neuglass-divider">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                                <td className="p-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 border neuglass-divider text-xs font-bold text-blue-700 dark:text-blue-300">
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-mono text-slate-700 dark:text-slate-300">{log.targetMatricule || '-'}</td>
                                                <td className="p-4">
                                                    <div className="max-w-xs md:max-w-md truncate text-xs font-mono text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-900/50 p-2 rounded" title={log.details}>
                                                        {log.details}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DEPLOY/SYSTEM TAB */}
                    {activeTab === 'deploy' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Système & Sauvegardes</h2>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="neuglass-card p-6">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                                            <HardDrive size={18} className="text-green-500 dark:text-green-400"/> Backup Global
                                        </h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                                            Sauvegarde complète du système (toutes les écoles) vers <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">C:\ODSM_Backups\</code>
                                        </p>
                                        <button
                                            onClick={handleBackup}
                                            disabled={backupLoading}
                                            className="neuglass-btn-primary w-full py-3 font-bold text-white flex justify-center gap-2"
                                        >
                                            {backupLoading ? (
                                                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sauvegarde en cours...</>
                                            ) : (
                                                <><Download size={16} /> Backup Global</>
                                            )}
                                        </button>
                                        {backupResult && (
                                            <p className={`mt-4 p-3 rounded-lg text-sm border ${backupResult.success ? 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
                                                {backupResult.msg}
                                            </p>
                                        )}
                                    </div>

                                    {/* All Backups List */}
                                    <div className="neuglass-card p-6">
                                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2 text-slate-900 dark:text-white">
                                            <FileArchive size={14} className="text-blue-500" /> Fichiers de Backup ({allBackups.length})
                                        </h3>
                                        {allBackups.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic py-4 text-center">Aucun fichier .odsm trouvé</p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                                {allBackups.map(file => (
                                                    <div key={file.filename} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{file.filename}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${file.type === 'global' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'bg-teal-100 dark:bg-teal-500/20 text-teal-600'}`}>
                                                                    {file.type === 'global' ? 'GLOBAL' : file.matricule}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400">{formatBackupDate(file.timestamp)}</span>
                                                                <span className="text-[9px] text-slate-400">{formatSize(file.sizeBytes)}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => { setSelectedRestoreFile(file.filename); setShowRestoreConfirm(true); }}
                                                            className="flex-shrink-0 ml-2 p-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-600 hover:text-white rounded-lg transition-all"
                                                            title="Restaurer"
                                                        >
                                                            <Upload size={12} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="lg:col-span-2">
                                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl border neuglass-divider w-fit mb-4">
                                        <button onClick={() => setActiveGuide('install')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeGuide === 'install' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Installation</button>
                                        <button onClick={() => setActiveGuide('backup')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeGuide === 'backup' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Sauvegarde</button>
                                    </div>
                                    <div className="neuglass-card p-6 min-h-[500px]">
                                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-300">
                                            {guides[activeGuide] || 'Chargement...'}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* MODALS */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-md p-6 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Créer une nouvelle école</h3>
                        <form onSubmit={submitCreateSchool} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de l'école *</label>
                                <input required type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Année Scolaire Initiale</label>
                                <input type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" placeholder="2025-2026" value={formData.initialYear || ''} onChange={e => setFormData({...formData, initialYear: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe (Optionnel)</label>
                                <input type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" placeholder="Généré automatiquement si vide" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} />
                            </div>
                            {formMsg.text && <div className={`p-3 rounded text-sm ${formMsg.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : formMsg.type === 'success' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'}`}>{formMsg.text}</div>}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 neuglass-btn-ghost py-2">Fermer</button>
                                <button type="submit" className="flex-1 neuglass-btn-primary py-2 font-bold text-white">Créer (Licence DEMO)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEditModal && selectedSchool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-md p-6 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Modifier : {selectedSchool.name}</h3>
                        <form onSubmit={submitEditSchool} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom</label>
                                <input required type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Matricule SECOPE</label>
                                <input type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.secopeMatricule || ''} onChange={e => setFormData({...formData, secopeMatricule: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adresse</label>
                                <input type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                            </div>
                            {formMsg.text && <div className={`p-3 rounded text-sm ${formMsg.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'}`}>{formMsg.text}</div>}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 neuglass-btn-ghost py-2">Annuler</button>
                                <button type="submit" className="flex-1 neuglass-btn-primary py-2 font-bold text-white">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showReplicateModal && selectedSchool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-md p-6 border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4 text-purple-600 dark:text-purple-400">
                            <Copy size={24} />
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Réplication (Golden Template)</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                            Crée une nouvelle école en copiant la configuration (classes, cours, niveaux) de <b className="text-slate-900 dark:text-white">{selectedSchool.name}</b>. Les données transactionnelles (élèves, paiements) NE SONT PAS copiées.
                        </p>
                        <form onSubmit={submitReplicate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom de la NOUVELLE école *</label>
                                <input required type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" placeholder="Ex: Filiale Sud" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            {formMsg.text && <div className={`p-3 rounded text-sm ${formMsg.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : formMsg.type === 'success' ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'}`}>{formMsg.text}</div>}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowReplicateModal(false)} className="flex-1 neuglass-btn-ghost py-2">Annuler</button>
                                <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl py-2 font-bold transition-all">Lancer Réplication</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showLicenseModal && selectedSchool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-md p-6 border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.15)] animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-1 text-slate-900 dark:text-white">Licence: {selectedSchool.name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-4">{selectedSchool.matricule}</p>
                        <form onSubmit={submitLicense} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type de Licence</label>
                                <select className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.type || 'DEMO'} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    <option value="DEMO">Demo (14 jours)</option>
                                    <option value="BASIC">Basic (1 An)</option>
                                    <option value="ADVANCED">Advanced (2-3 Ans)</option>
                                    <option value="FULL">Full (5 Ans)</option>
                                    <option value="FLEXIBLE">Flexible (Personnalisé)</option>
                                    <option value="ONE_TIME">One Time</option>
                                </select>
                            </div>
                            {formData.type === 'FLEXIBLE' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nom personnalisé (Ex: Formation)</label>
                                    <input type="text" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.customName || ''} onChange={e => setFormData({...formData, customName: e.target.value})} />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Restrictions (JSON)</label>
                                <textarea rows={4} className="neuglass-input w-full p-2 text-slate-900 dark:text-white font-mono text-xs" value={formData.restrictions || '{}'} onChange={e => setFormData({...formData, restrictions: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date d'expiration</label>
                                <input required type="date" className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.endDate || ''} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut</label>
                                <select className="neuglass-input w-full p-2 text-slate-900 dark:text-white" value={formData.status || 'ACTIVE'} onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <option value="ACTIVE">Actif</option>
                                    <option value="SUSPENDED">Suspendu</option>
                                    <option value="EXPIRED">Expiré</option>
                                </select>
                            </div>
                            {formMsg.text && <div className={`p-3 rounded text-sm ${formMsg.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'}`}>{formMsg.text}</div>}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowLicenseModal(false)} className="flex-1 neuglass-btn-ghost py-2">Annuler</button>
                                <button type="submit" className="flex-1 neuglass-btn-primary py-2 font-bold text-white">Appliquer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showResetModal && selectedSchool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-sm p-6 border border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.15)] animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4 text-orange-600 dark:text-orange-400">
                            <Key size={24} />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Réinitialiser MDP</h3>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">Pour <b className="text-slate-900 dark:text-white">{selectedSchool.name}</b></p>
                        <form onSubmit={submitResetPassword} className="space-y-4">
                            <div>
                                <input required type="text" placeholder="Nouveau mot de passe" className="neuglass-input neuglass-input-orange w-full p-2 text-slate-900 dark:text-white" value={formData.newPassword || ''} onChange={e => setFormData({...formData, newPassword: e.target.value})} />
                            </div>
                            {formMsg.text && <div className={`p-3 rounded text-sm ${formMsg.type === 'error' ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'}`}>{formMsg.text}</div>}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 neuglass-btn-ghost py-2">Annuler</button>
                                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-400 text-white rounded-xl py-2 font-bold">Confirmer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* DELETE SCHOOL MODAL */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-red-500/20 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-red-500 text-white flex items-center gap-3">
                            <AlertTriangle size={24} />
                            <h3 className="text-xl font-black uppercase tracking-tight">Suppression Définitive</h3>
                        </div>
                        <form onSubmit={submitDeleteSchool} className="p-8 space-y-6">
                            <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm leading-relaxed">
                                <p className="font-bold mb-2">ACTION IRRÉVERSIBLE !</p>
                                <p>Cette action supprimera toutes les données de l'école <b>{selectedSchool?.name}</b> (élèves, profs, notes, paiements, etc.) ainsi que l'école elle-même.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Confirmez le matricule de l'école</span>
                                    <input 
                                        type="text" 
                                        required 
                                        value={formData.confirmMatricule || ''}
                                        onChange={e => setFormData({...formData, confirmMatricule: e.target.value})}
                                        placeholder={selectedSchool?.matricule}
                                        className="w-full mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold uppercase"
                                    />
                                </label>
                            </div>

                            {formMsg.text && (
                                <p className={`p-4 rounded-2xl text-xs font-bold ${formMsg.type === 'success' ? 'bg-green-100 text-green-700' : formMsg.type === 'info' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                    {formMsg.text}
                                </p>
                            )}

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Annuler</button>
                                <button type="submit" className="flex-1 p-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/30">SUPPRIMER</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESET DATA MODAL */}
            {showResetDataModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-orange-500/20 animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-orange-500 text-white flex items-center gap-3">
                            <RotateCcw size={24} />
                            <h3 className="text-xl font-black uppercase tracking-tight">Vider les Données</h3>
                        </div>
                        <form onSubmit={submitResetData} className="p-8 space-y-6">
                            <div className="p-4 bg-orange-50 dark:bg-orange-500/10 rounded-2xl border border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400 text-sm leading-relaxed">
                                <p className="font-bold mb-2">RÉINITIALISATION PARTIELLE</p>
                                <p>Cette action supprimera tous les élèves, professeurs, notes et paiements de <b>{selectedSchool?.name}</b>.</p>
                                <p className="mt-2 text-xs opacity-70">L'école, ses classes et sa configuration seront conservées.</p>
                            </div>

                            <div className="p-4 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-2xl flex gap-3 text-xs">
                                <ShieldAlert size={18} className="shrink-0" />
                                <p>Veuillez faire une sauvegarde avant de procéder si vous n'êtes pas sûr.</p>
                            </div>

                            {formMsg.text && (
                                <p className={`p-4 rounded-2xl text-xs font-bold ${formMsg.type === 'success' ? 'bg-green-100 text-green-700' : formMsg.type === 'info' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                    {formMsg.text}
                                </p>
                            )}

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setShowResetDataModal(false)} className="flex-1 p-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">Annuler</button>
                                <button type="submit" className="flex-1 p-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-500/30">RÉINITIALISER</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Restore Confirmation Modal */}
            {showRestoreConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="neuglass-card w-full max-w-md p-6 border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-2xl">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Confirmer la Restauration</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Action irréversible — un backup de sécurité sera créé</p>
                            </div>
                        </div>

                        <div className="mb-6 space-y-3">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Cette action va <strong className="text-red-600">remplacer toute la base de données</strong> par le contenu du fichier sélectionné.
                            </p>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-xs font-mono text-slate-500 truncate">{selectedRestoreFile}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowRestoreConfirm(false); setSelectedRestoreFile(null); }}
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
                    </div>
                </div>
            )}
        </div>
    );
}
