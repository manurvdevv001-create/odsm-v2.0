"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
    Users,
    GraduationCap,
    Banknote,
    CalendarCheck,
    PlusCircle,
    Settings,
    History,
    ArrowRight,
    School,
    Sparkles,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Activity } from "@/lib/activity-logger";
import { isOfficeRole, isAdminRole, isSupervisorRole, isDisciplineRole, isReadOnlyRole, getRoleDisplayLabel, getNavItems } from "@/lib/role-permissions";
import { AlertCircle, RefreshCw, Database } from "lucide-react";
import { attemptDatabaseRepair } from "@/lib/db-health-actions";
import { useState } from "react";

const allQuickActions = [
    {
        title: "Inscrire un élève",
        desc: "Ajouter un nouvel élève",
        icon: PlusCircle,
        href: "/students",
        color: "bg-blue-500",
    },
    {
        title: "Enregistrer un paiement",
        desc: "Gérer les finances",
        icon: Banknote,
        href: "/finances",
        color: "bg-emerald-500",
    },
    {
        title: "Gérer les horaires",
        desc: "Emploi du temps",
        icon: CalendarCheck,
        href: "/timetable",
        color: "bg-violet-500",
    },
    {
        title: "Gestion du personnel",
        desc: "Enseignants et attributions",
        icon: GraduationCap,
        href: "/staff",
        color: "bg-orange-500",
    },
    {
        title: "Locaux",
        desc: "Salles de classe",
        icon: School,
        href: "/classrooms",
        color: "bg-slate-500",
    },
    {
        title: "Paramètres",
        desc: "Configuration de l'école",
        icon: Settings,
        href: "/settings",
        color: "bg-pink-500",
    },
    {
        title: "Calendrier Scolaire",
        desc: "Périodes et dates clés",
        icon: CalendarCheck,
        href: "/settings/calendar",
        color: "bg-teal-500",
    },
];

