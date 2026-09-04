import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const matricule = searchParams.get("matricule");
    const level = searchParams.get("level");

    if (!matricule || !level) {
        return NextResponse.json({ error: "Matricule et level requis" }, { status: 400 });
    }

    try {
        const school = await db.school.findUnique({ where: { matricule } });
        if (!school) {
            return NextResponse.json({ error: "École introuvable" }, { status: 404 });
        }

        const calendar = JSON.parse(school.calendar || "{}");
        const levelKey = level.toLowerCase();
        const levelData = calendar[levelKey];
        if (!levelData?.periods?.length) {
            return NextResponse.json({ advanced: false, reason: "Aucune période configurée" });
        }

        const periods = levelData.periods;
        const today = new Date().toISOString().split('T')[0];

        const activeIdx = periods.findIndex((p: any) => p.isActive);
        if (activeIdx === -1) {
            return NextResponse.json({ advanced: false, reason: "Aucune période active" });
        }

        const activePeriod = periods[activeIdx];
        if (!activePeriod.endDate) {
            return NextResponse.json({ advanced: false, reason: "Période active sans date de fin" });
        }

        if (today < activePeriod.endDate) {
            return NextResponse.json({ advanced: false, reason: "Période active encore en cours" });
        }

        const nextIdx = activeIdx + 1;
        if (nextIdx >= periods.length) {
            return NextResponse.json({ advanced: false, reason: "Dernière période déjà atteinte" });
        }

        periods[activeIdx].isActive = false;
        periods[nextIdx].isActive = true;

        calendar[levelKey] = { ...levelData, periods };
        await db.school.update({
            where: { matricule },
            data: { calendar: JSON.stringify(calendar) }
        });

        return NextResponse.json({
            advanced: true,
            previousPeriod: periods[activeIdx],
            activePeriod: periods[nextIdx]
        });
    } catch (error) {
        console.error("[Auto-Advance] Error:", error);
        return NextResponse.json({ error: "Erreur lors de l'avancement automatique" }, { status: 500 });
    }
}
