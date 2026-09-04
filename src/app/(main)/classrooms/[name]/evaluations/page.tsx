"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, Construction, BookOpen, Users, Trophy, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AcademicEvaluationPage() {
    const params = useParams();
    const router = useRouter();
    const classroomName = decodeURIComponent(params.name as string);

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="neuglass-light-bg min-h-screen -m-4 sm:-m-6 lg:-m-10 p-4 sm:p-6 lg:p-10">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-10">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-fit text-muted-foreground hover:text-foreground hover:bg-white/50 rounded-xl"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="neuglass-light-icon h-16 w-16 rounded-2xl bg-primary/10 shadow-inner">
                            <GraduationCap className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-headline font-bold text-foreground uppercase tracking-tight">
                                Evaluation Académique
                            </h1>
                            <p className="text-muted-foreground mt-1 font-medium">
                                Gestion des notes et performances • <span className="text-primary font-bold">{classroomName}</span>
                            </p>
                        </div>
                    </div>
                    
                    <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Interface Modernisée</span>
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
                <motion.div variants={item}>
                    <Card className="neuglass-light-card border-white/80 shadow-2xl overflow-hidden group hover:-translate-y-2 transition-all duration-300">
                        <CardHeader className="bg-primary/5 pb-6 border-b border-primary/5">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <BookOpen className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-headline">Suivi Périodique</CardTitle>
                                    <CardDescription className="font-medium">Cahiers de cotes & révisions</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8 text-center space-y-6 px-6">
                            <div className="py-10 flex flex-col items-center justify-center border-2 border-primary/10 rounded-2xl bg-white/40 shadow-inner group-hover:bg-primary/5 transition-colors">
                                <BookOpen className="h-12 w-12 text-primary/40 mb-4" />
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Statut des Clôtures</p>
                            </div>
                            <Link href={`/classrooms/${encodeURIComponent(classroomName)}/evaluations/monitoring`}>
                                <Button className="w-full h-12 neuglass-light-btn-primary text-white rounded-xl shadow-lg font-bold group-hover:shadow-primary/30 transition-all">
                                    Ouvrir le module
                                    <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="neuglass-light-card border-white/80 shadow-2xl overflow-hidden group hover:-translate-y-2 transition-all duration-300 opacity-90">
                        <CardHeader className="bg-blue-500/5 pb-6 border-b border-blue-500/5">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shadow-sm">
                                    <Users className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-headline">Fiches de Suivi</CardTitle>
                                    <CardDescription className="font-medium">Progression individuelle</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8 text-center space-y-6 px-6">
                            <div className="py-10 flex flex-col items-center justify-center border-2 border-blue-500/10 rounded-2xl bg-white/40 shadow-inner group-hover:bg-blue-500/5 transition-colors">
                                <Users className="h-12 w-12 text-blue-500/40 mb-4" />
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Délibérations & Mentions</p>
                            </div>
                            <Link href={`/classrooms/${encodeURIComponent(classroomName)}/evaluations/fiches`}>
                                <Button className="w-full h-12 neuglass-light-btn-primary bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg font-bold group-hover:shadow-blue-500/30 transition-all border-0">
                                Ouvrir le module
                                    <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="neuglass-light-card border-white/80 shadow-2xl overflow-hidden group hover:-translate-y-2 transition-all duration-300">
                        <CardHeader className="bg-amber-500/5 pb-6 border-b border-amber-500/5">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                    <Trophy className="h-6 w-6" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-headline">Bulletins</CardTitle>
                                    <CardDescription className="font-medium">Génération & Palmarès</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-8 text-center space-y-6 px-6">
                            <div className="py-10 flex flex-col items-center justify-center border-2 border-amber-500/10 rounded-2xl bg-white/40 shadow-inner group-hover:bg-amber-500/5 transition-colors">
                                <Trophy className="h-12 w-12 text-amber-500/40 mb-4" />
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Compilation Active</p>
                            </div>
                            <Link href={`/classrooms/${encodeURIComponent(classroomName)}/evaluations/bulletins`}>
                                <Button className="w-full h-12 neuglass-light-btn-primary bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg font-bold group-hover:shadow-amber-500/30 transition-all border-0">
                                    Accéder au Palmarès
                                    <ChevronRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Coming Soon Alert */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-16 p-8 rounded-3xl bg-white/40 border border-white/80 shadow-xl flex flex-col items-center text-center max-w-3xl mx-auto backdrop-blur-md"
            >
                <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-inner">
                    <Construction className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-headline font-bold text-foreground mb-3">Hub d&apos;Évaluation en Évolution</h3>
                <p className="text-muted-foreground font-medium leading-relaxed max-w-xl">
                    Cette interface centralise désormais tous les outils de performance académique. 
                    Nous finalisons l&apos;intégration des maxima pondérés pour garantir une précision absolue dans la génération des bulletins.
                </p>
            </motion.div>
        </div>
    );
}
