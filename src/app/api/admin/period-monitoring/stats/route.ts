import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function normStr(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function formatStudentName(student: any) {
    const nom = student.lastName ? student.lastName.toUpperCase() : "";
    const postnom = student.middleName ? student.middleName.toUpperCase() : "";
    const prenom = student.firstName
        ? student.firstName.charAt(0).toUpperCase() + student.firstName.slice(1).toLowerCase()
        : "";
    return `${nom} ${postnom} ${prenom}`.replace(/\s+/g, " ").trim();
}

async function resolveClassroom(school: any, classroomId: string | null) {
    if (!classroomId) return { resolvedId: null, classroom: null };
    const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
    const targetNorm = normStr(classroomId);
    const matched = allClassrooms.find(
        (c) => c.id === classroomId || normStr(c.name) === targetNorm
    );
    return { resolvedId: matched?.id || classroomId, classroom: matched || null };
}

async function resolvePeriod(school: any, periodId: string | null) {
    if (!periodId) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(periodId)) return periodId;
    const allPeriods = await db.period.findMany({ where: { schoolMatricule: school.matricule } });
    const pNorm = normStr(periodId);
    let found = allPeriods.find((p) => p.id === periodId || normStr(p.name) === pNorm);
    if (!found) {
        const calendar = typeof school.calendar === "string" ? JSON.parse(school.calendar) : school.calendar;
        for (const level of ["primaire", "secondaire", "maternelle"]) {
            const calPeriods = calendar?.[level]?.periods || [];
            const calMatch = calPeriods.find((p: any) => p.id === periodId);
            if (calMatch) {
                const calNameNorm = normStr(calMatch.name);
                found = allPeriods.find((p) => normStr(p.name) === calNameNorm);
                break;
            }
        }
    }
    return found?.id || periodId;
}

function getPeriodRank(name: string): number {
    const n = name.toUpperCase();
    if (n.includes("T1-P1")) return 11;
    if (n.includes("T1-P2")) return 12;
    if (n.includes("T1-EX")) return 13;
    if (n.includes("T2-P3")) return 21;
    if (n.includes("T2-P4")) return 22;
    if (n.includes("T2-EX")) return 23;
    if (n.includes("T3-P5")) return 31;
    if (n.includes("T3-P6")) return 32;
    if (n.includes("T3-EX")) return 33;

    if (n.includes("S1-P1")) return 11;
    if (n.includes("S1-P2")) return 12;
    if (n.includes("S1-EX")) return 13;
    if (n.includes("S2-P3")) return 21;
    if (n.includes("S2-P4")) return 22;
    if (n.includes("S2-EX")) return 23;

    if (n === "T1" || n.includes("TRIMESTRE 1")) return 1;
    if (n === "T2" || n.includes("TRIMESTRE 2")) return 2;
    if (n === "T3" || n.includes("TRIMESTRE 3")) return 3;

    return 999;
}

