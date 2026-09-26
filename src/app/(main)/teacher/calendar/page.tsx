"use client";

import { Loader2 } from "lucide-react";
import { SchoolCalendarView } from "@/components/school-calendar-view";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { getTeacherCalendarLevels } from "@/lib/teacher-calendar-access";

export default function TeacherCalendarPage() {
    const { schoolData, user, isLoading } = useSchoolData();

    if (isLoading || !schoolData) {
        return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const levels = getTeacherCalendarLevels(user, schoolData);
    return <SchoolCalendarView calendar={schoolData.calendar || {}} levels={levels} />;
}
