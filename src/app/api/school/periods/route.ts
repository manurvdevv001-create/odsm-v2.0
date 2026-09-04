import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const matricule = searchParams.get("matricule");
    const levelParam = searchParams.get("level");

    if (!matricule) {
        return NextResponse.json({ error: "Matricule manquant" }, { status: 400 });
    }

    try {
        const whereClause: any = { schoolMatricule: matricule };
        if (levelParam) {
            whereClause.level = levelParam.toUpperCase();
        }

        // Fetch school for calendar data and active year
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true }
        });
        const calendar = school?.calendar ? JSON.parse(school.calendar) : null;
        const calendarPeriods = calendar && levelParam
            ? (calendar?.[levelParam.toLowerCase()]?.periods || [])
            : [];

        // Resolve active schoolYear from calendar
        let activeSchoolYear: string | null = null;
        if (calendar) {
            if (calendar.schoolYear) activeSchoolYear = calendar.schoolYear;
            else if (levelParam && calendar[levelParam.toLowerCase()]?.schoolYear) {
                activeSchoolYear = calendar[levelParam.toLowerCase()].schoolYear;
            }
        }

        // Filter by schoolYear if available: only load periods for the active year
        // (legacy periods without schoolYear are still included for backward compat)
        if (activeSchoolYear) {
            whereClause.OR = [
                { schoolYear: activeSchoolYear },
                { schoolYear: null }
            ];
        }

        // Build lookup map: calendar period name → isActive
        const calendarLookup = new Map<string, boolean>();
        const calendarNameSet = new Set<string>();
        for (const cp of calendarPeriods) {
            if (cp.name) {
                calendarLookup.set(cp.name, !!cp.isActive);
                calendarNameSet.add(cp.name);
            }
        }

        // 1. Fetch existing periods from database
        let periods = await db.period.findMany({
            where: whereClause
        });

        // 2. If no periods exist in DB for this level+year, auto-populate from school data
        if (periods.length === 0 && levelParam && calendarPeriods.length > 0) {
            const created = await Promise.all(calendarPeriods.map((p: any) => 
                db.period.create({
                    data: {
                        name: p.name,
                        type: p.type === 'exam' ? 'EXAM' : 'PERIOD',
                        term: p.term || 'TRIM1',
                        level: levelParam.toUpperCase(),
                        weight: p.weight || 1.0,
                        startDate: p.startDate ? new Date(p.startDate) : null,
                        endDate: p.endDate ? new Date(p.endDate) : null,
                        schoolMatricule: matricule,
                        schoolYear: activeSchoolYear || undefined,
                    }
                })
            ));
            periods = created;
        }

        // 3. Enrich each period with isActive from calendar
        const enriched = periods.map(p => {
            let isActive = false;
            // Match by name first
            if (p.name && calendarLookup.has(p.name)) {
                isActive = calendarLookup.get(p.name) === true;
            } else if (p.name) {
                // Fuzzy fallback: try normalized matching
                const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const pNorm = norm(p.name);
                
                const getShortName = (name: string) => {
                    if (!name) return "";
                    return name
                        .replace(/Trimestre\s?(\d)/i, 'T$1')
                        .replace(/Semestre\s?(\d)/i, 'S$1')
                        .replace(/Période\s?(\d)/i, 'P$1')
                        .replace(/Examens?/i, 'EX')
                        .replace(/\s?-\s?/g, '-')
                        .trim();
                };
                const pShort = getShortName(p.name);
                const pShortNorm = norm(pShort);

                for (const cp of calendarPeriods) {
                    if (cp.name && (norm(cp.name) === pNorm || norm(cp.name) === pShortNorm || cp.name === pShort)) {
                        isActive = !!cp.isActive;
                        break;
                    }
                }
            }
            return { ...p, isActive };
        });

        // 4. Check if there are any students with repêchage courses configured for secondary level
        if (levelParam?.toUpperCase() === "SECONDAIRE") {
            const repechageStudents = await db.student.findMany({
                where: {
                    schoolMatricule: matricule,
                    status: "active"
                },
                select: {
                    data: true
                }
            });

            const hasRepechage = repechageStudents.some((s: any) => {
                try {
                    const data = JSON.parse(s.data || "{}");
                    return Array.isArray(data.repechageCourses) && data.repechageCourses.length > 0;
                } catch {
                    return false;
                }
            });

            if (hasRepechage) {
                enriched.push({
                    id: "REP",
                    name: "Repêchage",
                    type: "PERIOD",
                    term: "REP",
                    level: "SECONDAIRE",
                    weight: 1.0,
                    isActive: false,
                    startDate: new Date(),
                    endDate: new Date(),
                    schoolMatricule: matricule,
                    createdAt: new Date(),
                    updatedAt: new Date()
                } as any);
            }
        }

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("API /api/school/periods error:", error);
        return NextResponse.json(
            { error: "Erreur lors du chargement des périodes." },
            { status: 500 }
        );
    }
}
