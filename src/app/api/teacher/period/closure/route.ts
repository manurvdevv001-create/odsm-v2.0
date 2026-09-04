// src/app/api/teacher/period/closure/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";


const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();

/**
 * POST: Create a PeriodClosure (titulaire closes the entire period for their classroom)
 * Requires ALL courses to have GradeSubmission before allowing closure.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { periodId, classroomId, closedByUserId, schoolMatricule: rawSchoolMatricule, matricule: rawMatricule, totalExpectedCourses } = body;
        const schoolMatricule = rawSchoolMatricule || rawMatricule;
        console.log("[PeriodClosure] POST Input:", { periodId, classroomId, closedByUserId, schoolMatricule, totalExpectedCourses });

        if (!periodId || !classroomId) {
            return NextResponse.json({ error: "periodId et classroomId requis" }, { status: 400 });
        }

        // Resolve School
        let activeMatricule = schoolMatricule || undefined;
        if (!activeMatricule) {
            // We should not blindly fallback to findFirst() for multi-tenant isolation
            // But to avoid breaking existing clients completely, we fallback but log a warning.
            console.warn("[PeriodClosure] WARNING: schoolMatricule is missing in POST request");
            const school = await db.school.findFirst();
            activeMatricule = school?.matricule || undefined;
        }

        // Resolve Classroom ID
        let resolvedClassroomId: string | null = null;
        if (uuidRegex.test(classroomId)) {
            const exact = await db.classroom.findUnique({ where: { id: classroomId } });
            if (exact) resolvedClassroomId = exact.id;
        }
        if (!resolvedClassroomId) {
            const allClassrooms = await db.classroom.findMany({
                where: activeMatricule ? { schoolMatricule: activeMatricule } : undefined
            });
            const targetNorm = normStr(classroomId);
            const match = allClassrooms.find((c: any) => normStr(c.name) === targetNorm);
            if (match) resolvedClassroomId = match.id;
        }
        if (!resolvedClassroomId) {
            return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
        }

        // Resolve Period ID
        let resolvedPeriodId: string | null = null;
        if (uuidRegex.test(periodId)) {
            const exact = await db.period.findUnique({ where: { id: periodId } });
            if (exact) resolvedPeriodId = exact.id;
        }
        if (!resolvedPeriodId) {
            const allPeriods = await db.period.findMany({
                where: activeMatricule ? { schoolMatricule: activeMatricule } : undefined
            });
            const targetNorm = normStr(periodId);
            const targetPunct = normPunct(periodId);
            const match = allPeriods.find((p: any) => {
                const pNorm = normStr(p.name);
                const pPunct = normPunct(p.name);
                if (pNorm === targetNorm) return true;
                if (pPunct === targetPunct) return true;
                // Safe substring matching (only if the substring is substantial)
                if (targetNorm.length > 4 && pNorm.includes(targetNorm)) return true;
                if (targetPunct.length > 4 && pPunct.includes(targetPunct)) return true;
                if (pNorm.length > 4 && targetNorm.includes(pNorm)) return true;
                return false;
            });
            if (match) resolvedPeriodId = match.id;

            // Calendar fallback
            if (!resolvedPeriodId) {
                const school = activeMatricule
                    ? await db.school.findFirst({ where: { matricule: activeMatricule }, select: { calendar: true } })
                    : await db.school.findFirst({ select: { calendar: true } });
                if (school?.calendar) {
                    const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
                    for (const level of ['primaire', 'secondaire', 'maternelle']) {
                        const calPeriods = calendar?.[level]?.periods || [];
                        const calMatchIdx = calPeriods.findIndex((p: any) => p.id === periodId || normPunct(p.id || "") === targetPunct);
                        if (calMatchIdx !== -1) {
                            const calMatch = calPeriods[calMatchIdx];
                            const calNameNorm = normStr(calMatch.name);
                            let dbMatch = allPeriods.find((p: any) => normStr(p.name) === calNameNorm);
                            // If name-based matching fails, try matching by type+position within the level
                            if (!dbMatch) {
                                const levelPeriods = allPeriods
                                    .filter((p: any) => normStr(p.level) === normStr(level))
                                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                                const calType = calMatch.type === 'exam' ? 'EXAM' : 'PERIOD';
                                const typePeriods = levelPeriods.filter((p: any) => p.type === calType);
                                const typeCalPeriods = calPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                                const posInType = typeCalPeriods.findIndex((p: any) => p.id === calMatch.id);
                                if (posInType !== -1 && typePeriods[posInType]) {
                                    dbMatch = typePeriods[posInType];
                                    console.log(`[PeriodClosure] Type+position matched calendar "${calMatch.name}" (${calType}[${posInType}]) → DB period "${typePeriods[posInType].name}"`);
                                }
                            }
                            if (dbMatch) resolvedPeriodId = dbMatch.id;
                            break;
                        }
                    }
                }
            }
        }
        if (!resolvedPeriodId) {
            return NextResponse.json({ error: "Période introuvable" }, { status: 404 });
        }

        console.log("[PeriodClosure] Resolved:", { resolvedClassroomId, resolvedPeriodId });

        // Check if already closed
        const existing = await (db as any).periodClosure.findFirst({
            where: {
                periodId: resolvedPeriodId,
                classroomId: resolvedClassroomId
            }
        });
        if (existing) {
            return NextResponse.json({ error: "Cette période est déjà clôturée pour ce local." }, { status: 400 });
        }

        // Check that ALL courses have GradeSubmissions (100% requirement)
        const submissions = await (db as any).gradeSubmission.findMany({
            where: {
                classroomId: resolvedClassroomId,
                periodId: resolvedPeriodId
            }
        });
        const submittedCount = submissions.length;
        const expectedCourses = totalExpectedCourses || 0;

        if (expectedCourses > 0 && submittedCount < expectedCourses) {
            return NextResponse.json({
                error: `Impossible de clôturer : ${submittedCount}/${expectedCourses} cours soumis. Tous les cahiers de cotes doivent être clôturés avant de fermer la période.`,
                submittedCount,
                expectedCourses
            }, { status: 400 });
        }

        // Create the PeriodClosure
        const closure = await (db as any).periodClosure.create({
            data: {
                periodId: resolvedPeriodId,
                classroomId: resolvedClassroomId,
                schoolMatricule: activeMatricule,
                closedByUserId: closedByUserId || null,
                closedAt: new Date()
            }
        });

        console.log("[PeriodClosure] SUCCESS:", closure.id);

        // LOG ACTIVITY
        try {
            const { logActivity, formatLogEntity } = await import("@/lib/activity-logger");
            const [classroom, period, staff] = await Promise.all([
                db.classroom.findUnique({ where: { id: resolvedClassroomId! }, select: { name: true } }),
                db.period.findUnique({ where: { id: resolvedPeriodId! }, select: { name: true } }),
                closedByUserId ? db.staffProfile.findFirst({ where: { userId: closedByUserId } }) : null
            ]);

            const classInfo = formatLogEntity(classroom?.name || "Classe inconnue", resolvedClassroomId!);
            const periodInfo = formatLogEntity(period?.name || "Période inconnue", resolvedPeriodId!);
            const staffInfo = staff ? formatLogEntity(`${staff.firstName} ${staff.lastName}`, staff.staffNumber) : "Titulaire";

            await logActivity(
                activeMatricule!,
                `Clôture de période (${periodInfo}) pour la classe ${classInfo} par ${staffInfo}`,
                staffInfo,
                "success",
                undefined,
                { closureId: closure.id, periodId: resolvedPeriodId, classroomId: resolvedClassroomId }
            );
        } catch (e) {}

        return NextResponse.json({ success: true, data: closure });
    } catch (error: any) {
        console.error("[PeriodClosure] Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de la clôture" }, { status: 500 });
    }
}

/**
 * GET: Check if a period is closed for a classroom
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId");
    const classroomId = searchParams.get("classroomId");
    const schoolMatricule = searchParams.get("schoolMatricule") || searchParams.get("matricule");

    if (!classroomId) {
        return NextResponse.json({ error: "classroomId requis" }, { status: 400 });
    }

    try {
        // Resolve classroom
        let resolvedClassroomIds: string[] = [];
        if (uuidRegex.test(classroomId)) {
            resolvedClassroomIds.push(classroomId);
        }
        const allClassrooms = await db.classroom.findMany({
            where: schoolMatricule ? { schoolMatricule } : undefined
        });
        const targetNorm = normStr(classroomId);
        const matchedByName = allClassrooms.filter((c: any) => {
            const cNorm = normStr(c.name);
            return cNorm === targetNorm;
        }).map((c: any) => c.id);
        resolvedClassroomIds = Array.from(new Set([...resolvedClassroomIds, ...matchedByName]));

        // Resolve period
        let resolvedPeriodIds: string[] = [];
        if (periodId) {
            if (uuidRegex.test(periodId)) resolvedPeriodIds.push(periodId);
            const allPeriods = await db.period.findMany({
                where: schoolMatricule ? { schoolMatricule } : undefined
            });
            const pNorm = normStr(periodId);
            const pPunct = normPunct(periodId);
            const matched = allPeriods.filter((p: any) => {
                const n = normStr(p.name);
                const pp = normPunct(p.name);
                if (n === pNorm) return true;
                if (pp === pPunct) return true;
                if (pNorm.length > 4 && n.includes(pNorm)) return true;
                if (pPunct.length > 4 && pp.includes(pPunct)) return true;
                if (n.length > 4 && pNorm.includes(n)) return true;
                return false;
            }).map((p: any) => p.id);
            resolvedPeriodIds = Array.from(new Set([...resolvedPeriodIds, ...matched]));

            if (resolvedPeriodIds.length === 0 || (resolvedPeriodIds.length === 1 && resolvedPeriodIds[0] === periodId)) {
                const school = await db.school.findFirst({ select: { calendar: true } });
                if (school?.calendar) {
                    const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
                    for (const level of ['primaire', 'secondaire', 'maternelle']) {
                        const calPeriods = calendar?.[level]?.periods || [];
                        const calMatchIdx = calPeriods.findIndex((p: any) => p.id === periodId || normPunct(p.id || "") === pPunct);
                        if (calMatchIdx !== -1) {
                            const calMatch = calPeriods[calMatchIdx];
                            const calNameNorm = normStr(calMatch.name);
                            let dbMatch = allPeriods.find((p: any) => normStr(p.name) === calNameNorm);
                            // If name-based matching fails, try matching by type+position within the level
                            if (!dbMatch) {
                                const levelPeriods = allPeriods
                                    .filter((p: any) => normStr(p.level) === normStr(level))
                                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                                const calType = calMatch.type === 'exam' ? 'EXAM' : 'PERIOD';
                                const typePeriods = levelPeriods.filter((p: any) => p.type === calType);
                                const typeCalPeriods = calPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                                const posInType = typeCalPeriods.findIndex((p: any) => p.id === calMatch.id);
                                if (posInType !== -1 && typePeriods[posInType]) {
                                    dbMatch = typePeriods[posInType];
                                    console.log(`[PeriodClosure GET] Type+position matched calendar "${calMatch.name}" (${calType}[${posInType}]) → DB period "${typePeriods[posInType].name}"`);
                                }
                            }
                            if (dbMatch) {
                                resolvedPeriodIds.push(dbMatch.id);
                            }
                            break;
                        }
                    }
                }
            }
        }

        const where: any = {
            classroomId: { in: resolvedClassroomIds }
        };
        if (resolvedPeriodIds.length > 0) {
            where.periodId = { in: resolvedPeriodIds };
        }

        const closures = await (db as any).periodClosure.findMany({ where, include: { period: true } });

        return NextResponse.json({
            isClosed: closures.length > 0,
            closures
        });
    } catch (error: any) {
        console.error("[PeriodClosure GET] Error:", error);
        return NextResponse.json({ isClosed: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/teacher/period/closure?id=<closureId>
 * Allows an administrator to unlock (delete) a PeriodClosure record.
 */
export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const closureId = searchParams.get("id");

    if (!closureId) {
        return NextResponse.json({ error: "L'identifiant de la clôture (id) est requis." }, { status: 400 });
    }

    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
        }
        // Only admins and directors can unlock a period closure
        const allowedRoles = ["admin", "directeur", "director", "superadmin"];
        const userRole = session.role?.toLowerCase() || "";
        if (!allowedRoles.some(r => userRole.includes(r))) {
            return NextResponse.json({ error: "Accès refusé. Seul un administrateur peut débloquer une période." }, { status: 403 });
        }

        const existing = await db.periodClosure.findUnique({ where: { id: closureId } });
        if (!existing) {
            return NextResponse.json({ error: "Clôture introuvable." }, { status: 404 });
        }

        await db.periodClosure.delete({ where: { id: closureId } });

        console.log(`[PeriodClosure DELETE] Admin ${session.userId} unlocked closure ${closureId}`);
        return NextResponse.json({ success: true, message: "Période débloquée avec succès." });
    } catch (error: any) {
        console.error("[PeriodClosure DELETE] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
