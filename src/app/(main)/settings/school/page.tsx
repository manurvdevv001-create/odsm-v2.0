"use client";

import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    School, 
    MapPin, 
    Phone, 
    Layers, 
    CheckCircle2, 
    XCircle,
    ArrowLeft,
    Globe,
    Building2
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

import { getClassroomsByLevel } from "@/lib/classroom-utils";

export default function SchoolInfoPage() {
    const { schoolData, isLoading } = useSchoolData();

    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4 text-muted-foreground">
                    <School className="h-12 w-12" />
                    <p>Chargement des informations...</p>
                </div>
            </div>
        );
    }

    const school = schoolData as any;
    
    // Formatting helper
    const renderValue = (value: any) => value || <span className="text-muted-foreground italic">non renseigné</span>;

    const levels = school?.levels || {};
    const configuration = school?.configuration || {};
    const postCTEB = configuration?.postCTEB || false;

    // Helper for case-insensitive level check
    const isLevelActive = (lvl: string) => {
        const key = lvl.toLowerCase();
        return !!(levels[key] || levels[key.toUpperCase()]);
    };

    // Fetch classrooms per level
    const classroomsMaternelle = schoolData ? getClassroomsByLevel("maternelle", schoolData) : [];
    const classroomsPrimaire = schoolData ? getClassroomsByLevel("primaire", schoolData) : [];
    const classroomsSecondaire = schoolData ? getClassroomsByLevel("secondaire", schoolData) : [];

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Informations de l&apos;école</h1>
                    <p className="text-muted-foreground">Détails de configuration et identité de l&apos;établissement.</p>
                </div>
                <Link href="/dashboard">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowLeft className="h-4 w-4" /> Retour
                    </Button>
                </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* School Identity & Logo */}
                <Card className="md:col-span-1 overflow-hidden border-none shadow-xl bg-gradient-to-b from-card to-muted/20">
                    <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                        <div className="relative h-32 w-32 rounded-2xl bg-background border-2 border-dashed border-primary/20 flex items-center justify-center overflow-hidden shadow-inner group">
                            {school?.logo ? (
                                <Image 
                                    src={school.logo} 
                                    alt="Logo" 
                                    fill 
                                    className="object-contain p-2"
                                />
                            ) : (
                                <Building2 className="h-12 w-12 text-primary/30 group-hover:scale-110 transition-transform" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h2 className="font-bold text-xl">{school?.name}</h2>
                            <Badge variant="secondary" className="font-mono tracking-wider bg-primary/10 text-primary hover:bg-primary/20">
                                {school?.matricule}
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact & Location */}
                <Card className="md:col-span-2 border-none shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Globe className="h-5 w-5 text-primary" />
                            Coordonnées
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <Label text="Adresse" icon={MapPin} />
                            <p className="text-sm font-medium">{renderValue(school?.address)}</p>
                        </div>
                        <div className="space-y-1">
                            <Label text="Ville / Province" icon={Building2} />
                            <p className="text-sm font-medium">
                                {school?.city || school?.province ? `${school.city || ""}${school.city && school.province ? ", " : ""}${school.province || ""}` : renderValue(null)}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <Label text="Téléphone" icon={Phone} />
                            <p className="text-sm font-medium">{renderValue(school?.phone)}</p>
                        </div>
                        <div className="space-y-1">
                            <Label text="N° SECOPE" icon={Layers} />
                            <p className="text-sm font-mono">{renderValue(school?.secopeMatricule)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Academic Structure & Classrooms */}
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Structure Académique & Classes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid divide-y md:divide-y-0 md:divide-x md:grid-cols-3">
                        <LevelItem 
                            label="Maternelle" 
                            active={isLevelActive("maternelle")} 
                            classrooms={classroomsMaternelle}
                        />
                        <LevelItem 
                            label="Primaire" 
                            active={isLevelActive("primaire")} 
                            classrooms={classroomsPrimaire}
                        />
                        <LevelItem 
                            label="Secondaire" 
                            active={isLevelActive("secondaire")} 
                            badge={postCTEB ? "Post CTEB" : undefined}
                            classrooms={classroomsSecondaire}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Footer / Meta */}
            <p className="text-center text-xs text-muted-foreground opacity-50">
                Identifiant système : {school?.id}
            </p>
        </div>
    );
}

function Label({ text, icon: Icon }: { text: string; icon: any }) {
    return (
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Icon className="h-3 w-3" />
            {text}
        </label>
    );
}

function LevelItem({ label, active, badge, classrooms }: { label: string; active: boolean; badge?: string; classrooms: string[] }) {
    return (
        <div className="p-6 flex flex-col items-center text-center space-y-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                {active ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
            </div>
            <div className="space-y-2 w-full">
                <div>
                    <p className="font-bold text-lg">{label}</p>
                    <div className="flex flex-wrap justify-center gap-1 mt-1">
                        <Badge variant={active ? "default" : "outline"} className={active ? "bg-green-600 hover:bg-green-700" : "opacity-40"}>
                            {active ? "Activé" : "Désactivé"}
                        </Badge>
                        {badge && active && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none">
                                {badge}
                            </Badge>
                        )}
                    </div>
                </div>

                {active && (
                    <div className="pt-4 border-t border-border/50 w-full">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Classes ({classrooms.length})</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            {classrooms.length > 0 ? (
                                classrooms.map((cls) => (
                                    <span 
                                        key={cls} 
                                        className="text-[11px] px-2 py-0.5 rounded-md bg-muted font-medium text-foreground border border-border/50"
                                    >
                                        {cls}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground italic">Aucune classe</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
