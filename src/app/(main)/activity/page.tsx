"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, History, Search, FileText, CalendarCheck, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { getActivities } from './actions';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ActivityLogPage() {
    const { schoolData, isLoading: isDataLoading } = useSchoolData();
    const router = useRouter();
    const [activities, setActivities] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [page, setPage] = useState(0);
    const limit = 20;

    const fetchLogs = useCallback(async () => {
        if (!schoolData?.matricule) return;
        
        setIsLoading(true);
        
        const result = await getActivities(schoolData.matricule, {
            searchTerm,
            schoolYear: selectedYear === 'all' ? undefined : selectedYear,
            limit,
            offset: page * limit
        });

        if (result.success) {
            setActivities(result.activities || []);
            setTotal(result.total || 0);
        }
        setIsLoading(false);
    }, [schoolData, searchTerm, selectedYear, page]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Known years for filtering
    const config = typeof schoolData?.configuration === 'string'
        ? JSON.parse(schoolData?.configuration || '{}')
        : (schoolData?.configuration || {});
    const knownYears = config.knownYears || [];

    if (isDataLoading) {
        return (
            <div className="flex h-[60vh] w-full flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">Initialisation...</p>
            </div>
        );
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="flex flex-col gap-6 neuglass-light-bg p-2 min-h-[80vh]">
            <div className="flex flex-col gap-2 relative z-10">
                <h1 className="text-3xl font-headline font-bold tracking-tight text-foreground flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                        <History className="h-7 w-7 text-primary" />
                    </div>
                    Journal d'Activité Global
                </h1>
                <p className="text-muted-foreground text-lg mb-4">
                    Traçabilité complète des opérations administratives et financières.
                </p>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="relative z-10"
            >
                <Card className="border-none shadow-xl neuglass-light-card overflow-hidden">
                    <CardHeader className="bg-card border-b border-border/50 pb-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Rechercher</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Action ou utilisateur..."
                                        className="pl-9 bg-background/50 border-primary/20 rounded-xl"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setPage(0);
                                        }}
                                    />
                                </div>
                            </div>
                            
                            <div className="md:col-span-4">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Période (Année Scolaire)</label>
                                <Select value={selectedYear} onValueChange={(val) => {
                                    setSelectedYear(val);
                                    setPage(0);
                                }}>
                                    <SelectTrigger className="bg-background/50 border-primary/20 rounded-xl">
                                        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <SelectValue placeholder="Toutes les périodes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les périodes (Historique complet)</SelectItem>
                                        {knownYears.map((y: string) => (
                                            <SelectItem key={y} value={y}>Année Scolaire {y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-3 flex justify-end gap-2">
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="rounded-xl"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setSelectedYear('all');
                                        setPage(0);
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                                <Button 
                                    className="gradient-btn font-bold rounded-xl px-6"
                                    onClick={fetchLogs}
                                >
                                    Actualiser
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="min-h-[50vh] relative">
                            {isLoading && (
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}

                            {activities.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {activities.map((activity) => (
                                        <div 
                                            key={activity.id} 
                                            className="flex items-start gap-4 p-5 hover:bg-muted/50 transition-all cursor-pointer group active:scale-[0.995]"
                                            onClick={() => router.push(`/activity/${activity.id}`)}
                                        >
                                            <div className="flex-shrink-0 mt-1">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                                                    activity.type === 'error' ? 'bg-red-100 text-red-600 shadow-sm shadow-red-200' :
                                                    activity.type === 'warning' ? 'bg-amber-100 text-amber-600 shadow-sm shadow-amber-200' :
                                                    activity.type === 'success' ? 'bg-green-100 text-green-600 shadow-sm shadow-green-200' :
                                                    'bg-primary/10 text-primary shadow-sm shadow-primary/20'
                                                }`}>
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                            </div>
                                            <div className="flex-grow pt-1">
                                                <div className="flex items-start justify-between gap-4 mb-1.5">
                                                    <p className="font-semibold text-sm text-foreground leading-snug group-hover:text-primary transition-colors">
                                                        {activity.description}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        {activity.schoolYear && (
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border whitespace-nowrap">
                                                                AS {activity.schoolYear}
                                                            </span>
                                                        )}
                                                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <CalendarCheck className="h-3.5 w-3.5" />
                                                        <span>
                                                            {format(new Date(activity.timestamp), "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr })}
                                                        </span>
                                                        <span className="mx-2 opacity-50 text-muted-foreground/50">|</span>
                                                        <span className="font-bold text-primary/80">
                                                            Exécuté par : {activity.user}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : !isLoading && (
                                <div className="flex flex-col items-center justify-center text-center py-24 opacity-50">
                                    <History className="h-16 w-16 mb-4 text-muted-foreground" />
                                    <p className="text-xl font-medium text-foreground">Aucune activité trouvée</p>
                                    <p className="text-muted-foreground mt-2 max-w-sm">
                                        Essayez d'ajuster vos filtres ou effectuez une action dans le système.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/20">
                                <p className="text-xs text-muted-foreground font-medium">
                                    Affichage de {page * limit + 1} à {Math.min((page + 1) * limit, total)} sur {total} activités
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 0}
                                        onClick={() => setPage(p => p - 1)}
                                        className="rounded-lg h-8 px-3"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                                    </Button>
                                    <div className="text-xs font-bold px-3">
                                        Page {page + 1} / {totalPages}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= totalPages - 1}
                                        onClick={() => setPage(p => p + 1)}
                                        className="rounded-lg h-8 px-3"
                                    >
                                        Suivant <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