export default function DashboardPage() {
    const { schoolData, isLoading, user } = useSchoolData();

    const effectiveRole = ((user?.role as string) || "ADMIN").toUpperCase();
    const isOffice = isOfficeRole(effectiveRole);
    const isAdmin = isAdminRole(effectiveRole);
    const isSupervisor = isSupervisorRole(effectiveRole);
    const isDiscipline = isDisciplineRole(effectiveRole);
    const isReadOnly = isReadOnlyRole(effectiveRole);
    const roleLabel = getRoleDisplayLabel(effectiveRole);

    const studentCount = (schoolData?.studentCount as number) || 0;
    const teacherCount = (schoolData?.teacherCount as number) || 0;
    const schoolName = (schoolData?.name as string) || "Votre École";
    const matricule = (schoolData?.matricule as string) || "";

    // Filter quick actions based on role's allowed nav items
    const allowedHrefs = getNavItems(effectiveRole).map(n => n.href);
    // For read-only roles, exclude modification-oriented quick actions
    const quickActions = isReadOnly
        ? allQuickActions.filter(a => allowedHrefs.includes(a.href)).map(a => ({
            ...a,
            // Adjust labels for read-only context
            title: a.title.replace('Inscrire', 'Voir les').replace('Enregistrer', 'Voir les').replace('Gérer les', 'Voir les'),
            desc: a.desc.replace('Ajouter', 'Consulter').replace('Gérer', 'Consulter'),
        }))
        : allQuickActions.filter(a => allowedHrefs.includes(a.href));

    const stats = isOffice && effectiveRole === "CASHIER"
        ? [
            {
                title: "Total des élèves",
                value: studentCount.toLocaleString(),
                icon: Users,
                change: `${studentCount} élèves inscrits`,
                color: "text-blue-500",
                bgColor: "bg-blue-500/10",
            },
            {
                title: "Revenu du mois",
                value: "$0.00",
                icon: Banknote,
                change: "Total perçu ce mois-ci",
                color: "text-violet-500",
                bgColor: "bg-violet-500/10",
            },
        ]
        : [
            {
                title: "Total des élèves",
                value: studentCount.toLocaleString(),
                icon: Users,
                change: `${studentCount} élèves inscrits`,
                color: "text-blue-500",
                bgColor: "bg-blue-500/10",
            },
            {
                title: "Personnel",
                value: teacherCount.toLocaleString(),
                icon: GraduationCap,
                change: `${teacherCount} membres du personnel`,
                color: "text-emerald-500",
                bgColor: "bg-emerald-500/10",
                href: "/staff",
            },
            {
                title: "Revenu du mois",
                value: "$0.00",
                icon: Banknote,
                change: "Total perçu ce mois-ci",
                color: "text-violet-500",
                bgColor: "bg-violet-500/10",
            }
        ];

    const [isRepairing, setIsRepairing] = useState(false);
    const { dbStatus, refreshData } = useSchoolData();

    async function handleRepair() {
        setIsRepairing(true);
        const res = await attemptDatabaseRepair();
        if (res.success) {
            refreshData();
        }
        setIsRepairing(false);
    }

    return (
        <div className="flex flex-col gap-8 relative overflow-hidden">
            {/* Database Warning Banner */}
            {dbStatus === "disconnected" && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="bg-red-500 text-white p-4 rounded-2xl shadow-lg border border-red-400 flex flex-col md:flex-row items-center justify-between gap-4 z-50 relative overflow-hidden group"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:scale-110 transition-transform">
                        <Database className="w-16 h-16" />
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Connexion SQLite interrompue</h3>
                            <p className="text-sm text-white/90">
                                L'application ne parvient plus à communiquer avec la base de données. Les données affichées peuvent être obsolètes.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRepair}
                        disabled={isRepairing}
                        className="bg-white text-red-600 hover:bg-white/90 font-bold px-6 py-5 rounded-xl gap-2 relative z-10"
                    >
                        {isRepairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {isRepairing ? "Tentative de reconnexion..." : "Réparer la connexion"}
                    </Button>
                </motion.div>
            )}
            {/* Background orbs */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-20 w-80 h-80 bg-primary/3 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10"
            >
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Tableau de bord
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                    Bienvenue sur votre espace de gestion,{" "}
                    <span className="font-semibold text-primary">{roleLabel}</span>.
                </p>
                {matricule && (
                    <div className="flex items-center gap-2 mt-2">
                        <Link 
                            href="/settings/school" 
                            className="flex items-center gap-2 group hover:bg-primary/5 px-2 py-1 rounded-md transition-colors"
                        >
                            <School className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                {schoolName} — <span className="font-mono font-semibold text-primary">{matricule}</span>
                            </span>
                        </Link>
                    </div>
                )}
            </motion.div>

            {/* Stats Grid */}
            <section className="relative z-10">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                        >
                            {(stat as any).href ? (
                                <Link href={(stat as any).href} className="block group">
                                    <Card className="border-none shadow-lg hover:shadow-xl transition-all group-hover:border-primary/20 border border-transparent">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                    {stat.title}
                                                </p>
                                                <div className={`p-2.5 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                                </div>
                                            </div>
                                            <div className="text-3xl font-extrabold tracking-tight">{stat.value}</div>
                                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                {stat.change}
                                                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                                            </p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ) : (
                                <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                {stat.title}
                                            </p>
                                            <div className={`p-2.5 rounded-xl ${stat.bgColor}`}>
                                                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-extrabold tracking-tight">{stat.value}</div>
                                        <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Quick Actions */}
            <section className="relative z-10">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight">Accès Rapide</h2>
                    <div className="h-1 w-16 bg-primary/20 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {quickActions.map((action, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
                        >
                            <Link
                                href={action.href}
                                className="group block p-4 rounded-2xl bg-card border border-border/50 shadow-md hover:shadow-lg hover:border-primary/20 transition-all"
                            >
                                <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${action.color} text-white shadow-sm group-hover:scale-110 transition-transform`}>
                                    <action.icon className="h-5 w-5" />
                                </div>
                                <h3 className="font-semibold text-sm mb-0.5">{action.title}</h3>
                                <p className="text-[11px] text-muted-foreground leading-tight">{action.desc}</p>
                                <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Bottom Grid: Activity + Feature Card (Admin + Supervisor) */}
            {(isAdmin || isSupervisor) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="lg:col-span-2"
                >
                    <Card className="border-none shadow-lg h-full overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-6 border-b border-border/50 bg-card">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <History className="h-5 w-5 text-primary" />
                                            Activité Récente
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">Derniers événements enregistrés</p>
                                    </div>
                                    <Link href="/activity">
                                        <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-lg">
                                            Voir tout <ArrowRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            
                            {schoolData?.activityLog && Array.isArray(schoolData.activityLog) && schoolData.activityLog.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {(schoolData.activityLog as Activity[]).slice(0, 5).map((activity, index) => {
                                        const description = activity.description || "Action sans description";
                                        const timestamp = activity.timestamp;
                                        const dateObj = timestamp ? new Date(timestamp) : new Date();
                                        const isValidDate = !isNaN(dateObj.getTime());

                                        return (
                                            <div key={index} className="flex items-start gap-4 p-5 group hover:bg-muted/30 transition-colors">
                                                <div className="flex-shrink-0 mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div className="flex-grow">
                                                    <p className="font-semibold text-sm text-foreground mb-1 leading-snug">{description}</p>
                                                    <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                                        <CalendarCheck className="h-3 w-3" />
                                                        {isValidDate ? dateObj.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Date inconnue"}
                                                        {activity.user && (
                                                            <>
                                                                <span className="opacity-50">•</span>
                                                                Par {activity.user}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 opacity-40">
                                    <History className="h-14 w-14 mb-3" />
                                    <p className="text-base font-medium">Aucune activité récente.</p>
                                    <p className="text-sm text-muted-foreground">Les événements apparaîtront ici.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Feature Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                >
                    <div className="relative h-full rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-8 text-white flex flex-col items-center justify-center text-center overflow-hidden shadow-lg">
                        {/* Decorative glow */}
                        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-3xl" />

                        <div className="relative z-10">
                            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm mb-5">
                                <Sparkles className="h-8 w-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">ODSM v2</h3>
                            <p className="text-sm text-white/85 mb-6 leading-relaxed">
                                Configurez les classes, cours, horaires et le calendrier scolaire dans les paramètres.
                            </p>
                            <Link href="/settings">
                                <Button
                                    variant="secondary"
                                    className="w-full rounded-xl py-5 font-bold text-primary bg-white hover:bg-white/90"
                                >
                                    Ouvrir les Paramètres
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
            )}
        </div>
    );
}
