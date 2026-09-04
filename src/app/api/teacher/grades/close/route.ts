// src/app/api/teacher/grades/close/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { periodId, courseId, classroomId, data, teacherId, schoolMatricule } = body;
        console.log("[Grade Closure] Input:", { periodId, courseId, classroomId, teacherId, schoolMatricule });

        if (!periodId || !courseId || !classroomId || !data) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        // ============================================================
        // STRATEGY: Use the EXACT SAME resolution as the GET route
        // in src/app/api/teacher/grades/route.ts, then extract the
        // real DB UUIDs from the found assessments. This guarantees
        // the GradeSubmission uses IDs identical to what GET resolves.
        // ============================================================

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        // 1. Resolve School
        let activeMatricule = schoolMatricule || undefined;
        if (!activeMatricule) {
            return NextResponse.json({ error: "Matricule de l'établissement requis." }, { status: 400 });
        }

        // 2. Resolve Classroom (Case and Accent Insensitive)
        let solvedClassroomIds: string[] = [];
        
        // Try exact ID first
        const exactClassroom = await db.classroom.findUnique({ where: { id: classroomId } });
        if (exactClassroom) {
            solvedClassroomIds.push(exactClassroom.id);
        } else {
            // Fetch all and match in JS to avoid SQLite case/accent sensitivity issues
            const allClassrooms = await db.classroom.findMany({
                where: activeMatricule ? { schoolMatricule: activeMatricule } : undefined
            });
            const targetClassroomNorm = classroomId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const matchedClassrooms = allClassrooms.filter((c: any) => 
                c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === targetClassroomNorm
            );
            solvedClassroomIds = matchedClassrooms.map((c: any) => c.id);
        }

        // 3. Resolve Course (extract name and match in JS)
        let solvedCourseIds: string[] = [];
        const decodedCourseId = typeof courseId === "string" ? decodeURIComponent(courseId) : courseId;
        const courseNameFromId = decodedCourseId.includes('-') ? (decodedCourseId.split('-').pop() || decodedCourseId) : decodedCourseId;
        const normalizedTargetCourse = courseNameFromId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // Let's just do a simpler search for courses to be extremely safe: find all courses and filter in JS
        const allDbCourses = await db.course.findMany();
        let matchedCourses = allDbCourses.filter((c: any) => {
            if (c.id === courseId) return true;
            const normName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            // Match name
            if (!normName.includes(normalizedTargetCourse) && !normalizedTargetCourse.includes(normName)) return false;
            // Match classroom if we know it
            if (classroomId) {
                const normRoom = classroomId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const cRoomNorm = (c.classroomName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                if (cRoomNorm && cRoomNorm !== normRoom) return false;
            }
            return true;
        });

        // Fallback: if no match found with classroom, try matching just by name
        if (matchedCourses.length === 0) {
            matchedCourses = allDbCourses.filter((c: any) => {
                if (c.id === courseId) return true;
                const normName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return normName.includes(normalizedTargetCourse) || normalizedTargetCourse.includes(normName);
            });
        }

        solvedCourseIds = matchedCourses.map((c: any) => c.id);

        // 4. Resolve Period (Case, Accent, and Calendar ID insensitive)
        let solvedPeriodIds: string[] = [];
        const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
        const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();
        const exactPeriod = await db.period.findUnique({ where: { id: periodId } });
        if (exactPeriod) {
            solvedPeriodIds.push(exactPeriod.id);
        } else {
            const allPeriods = await db.period.findMany({
                where: activeMatricule ? { schoolMatricule: activeMatricule } : undefined
            });
            const targetPeriodNorm = periodId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const targetPunct = normPunct(periodId);
            const matchedPeriods = allPeriods.filter((p: any) => {
                const pNorm = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                const pPunct = normPunct(p.name);
                if (pNorm === targetPeriodNorm) return true;
                if (pPunct === targetPunct) return true;
                if (targetPeriodNorm.length > 4 && pNorm.includes(targetPeriodNorm)) return true;
                if (targetPunct.length > 4 && pPunct.includes(targetPunct)) return true;
                return false;
            });
            solvedPeriodIds = matchedPeriods.map((p: any) => p.id);

            // Fallback: resolve calendar JSON IDs
            if (solvedPeriodIds.length === 0) {
                const school = await db.school.findFirst({ where: { matricule: activeMatricule }, select: { calendar: true } });
                if (school?.calendar) {
                    const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
                    for (const level of ['primaire', 'secondaire', 'maternelle']) {
                        const calPeriods = calendar?.[level]?.periods || [];
                        const calMatchIdx = calPeriods.findIndex((p: any) => p.id === periodId || normPunct(p.id || "") === targetPunct);
                        if (calMatchIdx !== -1) {
                            const calMatch = calPeriods[calMatchIdx];
                            const calNameNorm = calMatch.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                            let dbMatches = allPeriods.filter((p: any) => 
                                p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === calNameNorm
                            ).map((p: any) => p.id);
                            // If name-based matching fails, try matching by type+position within the level
                            if (dbMatches.length === 0) {
                                const levelPeriods = allPeriods
                                    .filter((p: any) => normStr(p.level) === normStr(level))
                                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                                const calType = calMatch.type === 'exam' ? 'EXAM' : 'PERIOD';
                                const typePeriods = levelPeriods.filter((p: any) => p.type === calType);
                                const typeCalPeriods = calPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                                const posInType = typeCalPeriods.findIndex((p: any) => p.id === calMatch.id);
                                if (posInType !== -1 && typePeriods[posInType]) {
                                    dbMatches = [typePeriods[posInType].id];
                                    console.log(`[Period Resolution] Type+position matched calendar "${calMatch.name}" (${calType}[${posInType}]) → DB period "${typePeriods[posInType].name}"`);
                                }
                            }
                            solvedPeriodIds = dbMatches;
                            break;
                        }
                    }
                }
            }
        }

        console.log("[Grade Closure] Resolved:", { solvedClassroomIds, solvedCourseIds, solvedPeriodIds });

        // 5. Find assessments (same as GET) to extract the REAL IDs
        let finalCourseId = solvedCourseIds[0];
        let finalClassroomId = solvedClassroomIds[0];
        let finalPeriodId = solvedPeriodIds[0];

        if (solvedCourseIds.length > 0 && solvedClassroomIds.length > 0) {
            const sampleAssessment = await (db.assessment as any).findFirst({
                where: {
                    classroomId: { in: solvedClassroomIds },
                    courseId: { in: solvedCourseIds },
                    ...(solvedPeriodIds.length > 0 ? { periodId: { in: solvedPeriodIds } } : {})
                }
            });
            if (sampleAssessment) {
                finalCourseId = sampleAssessment.courseId;
                finalClassroomId = sampleAssessment.classroomId;
                if (sampleAssessment.periodId) finalPeriodId = sampleAssessment.periodId;
                console.log("[Grade Closure] IDs from assessment:", { finalCourseId, finalClassroomId, finalPeriodId });
            }
        }

        // Validate
        if (!finalCourseId || !finalClassroomId || !finalPeriodId ||
            !uuidRegex.test(finalCourseId) || !uuidRegex.test(finalClassroomId) || !uuidRegex.test(finalPeriodId)) {
            return NextResponse.json({
                error: "Impossible de résoudre les identifiants. Assurez-vous qu'au moins une épreuve existe pour ce cours.",
                details: { finalCourseId, finalClassroomId, finalPeriodId }
            }, { status: 400 });
        }

        // 6. Check if already closed
        const existing = await (db as any).gradeSubmission.findFirst({
            where: {
                courseId: finalCourseId,
                classroomId: finalClassroomId,
                periodId: finalPeriodId
            }
        });

        if (existing) {
            return NextResponse.json({ error: "Cette période est déjà clôturée pour ce cours." }, { status: 400 });
        }

        // 7. Create the submission with the EXACT same IDs
        const submission = await (db as any).gradeSubmission.create({
            data: {
                periodId: finalPeriodId,
                courseId: finalCourseId,
                classroomId: finalClassroomId,
                schoolMatricule: activeMatricule,
                teacherId,
                status: "SUBMITTED",
                submittedAt: new Date(),
                data: typeof data === 'string' ? data : JSON.stringify(data)
            }
        });

        console.log("[Grade Closure] SUCCESS - Created submission:", submission.id);

        // LOG ACTIVITY
        try {
            const { logActivity, formatLogEntity } = await import("@/lib/activity-logger");
            const [course, classroom, period, staff] = await Promise.all([
                db.course.findUnique({ where: { id: finalCourseId }, select: { name: true } }),
                db.classroom.findUnique({ where: { id: finalClassroomId }, select: { name: true } }),
                db.period.findUnique({ where: { id: finalPeriodId }, select: { name: true } }),
                teacherId ? db.staffProfile.findFirst({ where: { userId: teacherId } }) : null
            ]);

            const courseInfo = formatLogEntity(course?.name || "Cours inconnu", finalCourseId);
            const classInfo = formatLogEntity(classroom?.name || "Classe inconnue", finalClassroomId);
            const periodInfo = formatLogEntity(period?.name || "Période inconnue", finalPeriodId);
            const staffInfo = staff ? formatLogEntity(`${staff.firstName} ${staff.lastName}`, staff.staffNumber) : "Enseignant";

            await logActivity(
                activeMatricule!,
                `Clôture du cahier de cotes : ${courseInfo} pour la classe ${classInfo} (Période: ${periodInfo}) par ${staffInfo}`,
                staffInfo,
                "success",
                undefined,
                { submissionId: submission.id, periodId: finalPeriodId, courseId: finalCourseId, classroomId: finalClassroomId }
            );
        } catch (logError) {
            console.error("Failed to log grade closure:", logError);
        }

        return NextResponse.json({ success: true, data: submission });
    } catch (error: any) {
        console.error("Grade Submission Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de la clôture" }, { status: 500 });
    }
}