function getCourseConfig(school: any, classroom: any) {
    const coursesObj = typeof school.courses === "string" ? JSON.parse(school.courses) : school.courses || {};
    const gradeTarget = normStr(classroom?.grade || classroom?.name || "");
    const gradeKey = Object.keys(coursesObj).find((k) => {
        const kNorm = normStr(k);
        return kNorm === gradeTarget || gradeTarget.includes(kNorm) || kNorm.includes(gradeTarget.split(" ")[0]);
    });
    const courses: any[] = gradeKey ? coursesObj[gradeKey] : [];
    const isMaternelle =
        normStr(classroom?.name || "").includes("maternel") ||
        classroom?.level?.toLowerCase() === "maternelle";
    return { courses, isMaternelle };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");
    const classroomId = searchParams.get("classroomId");
    const periodId = searchParams.get("periodId");
    const mode = searchParams.get("mode"); // "course" | "general" | "cumulative"

    if (mode === "course" && !submissionId)
        return NextResponse.json({ error: "submissionId requis pour le mode course" }, { status: 400 });
    if (mode === "general" && (!classroomId || !periodId))
        return NextResponse.json({ error: "classroomId et periodId requis pour le mode general" }, { status: 400 });
    if (mode === "cumulative" && !classroomId)
        return NextResponse.json({ error: "classroomId requis pour le mode cumulative" }, { status: 400 });

    try {
        const session = await getSession();
        const school = session
            ? await db.school.findUnique({ where: { matricule: session.matricule } })
            : await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "Aucune école" }, { status: 404 });

        const calendar = typeof school.calendar === "string" ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear || "2024-2025";

        // ─── CUMULATIVE MODE ─────────────────────────────────────────────────────
        if (mode === "cumulative") {
            const { resolvedId: resolvedClassroomId, classroom } = await resolveClassroom(school, classroomId);
            if (!resolvedClassroomId || !classroom) {
                return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
            }

            // All periods for this school and this level
            const allPeriods = await db.period.findMany({
                where: { 
                    schoolMatricule: school.matricule,
                    level: classroom.level 
                },
                orderBy: { startDate: "asc" }
            });

            // All students for this classroom
            const students = await db.student.findMany({
                where: {
                    schoolMatricule: school.matricule,
                    classroomName: classroom.name,
                    schoolYear: activeYear,
                    status: { in: ["active", "pending_payment"] },
                },
            });

            // Course config (to get base maxes)
            const { courses: gradeCourses, isMaternelle } = getCourseConfig(school, classroom);

            // All closed course submissions for this classroom
            const allSubmissions = await (db as any).gradeSubmission.findMany({
                where: {
                    classroomId: resolvedClassroomId,
                    status: { in: ["SUBMITTED", "VALIDATED"] },
                    courseId: { not: "PERIOD_CLOSURE" },
                },
                include: { course: true, period: true },
            });

            // All assessments for this classroom + all periods
            const periodIds = allPeriods.map((p) => p.id);
            const allAssessments = await db.assessment.findMany({
                where: {
                    classroomId: resolvedClassroomId,
                    periodId: { in: periodIds },
                },
                include: { results: true },
            });

            // Build per-period data
            const periodData: Record<string, { periodName: string; studentScores: Record<string, { earned: number; max: number }> }> = {};

            // Sort periods by our nomenclature rules
            allPeriods.sort((a, b) => getPeriodRank(a.name) - getPeriodRank(b.name));

            for (const period of allPeriods) {
                const isExam = /exam|-ex\b|\bex\b/i.test(normStr(period.name));
                const studentScores: Record<string, { earned: number; max: number }> = {};

                // Submissions closed for this period
                const periodSubs = allSubmissions.filter((s: any) => s.periodId === period.id);
                const closedCourseIds = new Set(periodSubs.map((s: any) => s.courseId));

                for (const student of students) {
                    let earned = 0;
                    let max = 0;

                    for (const courseConfig of gradeCourses) {
                        const configMax = courseConfig.maxPoints || courseConfig.max || (isMaternelle ? 4 : 20);
                        const periodMax = isExam && !isMaternelle ? configMax * 2 : configMax;
                        max += periodMax;

                        // Find matching submission by course name
                        const courseNameNorm = normStr(courseConfig.name || "");
                        const sub = periodSubs.find((s: any) => normStr(s.course?.name || "") === courseNameNorm);

                        if (sub && closedCourseIds.has(sub.courseId)) {
                            // Compute student score from assessments
                            const courseAssts = allAssessments.filter(
                                (a: any) => a.courseId === sub.courseId && a.periodId === period.id
                            );

                            let courseEarned = 0;
                            let coursePossible = 0;

                            for (const ass of courseAssts) {
                                const res = (ass.results as any[]).find((r: any) => r.studentId === student.id);
                                if (res && !res.isAbsent && !res.isExempt) {
                                    const pondere = Number(ass.pondere || ass.maxScore || 1);
                                    courseEarned += (Number(res.publishedScore || res.score || 0) / Number(ass.maxScore || 1)) * pondere;
                                    coursePossible += pondere;
                                }
                            }

                            if (coursePossible > 0) {
                                earned += (courseEarned / coursePossible) * periodMax;
                            }
                            // else earned += 0 (course closed but no assessments found → 0)
                        }
                        // else earned += 0 (course not closed for this period → 0)
                    }

                    studentScores[student.id] = { earned: Number(earned.toFixed(2)), max };
                }

                periodData[period.id] = {
                    periodName: period.name,
                    studentScores,
                };
            }

            return NextResponse.json({
                mode: "cumulative",
                title: "Stats Générales Cumulées",
                periods: allPeriods.map((p) => ({ id: p.id, name: p.name })),
                students: students.map((s) => ({ id: s.id, name: formatStudentName(s) })),
                periodData,
            });
        }

        // ─── COURSE / GENERAL MODES ───────────────────────────────────────────────
        let targetSubmissions: any[] = [];

        if (mode === "course") {
            const sub = await (db as any).gradeSubmission.findUnique({
                where: { id: submissionId },
                include: { course: true, period: true, classroom: true },
            });
            if (!sub) return NextResponse.json({ error: "Soumission introuvable" }, { status: 404 });
            targetSubmissions.push(sub);
        } else {
            const { resolvedId: resolvedClassroomId } = await resolveClassroom(school, classroomId);
            const resolvedPeriodId = await resolvePeriod(school, periodId);
            targetSubmissions = await (db as any).gradeSubmission.findMany({
                where: {
                    classroomId: resolvedClassroomId,
                    periodId: resolvedPeriodId,
                    status: { in: ["SUBMITTED", "VALIDATED"] },
                    courseId: { not: "PERIOD_CLOSURE" },
                },
                include: { course: true, period: true, classroom: true },
            });
        }

        if (targetSubmissions.length === 0) {
            return NextResponse.json({
                students: [],
                stats: { total: 0, passes: 0, fails: 0, passRate: 0, failRate: 0 },
                title: mode === "course" ? "Cours" : "Statistiques Générales",
                periodName: "",
            });
        }

        const activeClassroomId = targetSubmissions[0].classroomId;
        const title = mode === "course" ? targetSubmissions[0].course?.name || "Cours" : "Statistiques Générales";
        const periodName = targetSubmissions[0].period?.name || "Période";

        const courseIds = Array.from(new Set(targetSubmissions.map((s: any) => s.courseId)));
        const targetPeriodIds = Array.from(new Set(targetSubmissions.map((s: any) => s.periodId)));

        const matchedClassroom = await db.classroom.findUnique({ where: { id: activeClassroomId } });
        const { courses: gradeCourses, isMaternelle } = getCourseConfig(school, matchedClassroom);

        const courseConfigMap: Record<string, { max: number }> = {};
        for (const sub of targetSubmissions) {
            const courseNameNorm = normStr(sub.course?.name || "");
            const config = Array.isArray(gradeCourses)
                ? gradeCourses.find((c: any) => normStr(c.name || "") === courseNameNorm)
                : null;
            courseConfigMap[sub.courseId] = {
                max: config?.maxPoints || config?.max || (isMaternelle ? 4 : 20),
            };
        }

        const students = await db.student.findMany({
            where: {
                schoolMatricule: school.matricule,
                classroomName: matchedClassroom?.name || activeClassroomId,
                schoolYear: activeYear,
                status: { in: ["active", "pending_payment"] },
            },
        });

        const assessments = await db.assessment.findMany({
            where: {
                classroomId: activeClassroomId,
                periodId: { in: targetPeriodIds as string[] },
                courseId: { in: courseIds as string[] },
            },
            include: { results: true },
        });

        const studentStats: any[] = [];
        let totalPasses = 0;
        let totalFails = 0;

        for (const student of students) {
            let totalEarned = 0;
            let totalPossible = 0;

            for (const cId of courseIds as string[]) {
                const courseAssts = assessments.filter((a) => a.courseId === cId);
                for (const pId of targetPeriodIds as string[]) {
                    const periodAssts = courseAssts.filter((a) => a.periodId === pId);
                    if (periodAssts.length === 0) continue;

                    let courseEarned = 0;
                    let coursePossible = 0;
                    for (const ass of periodAssts) {
                        const res = (ass.results as any[]).find((r: any) => r.studentId === student.id);
                        if (res && !res.isAbsent && !res.isExempt) {
                            const pondere = Number(ass.pondere || ass.maxScore || 1);
                            courseEarned += (Number(res.publishedScore || res.score || 0) / Number(ass.maxScore || 1)) * pondere;
                            coursePossible += pondere;
                        }
                    }

                    if (coursePossible > 0) {
                        const subForPeriod = targetSubmissions.find((s: any) => s.periodId === pId);
                        const isExam = /exam|-ex\b|\bex\b/i.test(normStr(subForPeriod?.period?.name || ""));
                        const baseMax = courseConfigMap[cId]?.max || 20;
                        const periodMax = isExam && !isMaternelle ? baseMax * 2 : baseMax;
                        totalEarned += (courseEarned / coursePossible) * periodMax;
                        totalPossible += periodMax;
                    }
                }
            }

            if (totalPossible > 0) {
                const percentage = (totalEarned / totalPossible) * 100;
                const passed = percentage >= 50;
                studentStats.push({
                    id: student.id,
                    name: formatStudentName(student),
                    score: Number(totalEarned.toFixed(1)),
                    max: totalPossible,
                    percentage: Number(percentage.toFixed(1)),
                    passed,
                });
                if (passed) totalPasses++;
                else totalFails++;
            }
        }

        const total = studentStats.length;
        const passRate = total > 0 ? (totalPasses / total) * 100 : 0;
        const failRate = total > 0 ? ((total - totalPasses) / total) * 100 : 0;

        return NextResponse.json({
            title,
            periodName,
            stats: {
                total,
                passes: totalPasses,
                fails: total - totalPasses,
                passRate: Number(passRate.toFixed(1)),
                failRate: Number(failRate.toFixed(1)),
            },
            students: studentStats,
        });
    } catch (error: any) {
        console.error("[Stats API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
