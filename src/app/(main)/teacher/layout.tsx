"use client";

import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { useEffect, useMemo } from "react";
import { 
    LayoutDashboard, 
    BookOpen, 
    CalendarCheck, 
    CalendarDays,
    Users, 
    FileText, 
    Trophy,
    Star,
    HelpCircle,
    MoreHorizontal
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, schoolData, isLoading, refreshData } = useSchoolData();

    if (isLoading) return null;

    const level = user?.profile?.level?.toLowerCase() || "";
    const isSecondary = level === "secondaire";
    const isTitulaire = !!user?.profile?.assignedClassroom;

    // Auto-advance period if active period's endDate has passed
    useEffect(() => {
        if (!schoolData?.matricule || !level) return;
        const matricule = schoolData.matricule;
        fetch(`/api/school/periods/auto-advance?matricule=${matricule}&level=${level}`)
            .then(r => r.json())
            .then(data => {
                if (data.advanced) {
                    console.log(`[Auto-Advance] Advanced from "${data.previousPeriod.name}" to "${data.activePeriod.name}"`);
                    refreshData();
                }
            })
            .catch(err => console.error("[Auto-Advance] Fetch error:", err));
    }, [schoolData?.matricule, level, refreshData]);

    // Resolve Active Period
    const activePeriod = useMemo(() => {
        if (!schoolData?.calendar || !level) return null;
        const levelCalendar = (schoolData.calendar as any)[level];
        if (!levelCalendar?.periods) return null;

        const periods = levelCalendar.periods as any[];
        let active = periods.find(p => p.isActive);
        
        if (!active) {
            const today = new Date().toISOString().split('T')[0];
            active = periods.find(p => p.startDate && p.endDate && today >= p.startDate && today <= p.endDate);
        }

        return active;
    }, [schoolData, level]);

    const baseNavItems: any[] = [
        { 
            href: "/teacher/courses", 
            label: "Mes Cours", 
            icon: BookOpen,
            mobileLabel: "Cours"
        },
        { 
            href: "/teacher/assessments/planning", 
            label: "Planification", 
            icon: CalendarCheck,
            mobileLabel: "Planning"
        },
        {
            href: "/teacher/calendar",
            label: "Calendrier",
            icon: CalendarDays,
            mobileLabel: "Calendrier"
        },
        { 
            href: "/teacher/attendance", 
            label: "Pointage", 
            icon: Users,
            mobileLabel: "Pointage"
        },
        { 
            href: "/teacher/remarks", 
            label: "Remarques", 
            icon: FileText,
            mobileLabel: "Suivi"
        },
        { 
            href: "/teacher/help", 
            label: "Guide", 
            icon: HelpCircle,
            mobileLabel: "Guide"
        },
    ];

    // Add Titulaire and Panoramic buttons if the teacher is a titulaire
    if (isTitulaire) {
        // Insert right after the first item (Mes Cours/Panoramique)
        baseNavItems.splice(1, 0, {
            href: "/teacher/titulaire", 
            label: "Titulaire",
            icon: Star,
            mobileLabel: "Titulaire"
        });
        
        // Add Vue Panoramique inside the nav as well if needed, or keep it as is
        // Actually for primary, their first item is already 'Panoramique' or 'Courses'
        // Wait, let's see how baseNavItems is built before this.
        if (isSecondary) {
            baseNavItems.splice(2, 0, {
                href: "/teacher/panoramic",
                label: "Vue Panoramique",
                icon: Trophy,
                mobileLabel: "Panoramique"
            });
        }
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 pb-dock md:pb-0">
            {/* Desktop Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
                            Espace Enseignant
                            <span className="ml-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                — {level || "Général"}
                            </span>
                        </h2>
                        {activePeriod && (
                            <Badge className="glass-card px-3 py-1 text-xs font-bold text-primary border-primary/15 bg-primary/8 gap-1.5 animate-in fade-in zoom-in duration-300">
                                <CalendarCheck className="h-3 w-3 opacity-70" />
                                {activePeriod.name}
                            </Badge>
                        )}
                    </div>
                    {activePeriod && (
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center gap-2 ml-0.5">
                           Structure Académique — <span className="text-primary/70">{activePeriod.type === 'exam' ? 'Session d\'examens' : 'Période Ordinaire'}</span>
                        </p>
                    )}
                </div>

                {/* Desktop Navigation — Glass Pills */}
                <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {baseNavItems.map((item: any) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link 
                                key={item.href} 
                                href={item.disabled ? "#" : item.href}
                                className={cn(
                                    "flex-shrink-0 transition-opacity",
                                    item.disabled ? "cursor-not-allowed opacity-40" : "opacity-100"
                                )}
                            >
                                <div
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer select-none",
                                        isActive 
                                            ? "glass-card bg-primary/10 text-primary shadow-md" 
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                                        item.disabled && "pointer-events-none"
                                    )}
                                >
                                    <item.icon className={cn(
                                        "h-4 w-4 transition-transform duration-300",
                                        isActive ? "scale-110 text-primary" : ""
                                    )} />
                                    <span>{item.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Page Content */}
            <main className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {children}
            </main>

            {/* ── Mobile Bottom Navigation Dock (Stitch floating glass dock) ── */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 pt-0">
                <div className="glass-dock flex items-center justify-around px-2 py-2 mx-auto max-w-lg">
                    {baseNavItems.slice(0, 4).map((item: any) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.disabled ? "#" : item.href}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 min-w-[3.2rem]",
                                    isActive 
                                        ? "text-primary bg-primary/10" 
                                        : "text-muted-foreground hover:text-foreground",
                                    item.disabled && "opacity-30 pointer-events-none"
                                )}
                            >
                                <item.icon className={cn(
                                    "h-5 w-5 transition-all duration-300",
                                    isActive ? "scale-110" : ""
                                )} />
                                <span className={cn(
                                    "text-[9px] font-bold tracking-tight leading-none",
                                    isActive ? "text-primary" : ""
                                )} title={item.label}>
                                    {item.mobileLabel}
                                </span>
                                {isActive && (
                                    <div className="w-1 h-1 rounded-full bg-primary mt-0.5 animate-in zoom-in duration-200" />
                                )}
                            </Link>
                        );
                    })}

                    {/* Menu Plus pour tous les items restants (Pointage, Remarques, Guide, etc.) */}
                    {baseNavItems.length > 4 && (() => {
                        const overflowItems = baseNavItems.slice(4);
                        const isAnyOverflowActive = overflowItems.some((item: any) => pathname.startsWith(item.href));
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 min-w-[3.2rem] cursor-pointer outline-none",
                                            isAnyOverflowActive 
                                                ? "text-primary bg-primary/10 font-bold" 
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <MoreHorizontal className={cn(
                                            "h-5 w-5 transition-all duration-300",
                                            isAnyOverflowActive ? "scale-110 text-primary" : ""
                                        )} />
                                        <span className={cn(
                                            "text-[9px] font-bold tracking-tight leading-none",
                                            isAnyOverflowActive ? "text-primary" : ""
                                        )}>
                                            Plus
                                        </span>
                                        {isAnyOverflowActive && (
                                            <div className="w-1 h-1 rounded-full bg-primary mt-0.5 animate-in zoom-in duration-200" />
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="top" align="end" className="w-52 p-2 rounded-2xl shadow-2xl border-primary/10 bg-background/95 backdrop-blur-md mb-2">
                                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/30 mb-1">
                                        Autres Modules
                                    </div>
                                    {overflowItems.map((item: any) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <DropdownMenuItem key={item.href} asChild className="rounded-xl cursor-pointer">
                                                <Link 
                                                    href={item.disabled ? "#" : item.href}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 text-sm font-semibold transition-colors",
                                                        isActive 
                                                            ? "bg-primary/10 text-primary font-bold" 
                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                                    )}
                                                >
                                                    <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                                                    <span>{item.label}</span>
                                                </Link>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        );
                    })()}
                </div>
            </nav>
        </div>
    );
}
