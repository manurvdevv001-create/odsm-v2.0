"use client";

import { useState } from "react";
import { Database, AlertCircle, RefreshCw, CheckCircle2 } from "lucide-react";
import { attemptDatabaseRepair } from "@/lib/db-health-actions";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export default function DatabaseHealthIndicator() {
    const { dbStatus, refreshData } = useSchoolData();
    const [isRepairing, setIsRepairing] = useState(false);

    const handleRepair = async () => {
        setIsRepairing(true);
        const res = await attemptDatabaseRepair();
        if (res.success) {
            refreshData();
        }
        setIsRepairing(false);
    };

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-background/50 border border-border/50 shadow-sm transition-all hover:bg-muted/50 cursor-help">
                        <div className="relative flex h-2 w-2">
                            {dbStatus === "connected" && (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </>
                            )}
                            {dbStatus === "disconnected" && (
                                <>
                                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </>
                            )}
                            {dbStatus === "checking" && (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
                            )}
                        </div>
                        <Database className={`h-4 w-4 ${dbStatus === "connected" ? "text-green-500" : dbStatus === "disconnected" ? "text-red-500" : "text-muted-foreground"}`} />
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="w-64 p-3 rounded-xl shadow-xl border-border bg-card">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">État SQLite</span>
                            {dbStatus === "connected" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                        </div>
                        
                        <p className="text-sm font-medium leading-relaxed">
                            {dbStatus === "connected" 
                                ? "Base de données opérationnelle" 
                                : dbStatus === "disconnected" 
                                ? "La connexion à SQLite a été perdue." 
                                : "Vérification en cours..."}
                        </p>

                        {dbStatus === "disconnected" && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleRepair}
                                disabled={isRepairing}
                                className="w-full gap-2 border-red-500/20 hover:bg-red-500/10 text-red-600 font-bold shadow-sm"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isRepairing ? "animate-spin" : ""}`} />
                                {isRepairing ? "Tentative..." : "Forcer la connexion"}
                            </Button>
                        )}

                        <div className="pt-2 mt-2 border-t border-border/50">
                            <p className="text-[10px] text-muted-foreground italic">
                                Note: En cas de déconnexion prolongée, vérifiez que le fichier dev.db est présent.
                            </p>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
