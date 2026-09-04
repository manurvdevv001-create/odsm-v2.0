"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { School, Settings2, CheckCircle2, ClipboardList, UserCog } from "lucide-react";

const SETUP_STEPS = [
    { path: "/setup", title: "Identité de l'École", icon: <School size={16} /> },
    { path: "/setup/structure", title: "Structure", icon: <Settings2 size={16} /> },
    { path: "/setup/standardization", title: "Normalisation", icon: <ClipboardList size={16} /> },
    { path: "/setup/admin", title: "Compte Admin", icon: <UserCog size={16} /> },
];

export default function SetupLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const currentStepIndex = SETUP_STEPS.findIndex(s => s.path === pathname);

    return (
        <div className="min-h-screen bg-muted/30 flex">
            {/* Barre latérale de progression */}
            <aside className="hidden md:flex w-64 flex-col border-r bg-card/50 backdrop-blur-sm p-6 space-y-8">
                <div className="flex items-center gap-2 font-bold text-xl text-primary">
                    <School className="w-6 h-6" />
                    <span>Configuration ODSM</span>
                </div>

                <div className="space-y-1 relative">
                    {/* Ligne de connexion */}
                    <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-border -z-10"></div>

                    {SETUP_STEPS.map((step, index) => {
                        let status: 'active' | 'completed' | 'pending' = 'pending';
                        if (index === currentStepIndex) status = 'active';
                        else if (index < currentStepIndex) status = 'completed';

                        return (
                            <StepItem
                                key={step.path}
                                icon={status === 'completed' ? <CheckCircle2 size={16} /> : step.icon}
                                title={step.title}
                                status={status}
                            />
                        );
                    })}
                </div>

                <div className="mt-auto text-xs text-muted-foreground">
                    <p>Besoin d&apos;aide ?</p>
                    <p className="font-semibold">support@odsm.com</p>
                </div>
            </aside>

            {/* Zone de contenu principal */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Orbes animés en arrière-plan */}
                <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] -z-10"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[80px] -z-10"></div>

                <div className="flex-1 container max-w-3xl mx-auto p-6 md:p-12 flex flex-col justify-center">
                    {children}
                </div>
            </main>
        </div>
    );
}

function StepItem({ icon, title, status }: { icon: ReactNode, title: string, status: 'active' | 'completed' | 'pending' }) {
    const isActive = status === 'active';
    const isCompleted = status === 'completed';

    return (
        <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : isCompleted ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center border transition-all
                ${isActive ? 'border-primary bg-primary text-primary-foreground shadow-sm' : ''}
                ${isCompleted ? 'border-primary bg-primary text-primary-foreground' : ''}
                ${status === 'pending' ? 'border-muted-foreground/30 bg-background' : ''}
            `}>
                {icon}
            </div>
            <span>{title}</span>
        </div>
    )
}
