"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Loader2, 
    ArrowLeft, 
    CalendarCheck, 
    User, 
    FileText, 
    Database, 
    Info, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle,
    Copy,
    Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getActivityById } from '../actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ActivityDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const { schoolData } = useSchoolData();
    const [activity, setActivity] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchActivity = async () => {
            setIsLoading(true);
            const result = await getActivityById(id);
            if (result.success) {
                setActivity(result.activity);
            } else {
                toast.error("Activité introuvable");
                router.push('/activity');
            }
            setIsLoading(false);
        };

        if (id) {
            fetchActivity();
        }
    }, [id, router]);

    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">Chargement des détails...</p>
            </div>
        );
    }

    if (!activity) return null;

    const metadata = typeof activity.metadata === 'string' 
        ? JSON.parse(activity.metadata || '{}') 
        : (activity.metadata || {});

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'success':
                return {
                    bg: 'bg-green-50',
                    border: 'border-green-200',
                    text: 'text-green-700',
                    icon: CheckCircle2,
                    iconBg: 'bg-green-100 text-green-600'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    text: 'text-amber-700',
                    icon: AlertTriangle,
                    iconBg: 'bg-amber-100 text-amber-600'
                };
            case 'error':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    text: 'text-red-700',
                    icon: XCircle,
                    iconBg: 'bg-red-100 text-red-600'
                };
            default:
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    text: 'text-blue-700',
                    icon: Info,
                    iconBg: 'bg-blue-100 text-blue-600'
                };
        }
    };

    const styles = getTypeStyles(activity.type);
    const StatusIcon = styles.icon;

    const handleCopyId = () => {
        navigator.clipboard.writeText(activity.id);
        toast.success("ID copié dans le presse-papier");
    };

    return (
        <div className="flex flex-col gap-8 p-2 max-w-5xl mx-auto mb-12">
            {/* Header / Breadcrumb */}
            <div className="flex items-center gap-4">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 rounded-xl hover:bg-muted/50 transition-all border border-transparent hover:border-border"
                    onClick={() => router.push('/activity')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Détails de l'Activité</h1>
                    <p className="text-muted-foreground text-sm">Consultation approfondie de l'événement système.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Summary Card */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-2 flex flex-col gap-6"
                >
                    <Card className={`border-none shadow-xl overflow-hidden ${styles.bg} border-l-4 ${styles.border}`}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-4 mb-4">
                                <div className={`p-3 rounded-2xl ${styles.iconBg} shadow-sm`}>
                                    <StatusIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <Badge variant="outline" className={`mb-1 uppercase font-bold text-[10px] ${styles.text} ${styles.border} bg-white/50`}>
                                        {activity.type || 'info'}
                                    </Badge>
                                    <CardTitle className={`text-xl ${styles.text}`}>{activity.description}</CardTitle>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/40 backdrop-blur-sm p-6 rounded-3xl border border-white/20 shadow-inner">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <User className="h-3 w-3" /> Utilisateur
                                    </label>
                                    <p className="text-base font-bold text-foreground">{activity.user || 'Système'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <CalendarCheck className="h-3 w-3" /> Date & Heure
                                    </label>
                                    <p className="text-base font-bold text-foreground">
                                        {format(new Date(activity.timestamp), "dd MMMM yyyy 'à' HH:mm:ss", { locale: fr })}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock className="h-3 w-3" /> Année Scolaire
                                    </label>
                                    <p className="text-base font-bold text-foreground">{activity.schoolYear || 'N/A'}</p>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <Database className="h-3 w-3" /> ID Log
                                    </label>
                                    <div className="flex items-center gap-2 group">
                                        <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">{activity.id}</p>
                                        <button 
                                            onClick={handleCopyId}
                                            className="p-1 rounded bg-white/60 hover:bg-white text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Copy className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Technical Metadata Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Données Contextuelles (Metadata)
                                </h3>
                                {Object.keys(metadata).length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.entries(metadata).map(([key, value]) => (
                                            <div key={key} className="bg-white/50 p-3 rounded-2xl border border-white/40 shadow-sm">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">{key}</span>
                                                <span className="text-sm font-mono text-foreground break-all">
                                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-white/20 p-8 rounded-3xl border border-dashed border-white/40 text-center">
                                        <p className="text-sm text-muted-foreground italic">Aucune donnée supplémentaire enregistrée pour cette action.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Right Column: Context / Advice */}
                <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col gap-6"
                >
                    <Card className="border-none shadow-xl bg-primary/5 rounded-3xl overflow-hidden border border-primary/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Info className="h-4 w-4 text-primary" />
                                Aide & Audit
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground leading-relaxed space-y-3">
                            <p>
                                Ce journal d'activité est immuable. Il sert de preuve d'audit pour toutes les modifications critiques effectuées dans le système.
                            </p>
                            <p>
                                Si vous remarquez une activité suspecte ou si une erreur a été journalisée, veuillez contacter l'administrateur système pour une enquête approfondie.
                            </p>
                            <div className="pt-2">
                                <Button 
                                    variant="outline" 
                                    className="w-full text-[11px] h-8 rounded-xl font-bold bg-white"
                                    onClick={() => window.print()}
                                >
                                    Imprimer ce rapport
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline visualization (Optional/Mockup) */}
                    <div className="bg-white/50 rounded-3xl p-6 border border-border shadow-sm">
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Flux temporel</h4>
                        <div className="relative pl-4 space-y-6 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-border">
                            <div className="relative before:absolute before:-left-[1.375rem] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-primary before:ring-4 before:ring-primary/10">
                                <p className="text-[11px] font-bold text-foreground">Événement Actuel</p>
                                <p className="text-[10px] text-muted-foreground">{format(new Date(activity.timestamp), "HH:mm:ss")}</p>
                            </div>
                            <div className="relative before:absolute before:-left-[1.375rem] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-muted">
                                <p className="text-[11px] font-medium text-muted-foreground">Session de l'utilisateur active</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function Badge({ children, variant = 'default', className = '' }: any) {
    const variants: any = {
        default: 'bg-primary/10 text-primary border-primary/20',
        outline: 'border border-border',
        secondary: 'bg-muted text-muted-foreground border-border/50'
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}
