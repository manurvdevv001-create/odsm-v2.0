// src/app/api/admin/period-monitoring/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normStr = (s: string) => {
    if (!s) return "";
    let n = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    n = n.replace(/1ere/g, "1e").replace(/1er/g, "1e");
    n = n.replace(/([2-9])eme/g, "$1e");
    n = n.replace(/education de base/g, "cteb");
    return n;
};
const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();

/**
 * GET: List all course statuses for a classroom/period
 * Returns: { courses: [{ courseName, status, submittedAt?, teacher? }], periodClosure }
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get("classroomId");
    const periodId = searchParams.get("periodId");

    if (!classroomId) {
        return NextResponse.json({ error: "classroomId requis" }, { status: 400 });
    }

    try {
        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule }, select: { calendar: true, matricule: true } }) : await db.school.findFirst({ select: { calendar: true, matricule: true } });
        
        // Resolve classroom
        let resolvedClassroomIds: string[] = [];
        if (uuidRegex.test(classroomId)) resolvedClassroomIds.push(classroomId);
        const allClassrooms = school?.matricule ? await db.classroom.findMany({ where: { schoolMatricule: school.matricule } }) : await db.classroom.findMany();
        const targetNorm = normStr(classroomId);
        const matchedByName = allClassrooms.filter((c: any) => {
            const cNorm = normStr(c.name);
            return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
        }).map((c: any) => c.id);
        resolvedClassroomIds = Array.from(new Set([...resolvedClassroomIds, ...matchedByName]));
        if (resolvedClassroomIds.length === 0) {
            resolvedClassroomIds.push(classroomId);
        }

        // Resolve period
        let resolvedPeriodIds: string[] = [];
        if (periodId) {
            if (uuidRegex.test(periodId)) resolvedPeriodIds.push(periodId);
            const allPeriods = school?.matricule ? await db.period.findMany({ where: { schoolMatricule: school.matricule } }) : await db.period.findMany();
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
                                    console.log(`[Period Monitoring] Type+position matched calendar "${calMatch.name}" (${calType}[${posInType}]) → DB period "${typePeriods[posInType].name}"`);
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
            if (resolvedPeriodIds.length === 0) {
                resolvedPeriodIds.push(periodId);
            }
        }

        // Fetch submissions
        const where: any = {
            classroomId: { in: resolvedClassroomIds }
        };
        if (resolvedPeriodIds.length > 0) {
            where.periodId = { in: resolvedPeriodIds };
        }

        const submissions = await (db as any).gradeSubmission.findMany({
            where,
            include: {
                course: { select: { name: true } },
                period: { select: { name: true } }
            }
        });

        // Check period closure
        const closureWhere: any = {
            classroomId: { in: resolvedClassroomIds }
        };
        if (resolvedPeriodIds.length > 0) {
            closureWhere.periodId = { in: resolvedPeriodIds };
        }
        const periodClosure = await (db as any).periodClosure.findFirst({ where: closureWhere });

        return NextResponse.json({
            submissions: submissions.map((s: any) => ({
                id: s.id,
                courseId: s.courseId,
                courseName: s.course?.name || "Inconnu",
                periodId: s.periodId,
                periodName: s.period?.name || "Inconnu",
                classroomId: s.classroomId,
                teacherId: s.teacherId,
                status: s.status,
                submittedAt: s.submittedAt,
                revisionRequestedAt: s.revisionRequestedAt,
                revisionRequestedBy: s.revisionRequestedBy,
            })),
            periodClosure: periodClosure ? {
                id: periodClosure.id,
                closedAt: periodClosure.closedAt,
                closedByUserId: periodClosure.closedByUserId
            } : null
        });
    } catch (error: any) {
        console.error("[Admin Period Monitoring GET] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH: Mark one or more courses as REVISION_REQUESTED
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { submissionIds, requestedBy } = body;

        if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
            return NextResponse.json({ error: "submissionIds requis (array)" }, { status: 400 });
        }

        const updated = await Promise.all(
            submissionIds.map(async (id: string) => {
                return await (db as any).gradeSubmission.update({
                    where: { id },
                    data: {
                        status: "REVISION_REQUESTED",
                        revisionRequestedAt: new Date(),
                        revisionRequestedBy: requestedBy || null
                    }
                });
            })
        );

        console.log("[Admin Period Monitoring] Revision requested for:", submissionIds);
        return NextResponse.json({ success: true, updated: updated.length });
    } catch (error: any) {
        console.error("[Admin Period Monitoring PATCH] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
