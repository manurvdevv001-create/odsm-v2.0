"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { isSupervisorRole } from "@/lib/role-permissions";
import {
    ArrowRight,
    Building,
    CalendarDays,
    Users,
    Wallet,
    Hash,
    UserCog,
    Database,
} from "lucide-react";

const settingsCards = [
    {
        title: "Configuration de l'école",
        description: "Modifiez les informations de base, la structure académique, les locaux, cours et créneaux horaires.",
        icon: Building,
        href: "/settings/school-setup",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        buttonLabel: "Modifier les informations",
    },
    {
        title: "Paramètres Financiers",
        description: "Configurez les devises, les rubriques de frais et les tranches de paiement.",
        icon: Wallet,
        href: "/settings/finance",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
        buttonLabel: "Configurer les finances",
    },
    {
        title: "Calendrier Scolaire",
        description: "Définissez les dates clés de l'année scolaire : périodes, examens, jours fériés.",
        icon: CalendarDays,
        href: "/settings/calendar",
        color: "text-violet-500",
        bgColor: "bg-violet-500/10",
        buttonLabel: "Gérer le calendrier",
    },
    {
        title: "Gestion des Utilisateurs",
        description: "Gérez les comptes d'accès, définissez les rôles et contrôlez les permissions.",
        icon: UserCog,
        href: "/settings/users",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        buttonLabel: "Gérer les accès",
    },
    {
        title: "Numérotation Élèves",
        description: "Personnalisez le format des matricules (numéros d'élèves) par niveau.",
        icon: Hash,
        href: "/settings/student-numbering",
        color: "text-pink-500",
        bgColor: "bg-pink-500/10",
        buttonLabel: "Configurer",
    },
    {
        title: "Numérotation Personnel",
        description: "Définissez le format des matricules pour le staff (Enseignants, Admin...).",
        icon: Users,
        href: "/settings/staff-numbering",
        color: "text-slate-500",
        bgColor: "bg-slate-500/10",
        buttonLabel: "Configurer",
    },
    {
        title: "Sauvegardes & Sécurité",
        description: "Gérez les copies de sécurité de vos données (Interne, USB, Cloud).",
        icon: Database,
        href: "/settings/backups",
        color: "text-blue-600",
        bgColor: "bg-blue-600/10",
        buttonLabel: "Gérer les sauvegardes",
    },
    {
        title: "Clôture & Nouvelle Année",
        description: "Clôture académique des niveaux et activation de la nouvelle année scolaire.",
        icon: Building, // Or another relevant icon like ArrowRight or Calendar
        href: "/settings/academic-closure",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        buttonLabel: "Gérer la clôture",
    },
    {
        title: "Personnalisation des reçus",
        description: "Modèles, formats d'impression et numérotation des reçus de paiement.",
        icon: Wallet,
        href: "/settings/receipts",
        color: "text-teal-500",
        bgColor: "bg-teal-500/10",
        buttonLabel: "Configurer",
    },
];


export default function SettingsPage() {
    const { user } = useSchoolData();
    const effectiveRole = ((user?.role as string) || "ADMIN").toUpperCase();
    const isSupervisor = isSupervisorRole(effectiveRole);
    const isSystemAdmin = effectiveRole === "ADMIN_SYSTEM";

    // Supervisor only sees Users, Finance, and Calendar (read-only)
    const supervisorAllowedHrefs = ["/settings/users", "/settings/finance", "/settings/receipts", "/settings/calendar"];
    const systemAdminAllowedHrefs = ["/settings/users", "/settings/backups"];

    let visibleCards = settingsCards;
    if (isSupervisor) {
        visibleCards = settingsCards.filter(c => supervisorAllowedHrefs.includes(c.href));
    } else if (isSystemAdmin) {
        visibleCards = settingsCards.filter(c => systemAdminAllowedHrefs.includes(c.href));
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
                <p className="text-muted-foreground mt-1">
                    Gérez la configuration complète de votre établissement.
                </p>
            </motion.div>

            {/* Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleCards.map((card, i) => (
                    <motion.div
                        key={card.href}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.07 }}
                    >
                        <Card className="h-full border-none shadow-md hover:shadow-lg transition-shadow group">
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-3 mb-1">
                                    <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                                        <card.icon className={`w-5 h-5 ${card.color}`} />
                                    </div>
                                    <CardTitle className="text-lg">{card.title}</CardTitle>
                                </div>
                                <CardDescription className="text-sm leading-relaxed">
                                    {card.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Link href={card.href}>
                                    <Button
                                        variant="outline"
                                        className="group-hover:border-primary/30 group-hover:text-primary transition-all"
                                    >
                                        {card.buttonLabel}
                                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
