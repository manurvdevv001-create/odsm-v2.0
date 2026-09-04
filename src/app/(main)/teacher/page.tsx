"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";

export default function TeacherPortalPage() {
    const router = useRouter();
    const { user, isLoading } = useSchoolData();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        if (!isLoading && user) {
            setRedirecting(true);
            
            // Check user properties
            // Note: StaffProfile level can be 'maternelle', 'primaire', 'secondaire'
            const level = user.profile?.level?.toLowerCase() || "";
            
            if (level === "maternelle" || level === "primaire" || level === "secondaire") {
                if (user.profile?.assignedClassroom) {
                    router.replace("/teacher/titulaire");
                } else {
                    router.replace("/teacher/courses");
                }
            } else {
                // Default fallback if level is unknown or not set
                // If it's a secondary teacher (default), show courses
                // Otherwise, don't redirect to dashboard to avoid loops
                router.replace("/teacher/courses");
            }
        } else if (!isLoading && !user) {
            router.replace("/login");
        }
    }, [user, isLoading, router]);

    return (
        <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
                Accès à votre espace enseignant...
            </p>
        </div>
    );
}
