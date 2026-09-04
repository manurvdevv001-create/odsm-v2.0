"use client";

import React, { useState } from "react";
import { HelpCircle, X, Lightbulb, Wrench, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { helpContent } from "@/lib/help-content";
import { cn } from "@/lib/utils";

interface PageHelpProps {
    pageId: string;
    className?: string;
    variant?: "icon" | "button";
}

export function PageHelp({ pageId, className, variant = "icon" }: PageHelpProps) {
    const [open, setOpen] = useState(false);
    const content = helpContent[pageId];

    if (!content) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {variant === "icon" ? (
                    <button
                        className={cn(
                            "inline-flex items-center justify-center h-8 w-8 rounded-xl",
                            "text-muted-foreground/50 hover:text-primary hover:bg-primary/10",
                            "transition-all duration-300 cursor-pointer",
                            "animate-in fade-in zoom-in duration-300",
                            className
                        )}
                        title="Aide pour cette page"
                    >
                        <HelpCircle className="h-4.5 w-4.5" />
                    </button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn("gap-1.5 text-muted-foreground/60 hover:text-primary", className)}
                    >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">Aide</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg sm:max-w-2xl max-h-[85vh] p-0 gap-0 rounded-2xl border-border/30 shadow-2xl overflow-hidden">
                {/* Header */}
                <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/10">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                            <HelpCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-extrabold tracking-tight text-foreground leading-tight">
                                {content.title}
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                                {content.description}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-6 py-5 space-y-6">
                        {/* Features */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    Fonctionnalités
                                </h3>
                            </div>
                            <div className="grid gap-2.5">
                                {content.features.map((f, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl bg-muted/30 border border-border/10 p-3.5 hover:bg-muted/50 transition-colors"
                                    >
                                        <p className="text-sm font-bold text-foreground mb-0.5">{f.label}</p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">{f.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* How To */}
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <Wrench className="h-4 w-4 text-blue-500" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                    Comment s'y prendre
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {content.howTo.map((h, i) => (
                                    <div key={i} className="flex gap-3 items-start">
                                        <Badge
                                            className="h-6 w-6 shrink-0 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-black text-[10px] flex items-center justify-center p-0 mt-0.5"
                                        >
                                            {i + 1}
                                        </Badge>
                                        <div>
                                            <p className="text-sm font-bold text-foreground">{h.step}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{h.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Tips */}
                        {content.tips && content.tips.length > 0 && (
                            <section>
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="h-4 w-4 text-emerald-500" />
                                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                        Astuces
                                    </h3>
                                </div>
                                <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/30 dark:border-emerald-800/20 p-4 space-y-2">
                                    {content.tips.map((tip, i) => (
                                        <div key={i} className="flex gap-2 items-start">
                                            <span className="text-emerald-500 text-xs mt-0.5 font-bold">💡</span>
                                            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{tip}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
