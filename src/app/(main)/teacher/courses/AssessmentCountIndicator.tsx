"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export function AssessmentCountIndicator({ courseId, classroomName, periodId, matricule }: { courseId: string, classroomName: string, periodId?: string, matricule?: string }) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchCount = async () => {
            if (!courseId || !classroomName) return;
            try {
                let url = `/api/teacher/grades?courseId=${courseId}&classroomId=${classroomName}`;
                if (matricule) {
                    url += `&matricule=${matricule}`;
                }
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setCount(data.assessments?.length || 0);
                }
            } catch (e) {
                console.error("Failed to fetch assessment count", e);
            }
        };
        fetchCount();
        return () => { isMounted = false; };
    }, [courseId, classroomName, matricule]);

    if (count === null) {
        return <Loader2 className="h-3 w-3 animate-spin inline-block opacity-50" />;
    }

    return <span>({count})</span>;
}
