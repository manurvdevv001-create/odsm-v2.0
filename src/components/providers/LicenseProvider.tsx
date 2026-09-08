"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface LicenseData {
    id: string;
    type: string;
    customName: string | null;
    status: string;
    startDate: string;
    endDate: string;
    daysLeft: number;
}

interface LicenseContextType {
    license: LicenseData | null;
    daysLeft: number | null;
    isExpiringSoon: boolean;
    isLoading: boolean;
}

const LicenseContext = createContext<LicenseContextType>({
    license: null,
    daysLeft: null,
    isExpiringSoon: false,
    isLoading: true,
});

export function useLicense() {
    return useContext(LicenseContext);
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const [license, setLicense] = useState<LicenseData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/license")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled && data && !data.error) {
                    setLicense(data as LicenseData);
                }
            })
            .catch(() => {
                // Silently ignore — license ribbon simply won't render
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const daysLeft = license?.daysLeft ?? null;
    const isExpiringSoon = daysLeft !== null && daysLeft <= 30;

    return (
        <LicenseContext.Provider value={{ license, daysLeft, isExpiringSoon, isLoading }}>
            {children}
        </LicenseContext.Provider>
    );
}
