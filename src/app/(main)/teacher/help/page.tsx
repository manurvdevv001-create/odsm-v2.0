"use client";

import React, { useState } from "react";
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    HelpCircle,
    ArrowLeft,
    Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fullGuideContent } from "@/lib/help-content";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function TeacherHelpPage() {
    const router = useRouter();
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["philosophy"]));
    const [searchTerm, setSearchTerm] = useState("");

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        setExpandedSections(new Set(fullGuideContent.sections.map(s => s.id)));
    };

    const collapseAll = () => {
        setExpandedSections(new Set());
    };

    // Filter sections by search term
    const filteredSections = fullGuideContent.sections.filter(section => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            section.title.toLowerCase().includes(term) ||
            section.content.toLowerCase().includes(term) ||
            section.details.some(d => d.toLowerCase().includes(term))
        );
    });

    const filteredGlossary = fullGuideContent.glossary.filter(g => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return g.term.toLowerCase().includes(term) || g.definition.toLowerCase().includes(term);
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    onClick={() => router.back()}
                    className="w-fit text-muted-foreground hover:text-foreground -ml-2"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Retour
                </Button>

                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-2xl bg-primary/10 mt-1">
                            <BookOpen className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                                {fullGuideContent.title}
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1">
                                {fullGuideContent.subtitle}
                            </p>
                            <Badge className="mt-2 bg-primary/10 text-primary border-none text-[10px] font-black uppercase tracking-widest">
                                Documentation Officielle
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs font-bold rounded-xl h-8"
                            onClick={expandAll}
                        >
                            Tout ouvrir
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs font-bold rounded-xl h-8"
                            onClick={collapseAll}
                        >
                            Tout fermer
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/30" />
                    <Input
                        placeholder="Rechercher dans le guide..."
                        className="pl-10 h-10 rounded-xl border-border/30 bg-muted/20"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Navigation rapide */}
            <div className="glass-card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-3">
                    Navigation rapide
                </p>
                <div className="flex flex-wrap gap-2">
                    {fullGuideContent.sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => {
                                setExpandedSections(prev => new Set([...prev, section.id]));
                                document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className={cn(
                                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                                "bg-muted/30 hover:bg-primary/10 hover:text-primary text-muted-foreground",
                                "border border-border/10 hover:border-primary/20"
                            )}
                        >
                            {section.icon} {section.title.split("—")[0].trim()}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            document.getElementById("section-glossary")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer bg-muted/30 hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border/10 hover:border-primary/20"
                    >
                        📖 Glossaire
                    </button>
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
                {filteredSections.map(section => {
                    const isExpanded = expandedSections.has(section.id);

                    return (
                        <div
                            key={section.id}
                            id={`section-${section.id}`}
                            className={cn(
                                "glass-card overflow-hidden transition-all duration-300",
                                isExpanded ? "shadow-lg border-primary/10" : "shadow-sm"
                            )}
                        >
                            {/* Section Header */}
                            <button
                                className="w-full flex items-center gap-3 p-5 text-left cursor-pointer hover:bg-muted/20 transition-colors"
                                onClick={() => toggleSection(section.id)}
                            >
                                <span className="text-2xl">{section.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-base font-extrabold text-foreground tracking-tight">
                                        {section.title}
                                    </h2>
                                    {!isExpanded && (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {section.content}
                                        </p>
                                    )}
                                </div>
                                {isExpanded ? (
                                    <ChevronDown className="h-5 w-5 text-primary shrink-0" />
                                ) : (
                                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                                )}
                            </button>

                            {/* Section Content */}
                            {isExpanded && (
                                <div className="px-5 pb-5 pt-0 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Description */}
                                    <div className="bg-muted/20 rounded-xl p-4 border border-border/10">
                                        <p className="text-sm text-foreground leading-relaxed font-medium">
                                            {section.content}
                                        </p>
                                    </div>

                                    {/* Details */}
                                    <div className="space-y-1.5 pl-1">
                                        {section.details.map((detail, i) => (
                                            <React.Fragment key={i}>
                                                {detail === "" ? (
                                                    <div className="h-2" />
                                                ) : (
                                                    <div className="flex gap-2 items-start">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0 mt-1.5" />
                                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                                            {detail}
                                                        </p>
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>

                                    {/* Example (if exists) */}
                                    {section.example && (
                                        <div className="bg-amber-50/50 dark:bg-amber-950/10 rounded-xl p-4 border border-amber-200/30 dark:border-amber-800/15">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">
                                                {section.example.title}
                                            </p>
                                            {section.example.rows.length > 0 && (
                                                <div className="overflow-x-auto mb-3">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="border-b border-amber-200/30 dark:border-amber-800/20">
                                                                <th className="text-left py-1.5 px-2 font-bold text-amber-800 dark:text-amber-300">Cours</th>
                                                                <th className="text-center py-1.5 px-2 font-bold text-amber-800 dark:text-amber-300">BaseMax</th>
                                                                <th className="text-center py-1.5 px-2 font-bold text-amber-800 dark:text-amber-300">Statut</th>
                                                                <th className="text-center py-1.5 px-2 font-bold text-amber-800 dark:text-amber-300">Score</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {section.example.rows.map((row: any, i: number) => (
                                                                <tr key={i} className="border-b border-amber-100/50 dark:border-amber-800/10">
                                                                    <td className="py-1.5 px-2 font-medium text-amber-900 dark:text-amber-200">{row.course}</td>
                                                                    <td className="py-1.5 px-2 text-center font-mono text-amber-700 dark:text-amber-300">{row.baseMax}</td>
                                                                    <td className="py-1.5 px-2 text-center">
                                                                        <Badge className={cn(
                                                                            "text-[8px] h-4 border-none font-black",
                                                                            row.status === "Clôturé" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                                                                        )}>
                                                                            {row.status}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="py-1.5 px-2 text-center font-mono font-bold text-amber-900 dark:text-amber-200">{row.score}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
                                                {section.example.result}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Glossary */}
            <div id="section-glossary" className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">📖</span>
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">Glossaire</h2>
                </div>
                <div className="grid gap-2">
                    {filteredGlossary.map((g, i) => (
                        <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-muted/20 border border-border/5 hover:bg-muted/30 transition-colors">
                            <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black shrink-0 mt-0.5 px-2">
                                {g.term}
                            </Badge>
                            <p className="text-xs text-muted-foreground leading-relaxed">{g.definition}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer hint */}
            <div className="text-center py-6 opacity-40">
                <HelpCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Chaque page dispose d'une icône d'aide <HelpCircle className="inline h-3 w-3" /> avec des instructions spécifiques
                </p>
            </div>
        </div>
    );
}
