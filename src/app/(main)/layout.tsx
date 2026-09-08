import Header from "@/components/Header";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SessionGuard } from "@/components/SessionGuard";
import { SchoolDataProvider } from "@/components/providers/SchoolDataProvider";
import { StudentDisplayProvider } from "@/components/providers/StudentDisplayProvider";
import { LicenseProvider } from "@/components/providers/LicenseProvider";
import { LicenseRibbon } from "@/components/LicenseRibbon";
import { Footer } from "@/components/Footer";

import { checkLicense } from "@/lib/license-check";
import { AlertTriangle, ShieldX, Clock } from "lucide-react";
import { cookies } from "next/headers";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const licenseStatus = await checkLicense();

    if (!licenseStatus.isValid) {
        // Determine the icon based on the message
        const isSuspended = licenseStatus.message?.includes("suspendu");
        const isExpired = licenseStatus.message?.includes("expiré");

        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl text-center border border-red-100 dark:border-red-900/30">
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-500/20 text-red-600 rounded-full flex items-center justify-center mb-6">
                        {isSuspended ? <ShieldX size={32} /> : isExpired ? <Clock size={32} /> : <AlertTriangle size={32} />}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {isSuspended ? "Accès Suspendu" : isExpired ? "Licence Expirée" : "Accès Bloqué"}
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        {licenseStatus.message || "La licence d'exploitation de votre établissement n'est pas valide ou a expiré."}
                    </p>
                    <div className="text-sm text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
                        Contactez l&apos;administration système <strong className="text-primary">ODSM</strong> pour régulariser votre situation ou renouveler votre licence.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <LicenseProvider>
            <SchoolDataProvider>
                <StudentDisplayProvider>
                    <div className="flex min-h-screen flex-col bg-background">
                        <Header />
                        <LicenseRibbon />
                        <main className="flex-1">
                            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                                {children}
                            </div>
                        </main>
                        <Footer />
                        <ScrollToTop />
                        <SessionGuard />
                    </div>
                </StudentDisplayProvider>
            </SchoolDataProvider>
        </LicenseProvider>
    );
}
