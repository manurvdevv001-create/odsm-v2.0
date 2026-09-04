import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const school = await db.school.findFirst({
            include: {
                students: true,
                payments: {
                    include: {
                        details: true
                    }
                },
            },
        });

        if (!school) {
            return NextResponse.json({ error: "Aucune école trouvée." }, { status: 404 });
        }

        const financeSettings = JSON.parse(school.financeSettings || "{}");
        const activeCalendar = JSON.parse(school.calendar || "{}");
        const activeYear = activeCalendar.schoolYear;

        // Pivot finance settings for active year if needed
        let currentFinance = financeSettings;
        if (activeYear && financeSettings[activeYear]) {
            currentFinance = financeSettings[activeYear];
        }

        // Return a condensed version for the mobile app
        return NextResponse.json({
            school: {
                id: school.id,
                name: school.name,
                matricule: school.matricule,
                activeYear: activeYear,
            },
            levels: JSON.parse(school.levels || "{}"),
            structure: JSON.parse(school.structure || "{}"),
            financeSettings: currentFinance,
            students: (school.students || []).map((s: any) => ({
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
                middleName: s.middleName,
                matricule: (s as any).matricule,
                gradeName: s.gradeName,
                classroomName: s.classroomName,
                gender: s.gender,
                status: s.status,
            })),
            payments: (school.payments || []).map((p: any) => ({
                id: p.id,
                studentId: p.studentId,
                type: p.type,
                amount: p.amount,
                currency: p.currency,
                date: p.date,
                details: p.details.map((d: any) => ({
                    feeName: d.feeName,
                    amount: d.amount
                }))
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("API /api/sync/pull error:", error);
        return NextResponse.json({ error: "Erreur de synchronisation." }, { status: 500 });
    }
}
