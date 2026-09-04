"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hash } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import StudentNumberingSettings from "@/components/settings/student-numbering-settings";

export default function StudentNumberingPage() {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8 h-full max-w-5xl mx-auto pb-20 px-4 md:px-0"
        >
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
                <div className="space-y-1">
                    <Link href="/settings">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 pl-0 hover:bg-transparent text-muted-foreground hover:text-primary transition-colors font-bold group"
                        >
                            <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" /> 
                            RETOUR
                        </Button>
                    </Link>
                    <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
                        Numérotation <span className="text-primary font-light italic">Élèves</span>
                    </h1>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                        Personnalisation du format des matricules
                    </p>
                </div>
            </div>

            <div className="w-full">
                <StudentNumberingSettings />
            </div>
        </motion.div>
    );
}
