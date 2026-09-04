"use client";

import { Loader2 } from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isRouteAllowed, isAdminRole, getHomeHref, getUserRestrictions } from "@/lib/role-permissions";
import { checkDatabaseHealth } from "@/lib/db-health-actions";
import { getClassroomLevel, classroomNamesMatch } from "@/lib/classroom-utils";

// School data context for sharing across dashboard pages
export interface SchoolDataContextType {
    schoolData: any | null;
    user: any | null;
    isLoading: boolean;
    refreshData: () => void;
    selectedYear: string | null;
    setSelectedYear: (year: string | null) => void;
    yearState: "active" | "archive" | "draft";
    dbStatus: "connected" | "disconnected" | "checking";
}

export const SchoolDataContext = createContext<SchoolDataContextType | null>(null);

export const useSchoolData = () => {
    const context = useContext(SchoolDataContext);
    if (!context) {
        throw new Error("useSchoolData must be used within a SchoolDataProvider");
    }
    return context;
};

export function SchoolDataProvider({ children }: { children: React.ReactNode }) {
    const [schoolData, setSchoolData] = useState<any>(null);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking");
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();

    const fetchSchoolData = async (targetYear?: string, silent: boolean = false) => {
        if (!silent) setIsLoading(true);
        try {
            const matricule = typeof window !== "undefined" ? localStorage.getItem("odsm-matricule") : null;
            const storedUser = typeof window !== "undefined" ? localStorage.getItem("odsm-user") : null;
            let currentUser = null;
            if (storedUser) {
                try {
                    currentUser = JSON.parse(storedUser);
                    setUser(currentUser);
                } catch (e) {
                    console.error("Provider: Error parsing user", e);
                }
            }

            // Fetch School Data from API
            const params = new URLSearchParams();
            if (targetYear) params.append("year", targetYear);
            if (matricule) params.append("matricule", matricule);
            
            if (currentUser?.role === "TEACHER") {
                params.append("mode", "teacher");
                const staffId = currentUser?.profile?.id;
                if (staffId) params.append("staffId", staffId);
            }

            const url = `/api/school?${params.toString()}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                
                const parsedData = {
                    ...data,
                    configuration: typeof data.configuration === 'string' ? JSON.parse(data.configuration || '{}') : (data.configuration || {}),
                    calendar: typeof data.calendar === 'string' ? JSON.parse(data.calendar || '{}') : (data.calendar || {}),
                    levels: typeof data.levels === 'string' ? JSON.parse(data.levels || '{}') : (data.levels || {}),
                    structure: typeof data.structure === 'string' ? JSON.parse(data.structure || '{}') : (data.structure || {}),
                    courses: typeof data.courses === 'string' ? JSON.parse(data.courses || '{}') : (data.courses || {}),
                    timeSlots: typeof data.timeSlots === 'string' ? JSON.parse(data.timeSlots || '{}') : (data.timeSlots || {}),
                    timetables: typeof data.timetables === 'string' ? JSON.parse(data.timetables || '{}') : (data.timetables || {}),
                    financeSettings: typeof data.financeSettings === 'string' ? JSON.parse(data.financeSettings || '{}') : (data.financeSettings || {}),
                    activityLog: typeof data.activityLog === 'string' ? JSON.parse(data.activityLog || '[]') : (data.activityLog || []),
                };

                // ---- ROW-LEVEL SECURITY FILTERING ----
                if (currentUser && currentUser.role !== 'TEACHER') {
                    const restrictions = getUserRestrictions(currentUser);
                    
                    if (restrictions.levels.length > 0 || restrictions.classrooms.length > 0) {
                        // Filter Students
                        if (parsedData.students && Array.isArray(parsedData.students)) {
                            parsedData.students = parsedData.students.filter((student: any) => {
                                const classroom = student.classroomName || student.gradeName;
                                if (!classroom) return true; // Keep unassigned students visible to those with restricted access
                                
                                // 1. Check classroom level restriction
                                let isAllowed = false;
                                
                                if (restrictions.levels.length > 0) {
                                    const lvl = getClassroomLevel(classroom, parsedData);
                                    if (lvl && restrictions.levels.some((r: string) => r.toLowerCase() === lvl.toLowerCase())) {
                                        isAllowed = true;
                                    }
                                }
                                
                                // 2. Check classroom specific restriction (Additive / OR logic)
                                if (restrictions.classrooms.length > 0) {
                                    // Map UUID references to classroom names before matching
                                    const nameRefs = restrictions.classrooms.map((c: string) => {
                                        const found = (parsedData.classrooms as any[])?.find((cl: any) => cl.id === c);
                                        return found?.name || c;
                                    });
                                    if (nameRefs.some((c: string) => classroomNamesMatch(c, classroom))) {
                                        isAllowed = true;
                                    }
                                }
                                
                                // 3. If no restrictions at all, allow everything
                                if (restrictions.levels.length === 0 && restrictions.classrooms.length === 0) {
                                    isAllowed = true;
                                }
                                
                                return isAllowed;
                            });
                            // Sync dashboard counts with filtered data
                            parsedData.studentCount = parsedData.students.length;
                        }

                        // Filter Payments (keep only payments for allowed students)
                        if (parsedData.payments && Array.isArray(parsedData.payments) && parsedData.students) {
                            const allowedStudentIds = new Set(parsedData.students.map((s: any) => s.id));
                            parsedData.payments = parsedData.payments.filter((payment: any) => 
                                allowedStudentIds.has(payment.studentId)
                            );
                            // Sync dashboard counts with filtered data
                            parsedData.paymentCount = parsedData.payments.length;
                        }
                    }
                }

                setSchoolData(parsedData);

                if (data.freshProfile && currentUser?.role === "TEACHER") {
                    const updatedUser = {
                        ...currentUser,
                        profile: data.freshProfile,
                    };
                    setUser(updatedUser);
                    if (typeof window !== "undefined") {
                        localStorage.setItem("odsm-user", JSON.stringify(updatedUser));
                    }
                }

                if (!selectedYear && (data.calendar?.schoolYear || data.activeYear)) {
                    setSelectedYear(data.calendar?.schoolYear || data.activeYear);
                }
                setDbStatus("connected");
            } else {
                if (res.status < 500) {
                    setDbStatus("connected");
                } else {
                    const health = await checkDatabaseHealth();
                    setDbStatus(health.success ? "connected" : "disconnected");
                }
            }
        } catch (error) {
            console.error("Failed to fetch school data:", error);
            const health = await checkDatabaseHealth();
            setDbStatus(health.success ? "connected" : "disconnected");
        }
        if (!silent) setIsLoading(false);
    };

    useEffect(() => {
        fetchSchoolData(selectedYear || undefined);
    }, [selectedYear, user?.role]);

    // Sync photo frame preference to HTML attribute so Avatar component can read it
    useEffect(() => {
        if (schoolData?.configuration?.uiSettings?.photoFrame) {
            document.documentElement.setAttribute('data-photo-frame', schoolData.configuration.uiSettings.photoFrame);
        } else {
            document.documentElement.setAttribute('data-photo-frame', 'round');
        }
    }, [schoolData?.configuration?.uiSettings?.photoFrame]);

    // Initial load: Fetch user if not already fetched by fetchSchoolData
    useEffect(() => {
        if (!user) {
            const storedUser = typeof window !== "undefined" ? localStorage.getItem("odsm-user") : null;
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch (e) {}
            }
        }
    }, [user]);

    const contextValue = {
        schoolData,
        user,
        isLoading,
        refreshData: () => fetchSchoolData(selectedYear || undefined, true),
        selectedYear,
        setSelectedYear,
        yearState: schoolData?.yearState || "active",
        dbStatus,
    };

    // Routing and access logic (Client side)
    const userRoleUpper = (user?.role || "").toUpperCase();
    const homeHref = getHomeHref(userRoleUpper);

    useEffect(() => {
        if (!isLoading && typeof window !== "undefined" && user && pathname) {
            // Check if user has permission for this route
            if (!isRouteAllowed(userRoleUpper, pathname)) {
                router.replace(homeHref);
            }
        }
    }, [isLoading, user, pathname, userRoleUpper, homeHref, router]);

    // Auto-redirect to login after 5 seconds if not authenticated
    useEffect(() => {
        if (!isLoading && !user && pathname !== "/login") {
            const timer = setTimeout(() => {
                router.replace("/login");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, user, pathname, router]);

    let content = children;

    if (isLoading) {
        content = (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">
                        Chargement de votre espace...
                    </p>
                </div>
            </div>
        );
    } else {
        // 0. Security check: if user is not logged in, show access denied while redirecting
        if (!user && pathname !== "/login") {
            content = (
                <div className="flex h-[40vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="p-4 rounded-full bg-red-50">
                            <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-red-600">Accès refusé</p>
                            <p className="text-sm text-muted-foreground mt-1">Redirection vers la page de connexion dans <span className="font-bold text-red-500">5 secondes</span>...</p>
                        </div>
                    </div>
                </div>
            );
        }
        // 1. If user tries to access a route they don't have permission for
        else if (user && pathname && !isRouteAllowed(userRoleUpper, pathname)) {
            content = <div className="flex h-[40vh] items-center justify-center font-bold">Redirection vers votre espace...</div>;
        } else {
            content = (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            );
        }
    }

    return (
        <SchoolDataContext.Provider value={contextValue}>
            {content}
        </SchoolDataContext.Provider>
    );
}
