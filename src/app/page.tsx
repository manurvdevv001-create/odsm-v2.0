"use client";

import { motion } from "framer-motion";
import { ArrowRight, School, ShieldCheck, TrendingUp, LogIn } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import OdsmLogo from "@/components/odsm-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-accent to-background overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-50 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[120px] opacity-50"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center max-w-4xl z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 flex justify-center"
        >
          <OdsmLogo variant="full" size="xl" className="items-center" />
        </motion.div>

        <div className="mb-6 inline-flex items-center px-3 py-1 rounded-full border border-primary/20 bg-white/50 backdrop-blur-sm text-primary text-sm font-medium">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-ping"></span>
          ODSM v2.0 Bêta
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-6">
          Nouvelle Génération <br />
          <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            Gestion Scolaire
          </span>
        </h1>

        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          Découvrez la fluidité, la rapidité et la précision. Le nouvel ODSM propulse l&apos;administration scolaire dans l&apos;ère moderne avec des analyses intelligentes et une interface premium.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/setup">
            <Button size="lg" variant="neuglass" className="h-12 px-8 text-lg group">
              Lancer l&apos;Assistant de Configuration
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="ghost" className="h-12 px-8 text-lg group">
              <LogIn className="mr-2 w-5 h-5" />
              Se Connecter
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 max-w-6xl w-full px-4">
        <FeatureCard
          icon={<School className="w-8 h-8 text-primary" />}
          title="Structure Intelligente"
          description="Des structures académiques flexibles qui s'adaptent à tout changement de programme scolaire."
          delay={0.2}
        />
        <FeatureCard
          icon={<TrendingUp className="w-8 h-8 text-primary" />}
          title="Finance en Temps Réel"
          description="Suivi instantané des frais et rapports financiers sans délai."
          delay={0.4}
        />
        <FeatureCard
          icon={<ShieldCheck className="w-8 h-8 text-primary" />}
          title="Sécurisé & Privé"
          description="Sécurité de niveau entreprise avec contrôle local des données via SQLite."
          delay={0.6}
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay, ease: "easeOut" }}
    >
      <Card className="neuglass-card h-full hover:scale-[1.02] transition-transform duration-300">
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="p-3 rounded-full bg-primary/10 mb-2">
            {icon}
          </div>
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
          <p className="text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
