"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLicense } from "@/components/providers/LicenseProvider";
import { CalendarDays, Clock, X } from "lucide-react";

function formatDate(dateStr: string): string {
    try {
        return new Date(dateStr).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

export function LicenseRibbon() {
    const { license, daysLeft, isExpiringSoon, isLoading } = useLicense();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!open) return;
        function handleClickOutside(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [open]);

    // Do not render while loading or if no license data
    if (isLoading || !license) return null;

    const accent = isExpiringSoon
        ? { bg: "bg-red-600", hover: "hover:bg-red-700", text: "text-white", badge: "bg-red-800/60 text-red-100", border: "border-red-500/40" }
        : { bg: "bg-emerald-600", hover: "hover:bg-emerald-700", text: "text-white", badge: "bg-emerald-800/60 text-emerald-100", border: "border-emerald-500/40" };

    const licenseLabel = license.customName || license.type;

    return (
        <div
            ref={panelRef}
            className="fixed z-40"
            style={{ top: "80px", right: 0 }}
        >
            <AnimatePresence mode="wait">
                {!open ? (
                    /* ── Collapsed tab button ── */
                    <motion.button
                        key="tab"
                        initial={{ x: 40, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 40, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        onClick={() => setOpen(true)}
                        className={`
                            flex items-center justify-center
                            ${accent.bg} ${accent.hover} ${accent.text}
                            rounded-l-lg shadow-lg cursor-pointer
                            select-none border-l border-y ${accent.border}
                            transition-colors duration-200
                        `}
                        style={{ width: 28, height: 88, writingMode: "vertical-rl", letterSpacing: "0.2em" }}
                        title="Afficher les détails de la licence"
                        aria-label="Afficher les détails de la licence"
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ transform: "rotate(180deg)" }}>
                            LICENCE
                        </span>
                    </motion.button>
                ) : (
                    /* ── Expanded panel ── */
                    <motion.div
                        key="panel"
                        initial={{ x: "100%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "100%", opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`
                            flex flex-col gap-3 p-4
                            ${accent.bg} ${accent.text}
                            rounded-l-xl shadow-2xl
                            border-l border-y ${accent.border}
                            min-w-[280px] max-w-[320px]
                        `}
                    >
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Licence Active</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${accent.badge} uppercase`}>
                                    {licenseLabel}
                                </span>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                                aria-label="Fermer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-white/20" />

                        {/* Details */}
                        <div className="flex flex-col gap-2 text-sm">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 opacity-70 shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Date de début</span>
                                    <span className="font-semibold">{formatDate(license.startDate)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <CalendarDays className="h-4 w-4 opacity-70 shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Date d&apos;expiration</span>
                                    <span className="font-semibold">{formatDate(license.endDate)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 opacity-70 shrink-0" />
                                <div className="flex flex-col leading-tight">
                                    <span className="text-[9px] uppercase tracking-widest opacity-60 font-bold">Jours restants</span>
                                    <span className={`font-black text-lg leading-none ${isExpiringSoon ? "text-red-100" : "text-emerald-100"}`}>
                                        {daysLeft !== null ? daysLeft : "—"}
                                        <span className="text-xs font-normal opacity-70 ml-1">jours</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isExpiringSoon && (
                            <div className="text-[10px] font-semibold bg-red-800/40 border border-red-400/30 rounded-lg px-3 py-2 leading-tight">
                                ⚠ Renouvellement urgent — Contactez l&apos;administration ODSM.
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