export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get("periodId");
    const courseId = searchParams.get("courseId");
    const classroomId = searchParams.get("classroomId");
    const matricule = searchParams.get("matricule");

    if (!matricule) {
        return NextResponse.json({ error: "Matricule de l'établissement requis." }, { status: 400 });
    }

    try {
        console.log("[GET Submissions] Query:", { classroomId, periodId });
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (classroomId && !courseId) {
            // 1. Resolve Classroom IDs
            let solvedClassroomIds: string[] = [];
            const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
            const targetNorm = normStr(classroomId);

            if (uuidRegex.test(classroomId)) {
                solvedClassroomIds.push(classroomId);
            } 
            
            // Always try name matching too if it looks like a name or if ID search might fail
            const allClassrooms = await db.classroom.findMany({
                where: { schoolMatricule: matricule }
            });
            const matchedByName = allClassrooms.filter((c: any) => {
                const cNorm = normStr(c.name);
                return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
            }).map((c: any) => c.id);
            
            solvedClassroomIds = Array.from(new Set([...solvedClassroomIds, ...matchedByName]));

            // 2. Resolve Period IDs
            let solvedPeriodIds: string[] = [];
            if (periodId) {
                const targetPNote = normStr(periodId);
                const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();
                const targetPunct = normPunct(periodId);

                if (uuidRegex.test(periodId)) {
                    solvedPeriodIds.push(periodId);
                }
                const allPeriods = await db.period.findMany({
                    where: { schoolMatricule: matricule }
                });
                const matchedPeriods = allPeriods.filter((p: any) => {
                    const pNorm = normStr(p.name);
                    const pPunct = normPunct(p.name);
                    if (pNorm === targetPNote) return true;
                    if (pPunct === targetPunct) return true;
                    // Only use includes if strings are sufficiently long to avoid false positives with short names like 'T1'
                    if (targetPNote.length > 4 && pNorm.includes(targetPNote)) return true;
                    if (targetPunct.length > 4 && pPunct.includes(targetPunct)) return true;
                    return false;
                }).map((p: any) => p.id);
                
                solvedPeriodIds = Array.from(new Set([...solvedPeriodIds, ...matchedPeriods]));

                // Fallback: resolve calendar JSON IDs (e.g., "p_t1_p1") via school calendar
                if (solvedPeriodIds.length === 0 && !uuidRegex.test(periodId)) {
                    const school = await db.school.findFirst({ where: { matricule }, select: { calendar: true } });
                    if (school?.calendar) {
                        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
                        for (const level of ['primaire', 'secondaire', 'maternelle']) {
                            const calPeriods = calendar?.[level]?.periods || [];
                            const calMatchIdx = calPeriods.findIndex((p: any) => p.id === periodId || normPunct(p.id || "") === targetPunct);
                            if (calMatchIdx !== -1) {
                                const calMatch = calPeriods[calMatchIdx];
                                const calNameNorm = calMatch.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                                let dbMatches = allPeriods.filter((p: any) => 
                                    p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === calNameNorm
                                ).map((p: any) => p.id);
                                // If name-based matching fails, try matching by type+position within the level
                                if (dbMatches.length === 0) {
                                    const levelPeriods = allPeriods
                                        .filter((p: any) => normStr(p.level) === normStr(level))
                                        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                                    const calType = calMatch.type === 'exam' ? 'EXAM' : 'PERIOD';
                                    const typePeriods = levelPeriods.filter((p: any) => p.type === calType);
                                    const typeCalPeriods = calPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                                    const posInType = typeCalPeriods.findIndex((p: any) => p.id === calMatch.id);
                                    if (posInType !== -1 && typePeriods[posInType]) {
                                        dbMatches = [typePeriods[posInType].id];
                                        console.log(`[Period Resolution] Type+position matched calendar "${calMatch.name}" (${calType}[${posInType}]) → DB period "${typePeriods[posInType].name}"`);
                                    }
                                }
                                solvedPeriodIds = dbMatches;
                                break;
                            }
                    }
                }
            }
            }

            // Bulk fetch for Titulaire
            const submissions = await (db as any).gradeSubmission.findMany({
                where: {
                    schoolMatricule: matricule,
                    classroomId: { in: solvedClassroomIds },
                    ...(solvedPeriodIds.length > 0 ? { periodId: { in: solvedPeriodIds } } : {})
                },
                include: {
                    course: { select: { name: true } },
                    period: { select: { name: true } }
                }
            });
            console.log("[GET Submissions Debug] solvedClassroomIds:", solvedClassroomIds, "solvedPeriodIds:", solvedPeriodIds, "submissions:", submissions.length);
            return NextResponse.json({ submissions });
        }

        if (!periodId || !courseId || !classroomId) {
            return NextResponse.json({ closed: false, error: "Missing parameters" }, { status: 400 });
        }

        const submission = await (db as any).gradeSubmission.findFirst({
            where: {
                schoolMatricule: matricule,
                periodId,
                courseId,
                classroomId
            }
        });

        return NextResponse.json({ closed: !!submission, submission });
    } catch (error: any) {
        console.error("GET Closure Error:", error);
        return NextResponse.json({ closed: false, error: error.message });
    }
}
