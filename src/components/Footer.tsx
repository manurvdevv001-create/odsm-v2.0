"use client";

import { motion } from "framer-motion";

export function Footer() {
    const currentYear = new Date().getFullYear();
    
    return (
        <footer className="w-full py-6 mt-auto">
            <div className="container mx-auto px-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col items-center justify-center gap-1 text-center"
                >
                    <p className="text-[11px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                        © {currentYear} ODSM. Tous droits réservés.
                    </p>
                    <p className="text-[10px] text-muted-foreground/40 italic">
                        Conçu et développé avec excellence par <span className="text-primary/50 font-semibold not-italic">Emmanuel Massey</span>
                    </p>
                </motion.div>
            </div>
        </footer>
    );
}
