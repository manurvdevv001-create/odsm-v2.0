import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const school = await db.school.findFirst({
            include: { students: true }
        });
        if (!school) return NextResponse.json({ error: "None" });

        const stats: Record<string, number> = {};
        school.students.forEach((s: any) => {
            const key = s.classroomName || "Unknown";
            stats[key] = (stats[key] || 0) + 1;
        });

        const targets = ["1ère Maternelle", "1e Primaire A", "2ème Maternelle", "1e Primaire B"];
        const detailedStats = targets.map(t => ({ name: t, count: stats[t] || 0 }));

        return NextResponse.json({
            stats: detailedStats,
            allStats: stats
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) });
    }
}
