// src/app/api/teacher/grades/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve the active schoolYear string from a school's calendar JSON blob */
function resolveActiveYear(calendar: any): string | null {
    if (!calendar) return null;
    // The calendar stores schoolYear at root level for the active year
    if (calendar.schoolYear) return calendar.schoolYear;
    // Fallback: look inside any level key
    for (const levelKey of ['secondaire', 'primaire', 'maternelle']) {
        if (calendar[levelKey]?.schoolYear) return calendar[levelKey].schoolYear;
    }
    return null;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get("classroomId");
    const courseId = searchParams.get("courseId");
    const periodId = searchParams.get("periodId");
    const matricule = searchParams.get("matricule");

    if (!classroomId) {
        return NextResponse.json({ error: "classroomId requis" }, { status: 400 });
    }

    try {
        // 1. Resolve School context
        let activeMatricule = matricule || undefined;
        if (!activeMatricule) {
            return NextResponse.json({ error: "Matricule de l'établissement requis." }, { status: 400 });
        }

        // Resolve active schoolYear from school calendar
        const schoolRecord = await db.school.findFirst({
            where: { matricule: activeMatricule },
            select: { calendar: true }
        });
        const calendarData = schoolRecord?.calendar
            ? (typeof schoolRecord.calendar === 'string' ? JSON.parse(schoolRecord.calendar) : schoolRecord.calendar)
            : null;
        const activeSchoolYear = resolveActiveYear(calendarData);
        console.log(`[Grades GET] Active schoolYear for ${activeMatricule}:`, activeSchoolYear);

        let solvedClassroomIds: string[] = [];
        const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();
        
        if (classroomId) {
            const targetNorm = normStr(classroomId);
            if (uuidRegex.test(classroomId)) {
                solvedClassroomIds.push(classroomId);
            }

            const allClassrooms = await db.classroom.findMany();
            const matchedByName = allClassrooms.filter((c: any) => {
                const cNorm = normStr(c.name);
                return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
            }).map((c: any) => c.id);

            solvedClassroomIds = Array.from(new Set([...solvedClassroomIds, ...matchedByName]));
        }

        // 3. Resolve Course
        let solvedCourseIds: string[] = [];
        if (courseId) {
            // Attempt to extract the true course name from the slug `${classroom}-${course}`
            let courseNameFromId = courseId;
            const classPrefix = classroomId ? classroomId.replace(/\s+/g, '-') + '-' : '';
            if (classPrefix && courseId.toLowerCase().startsWith(classPrefix.toLowerCase())) {
                courseNameFromId = courseId.slice(classPrefix.length);
            } else if (courseId.includes('-') && !uuidRegex.test(courseId)) {
                // Heuristic fallback if prefix doesn't match: try removing the grade prefix (e.g. "3e-Primaire-")
                const parts = courseId.split('-');
                if (parts.length > 2) {
                    courseNameFromId = parts.slice(2).join('-');
                } else {
                    courseNameFromId = parts.slice(1).join('-');
                }
            }
            
            const normalizedTarget = courseNameFromId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Find the actual classroom name since Course table might still use names
            let searchClassroomName = classroomId.trim();
            if (uuidRegex.test(classroomId)) {
                const classroom = await db.classroom.findUnique({ where: { id: classroomId } });
                if (classroom) {
                    searchClassroomName = classroom.name;
                }
            }

            const allCoursesInRoom = await db.course.findMany({
                where: { classroomName: { contains: searchClassroomName } }
            });

            // Fuzzy match by comparing normalized names
            const matchedCourses = allCoursesInRoom.filter((c: any) => {
                const normalizedName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
            });

            solvedCourseIds = matchedCourses.map((c: any) => c.id);

            // Fallback: search globally if room-specific search failed
            if (solvedCourseIds.length === 0) {
                const globalCourses = await db.course.findMany({
                    where: { 
                        OR: [
                            { id: courseId },
                            { name: { contains: courseNameFromId } }
                        ]
                    }
                });
                solvedCourseIds = globalCourses.map((c: any) => c.id);
            }
            if (solvedCourseIds.length === 0) solvedCourseIds = [courseId];
        }

        // 4. Resolve Period
        let solvedPeriodIds: string[] = [];
        if (periodId) {
            const targetNorm = normStr(periodId);
            // Normalize punctuation for more robust matching (dashes, underscores → stripped)
            const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();
            const targetPunct = normPunct(periodId);

            if (uuidRegex.test(periodId)) {
                solvedPeriodIds.push(periodId);
            }

            const allPeriods = await db.period.findMany();
            const matchedPeriods = allPeriods.filter((p: any) => {
                const pNorm = normStr(p.name);
                const pPunct = normPunct(p.name);
                // Exact matching
                if (pNorm === targetNorm) return true;
                if (pPunct === targetPunct) return true;
                
                // Safe substring matching (only if the substring is substantial)
                if (targetNorm.length > 4 && pNorm.includes(targetNorm)) return true;
                if (targetPunct.length > 4 && pPunct.includes(targetPunct)) return true;
                if (pNorm.length > 4 && targetNorm.includes(pNorm)) return true;
                return false;
            }).map((p: any) => p.id);

            solvedPeriodIds = Array.from(new Set([...solvedPeriodIds, ...matchedPeriods]));

            // Fallback: If periodId is a calendar JSON ID (e.g., "p_t1_p1"), resolve via school calendar
            if (solvedPeriodIds.length === 0 && !uuidRegex.test(periodId)) {
                const school = await db.school.findFirst({ where: { matricule: activeMatricule }, select: { calendar: true } });

                if (school?.calendar) {
                    const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
                    for (const level of ['primaire', 'secondaire', 'maternelle']) {
                        const calPeriods = calendar?.[level]?.periods || [];
                        const calMatchIdx = calPeriods.findIndex((p: any) => p.id === periodId || normPunct(p.id || "") === targetPunct);
                        if (calMatchIdx !== -1) {
                            const calMatch = calPeriods[calMatchIdx];
                            // Found matching calendar entry → find DB period by exact name
                            const calNameNorm = normStr(calMatch.name);
                            let dbMatches = allPeriods.filter((p: any) => normStr(p.name) === calNameNorm).map((p: any) => p.id);
                            // If name-based matching fails, try matching by type+position within the level
                            if (dbMatches.length === 0) {
                                const levelPeriods = allPeriods
                                    .filter((p: any) => normStr(p.level) === normStr(level) && p.schoolMatricule === activeMatricule)
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
                            if (dbMatches.length > 0) {
                                solvedPeriodIds = [...solvedPeriodIds, ...dbMatches];
                            } else if (activeMatricule) {
                                // Auto-create the Period record from calendar data
                                const created = await db.period.create({
                                    data: {
                                        name: calMatch.name,
                                        type: calMatch.type === 'exam' ? 'EXAM' : 'PERIOD',
                                        term: calMatch.term || calMatch.name.split('-')[0] || 'TRIM1',
                                        level: level.toUpperCase(),
                                        weight: calMatch.weight || 1.0,
                                        startDate: calMatch.startDate ? new Date(calMatch.startDate) : null,
                                        endDate: calMatch.endDate ? new Date(calMatch.endDate) : null,
                                        schoolMatricule: activeMatricule,
                                        schoolYear: activeSchoolYear || undefined,
                                    }
                                });
                                solvedPeriodIds.push(created.id);
                                console.log(`[Period Resolution] Auto-created DB period for calendar ID "${periodId}" → ${created.id} (${calMatch.name}) [year: ${activeSchoolYear}]`);
                            }
                            break;
                        }
                    }
                }
            }
        }

        console.log("GET Grades Resolved IDs (Inclusive):", { solvedClassroomIds, solvedCourseIds, solvedPeriodIds });

        // Fetch assessments for the resolved IDs — FILTERED BY ACTIVE SCHOOL YEAR
        const assessmentWhereClause: any = {
            schoolMatricule: activeMatricule,
            classroomId: { in: solvedClassroomIds },
            ...(solvedCourseIds.length > 0 ? { courseId: { in: solvedCourseIds } } : {}),
            ...(solvedPeriodIds.length > 0 ? { periodId: { in: solvedPeriodIds } } : {}),
        };

        // Only filter by schoolYear if we have one AND if we're not looking at all years explicitly
        // This prevents cross-year pollution: assessments without schoolYear OR from other years are excluded
        if (activeSchoolYear) {
            assessmentWhereClause.OR = [
                { schoolYear: activeSchoolYear },
                { schoolYear: null } // legacy records without schoolYear — included temporarily during migration
            ];
        }

        const assessments = await (db.assessment as any).findMany({
            where: assessmentWhereClause,
            select: {
                id: true,
                title: true,
                type: true,
                date: true,
                maxScore: true,
                pondere: true,
                courseId: true,
                course: {
                    select: {
                        name: true
                    }
                },
                classroomId: true,
                periodId: true,
                period: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                isPublished: true,
                hasPendingChanges: true,
                publishedAt: true,
                isSuspended: true,
                results: {
                    select: {
                        id: true,
                        studentId: true,
                        score: true,
                        isExempt: true,
                        isAbsent: true,
                        publishedScore: true,
                        publishedExempt: true,
                    }
                },
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                date: 'desc'
            }
        });
        console.log("Fetched assessments count:", assessments.length);
        if (assessments.length > 0) {
            console.log("First assessment keys:", Object.keys(assessments[0]));
            console.log("First assessment isPublished:", (assessments[0] as any).isPublished);
        }

        // 5. Check if closed — use findFirst with flexible matching
        let closure = null;
        
        // Debug: log all existing GradeSubmissions for comparison
        const allSubmissions = await (db as any).gradeSubmission.findMany({});
        console.log("[Closure Check] All GradeSubmissions in DB:", allSubmissions.length, allSubmissions.map((s: any) => ({
            id: s.id,
            periodId: s.periodId,
            courseId: s.courseId,
            classroomId: s.classroomId,
            status: s.status
        })));
        console.log("[Closure Check] Looking with:", { solvedCourseIds, solvedClassroomIds, solvedPeriodIds });
        
        if (solvedCourseIds.length > 0 && solvedClassroomIds.length > 0) {
            const closureWhere: any = {
                schoolMatricule: activeMatricule,
                courseId: { in: solvedCourseIds },
                classroomId: { in: solvedClassroomIds },
            };
            // Only filter by period if we have resolved period IDs
            if (solvedPeriodIds.length > 0) {
                closureWhere.periodId = { in: solvedPeriodIds };
            }
            closure = await (db as any).gradeSubmission.findFirst({
                where: closureWhere
            });
        }
        
        // Fallback: if no closure found but assessments exist, try matching via assessment courseId/classroomId
        if (!closure && assessments.length > 0) {
            const assessmentCourseIds = [...new Set(assessments.map((a: any) => a.courseId))];
            const assessmentClassroomIds = [...new Set(assessments.map((a: any) => a.classroomId))];
            console.log("[Closure Check] Fallback - checking via assessment IDs:", { assessmentCourseIds, assessmentClassroomIds });
            
            closure = await (db as any).gradeSubmission.findFirst({
                where: {
                    courseId: { in: assessmentCourseIds },
                    classroomId: { in: assessmentClassroomIds },
                    ...(solvedPeriodIds.length > 0 ? { periodId: { in: solvedPeriodIds } } : {})
                }
            });
        }
        
        console.log("[Closure Check] Result:", closure ? `FOUND (id=${closure.id})` : "NOT FOUND");


        return NextResponse.json({
            assessments,
            isClosed: !!closure,
            closure: closure || null
        });
    } catch (error) {
        console.error("GET Grades Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("POST Grades Body:", body);
        const { 
            title, 
            type, 
            date, 
            maxScore,
            pondere,
            courseId, 
            courseName: courseNameFromBody,
            classroomId, 
            periodId,
            results,
            isSuspended,
            schoolMatricule
        } = body;

        if (!title || !maxScore || !courseId || !classroomId || !periodId) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        // Resolve active schoolYear for this school before the transaction
        const schoolForYear = await db.school.findFirst({
            where: { matricule: schoolMatricule },
            select: { calendar: true }
        });
        const calForYear = schoolForYear?.calendar
            ? (typeof schoolForYear.calendar === 'string' ? JSON.parse(schoolForYear.calendar) : schoolForYear.calendar)
            : null;
        const activeSchoolYearPost = resolveActiveYear(calForYear);
        console.log(`[Grades POST] Active schoolYear for ${schoolMatricule}:`, activeSchoolYearPost);

        // --- NEW: Closure Check ---
        const closure = await (db as any).gradeSubmission.findFirst({
            where: {
                schoolMatricule,
                OR: [
                    { periodId, courseId, classroomId },
                    { 
                        period: { name: periodId }, 
                        course: { id: courseId },
                        classroom: { id: classroomId }
                    }
                ]
            }
        });

        if (closure) {
            return NextResponse.json({ error: "Action impossible : Cette période a été clôturée et soumise au Titulaire." }, { status: 403 });
        }
        // --------------------------

        const assessment = await db.$transaction(async (tx: any) => {
            // 1. Resolve Course, Classroom and Period (Late Binding)
            console.log("Resolving IDs for assessment creation:", { courseId, classroomId, periodId });
            
            let solvedCourseId = courseId;
            let solvedClassroomId = classroomId;
            let solvedPeriodId = periodId;

            // Resolve School if not provided
            let matricule = schoolMatricule;
            if (!matricule) {
                throw new Error("Matricule de l'établissement requis.");
            }
            console.log("Resolved matricule:", matricule);

            // Sync/Resolve Classroom
            const isClassroomIdUuid = uuidRegex.test(classroomId.trim());
            const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();

            let existingClassroom = null;
            if (isClassroomIdUuid) {
                existingClassroom = await tx.classroom.findFirst({ where: { id: classroomId.trim() } });
                // UUID not found in DB → try name match from courseId prefix
                if (!existingClassroom && matricule && courseId.includes('-')) {
                    const allClassrooms = await tx.classroom.findMany({ where: { schoolMatricule: matricule } });
                    for (const room of allClassrooms) {
                        const slugPrefix = room.name.toLowerCase().replace(/\s+/g, '-') + '-';
                        if (courseId.toLowerCase().startsWith(slugPrefix)) {
                            existingClassroom = room;
                            solvedClassroomId = room.id;
                            console.log("Resolved classroom from courseId name match:", room.name);
                            break;
                        }
                    }
                }
            } else if (matricule) {
                const allClassrooms = await tx.classroom.findMany({ where: { schoolMatricule: matricule } });
                const targetNorm = normStr(classroomId);
                existingClassroom = allClassrooms.find((c: any) => {
                    const cNorm = normStr(c.name);
                    return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
                });
            }
            
            if (existingClassroom) {
                solvedClassroomId = existingClassroom.id;
                console.log("Solved classroomId:", solvedClassroomId, "Record name:", existingClassroom.name);
            } else if (matricule) {
                const school = await tx.school.findUnique({ where: { matricule } });
                let targetName = classroomId.trim();
                let foundGrade = "";

                if (isClassroomIdUuid && courseId.includes('-')) {
                    // Extract classroom name from school structure keys matching courseId prefix
                    const structure = JSON.parse(school?.structure || "{}");
                    for (const levelKey of Object.keys(structure)) {
                        const levelData = structure[levelKey];
                        if (typeof levelData !== 'object') continue;
                        for (const className of Object.keys(levelData)) {
                            const slugPrefix = className.toLowerCase().replace(/\s+/g, '-') + '-';
                            if (courseId.toLowerCase().startsWith(slugPrefix)) {
                                targetName = className;
                                break;
                            }
                        }
                        if (targetName !== classroomId.trim()) break;
                    }
                    if (targetName === classroomId.trim()) {
                        targetName = courseId.replace(/-/g, ' ');
                    }
                }

                if (school) {
                    const structure = JSON.parse(school.structure || "{}");
                    const normTarget = normStr(targetName);
                    
                    // Iterate through levels (primaire, secondaire...)
                    for (const levelKey of Object.keys(structure)) {
                        const levelData = structure[levelKey];
                        if (typeof levelData !== 'object') continue;
                        
                        for (const gradeName of Object.keys(levelData)) {
                            // Normalize to handle '1ère' vs '1e'
                            const nGrade = normStr(gradeName).replace('1e ', '1ere ');
                            const nTarget = normTarget.replace('1e ', '1ere ');
                            if (nTarget.startsWith(nGrade) || nTarget.includes(nGrade)) {
                                foundGrade = gradeName;
                                break;
                            }
                        }
                        if (foundGrade) break;
                    }

                    if (!foundGrade && structure.classrooms && Array.isArray(structure.classrooms)) {
                        const found = structure.classrooms.find((c: any) => normStr(c.name) === normTarget);
                        if (found) foundGrade = found.grade;
                    }
                }

                if (!foundGrade) {
                    // Extract grade from targetName, e.g. "1ERE HUMANITE" -> "1ERE"
                    foundGrade = targetName.split(' ')[0] || "Non spécifié";
                }

                const created = await tx.classroom.create({
                    data: {
                        name: targetName,
                        grade: foundGrade,
                        level: "SECONDAIRE", // Default best guess
                        schoolMatricule: matricule
                    }
                });
                existingClassroom = created;
                solvedClassroomId = created.id;
                console.log("Created & solved classroomId (fallback):", solvedClassroomId);
            }

            // Sync/Resolve Course
            // Priority: use explicit courseName if provided, else parse from composite courseId
            solvedCourseId = courseId;
            let courseSearchName = courseNameFromBody || courseId;
            if (!courseNameFromBody) {
                // Legacy: try to extract name from composite id format
                const classPrefixPost = existingClassroom ? existingClassroom.id + '-' : '';
                if (classPrefixPost && courseId.toLowerCase().startsWith(classPrefixPost.toLowerCase())) {
                    courseSearchName = courseId.slice(classPrefixPost.length);
                } else if (courseId.includes('-') && !uuidRegex.test(courseId)) {
                    const parts = courseId.split('-');
                    if (parts.length > 2) courseSearchName = parts.slice(2).join('-');
                    else courseSearchName = parts.slice(1).join('-');
                }
            }
            courseSearchName = courseSearchName.replace(/-/g, ' ').trim();

            const targetCourseNorm = normStr(courseSearchName);
            // A true course UUID has exactly 36 chars in standard format
            const isCourseIdUuid = uuidRegex.test(courseId.trim()) && courseId.trim().length === 36;

            let existingCourse = null;
            // If courseName was provided explicitly, always search by name (most reliable)
            if (courseNameFromBody) {
                const allCoursesInRoom = await tx.course.findMany({
                    where: { classroomName: { contains: existingClassroom?.name || "" } }
                });
                existingCourse = allCoursesInRoom.find((c: any) => {
                    const cNorm = normStr(c.name);
                    return cNorm === targetCourseNorm || cNorm.includes(targetCourseNorm) || targetCourseNorm.includes(cNorm);
                });
                // Fallback: global search by name
                if (!existingCourse) {
                    const globalCourses = await tx.course.findMany();
                    existingCourse = globalCourses.find((c: any) => {
                        const cNorm = normStr(c.name);
                        return cNorm === targetCourseNorm || cNorm.includes(targetCourseNorm) || targetCourseNorm.includes(cNorm);
                    });
                }
            } else if (isCourseIdUuid) {
                existingCourse = await tx.course.findFirst({ where: { id: courseId.trim() } });
                // If not found by UUID, fall back to name search
                if (!existingCourse && targetCourseNorm) {
                    const globalCourses = await tx.course.findMany();
                    existingCourse = globalCourses.find((c: any) => {
                        const cNorm = normStr(c.name);
                        return cNorm === targetCourseNorm || cNorm.includes(targetCourseNorm) || targetCourseNorm.includes(cNorm);
                    });
                }
            } else {
                const allCoursesInRoom = await tx.course.findMany({
                    where: { classroomName: { contains: existingClassroom?.name || classroomId } }
                });
                existingCourse = allCoursesInRoom.find((c: any) => {
                    const cNorm = normStr(c.name);
                    return cNorm === targetCourseNorm || cNorm.includes(targetCourseNorm) || targetCourseNorm.includes(cNorm);
                });
                if (!existingCourse) {
                    const globalCourses = await tx.course.findMany();
                    existingCourse = globalCourses.find((c: any) => {
                        const cNorm = normStr(c.name);
                        return cNorm === targetCourseNorm || cNorm.includes(targetCourseNorm) || targetCourseNorm.includes(cNorm);
                    });
                }
            }

            if (existingCourse) {
                solvedCourseId = existingCourse.id;
                console.log("Solved courseId (deduplicated):", solvedCourseId);
            } else if (matricule) {
                const searchName = courseSearchName;
                const school = await tx.school.findUnique({ where: { matricule } });
                const coursesJson = JSON.parse(school?.courses || "{}");
                let foundDetail: any = null;

                // Priority 1: Match within correctly resolved classroom
                const targetKey = existingClassroom?.id;
                const classSpecificList = targetKey ? coursesJson[targetKey] : null;
                
                if (classSpecificList && Array.isArray(classSpecificList)) {
                    foundDetail = classSpecificList.find((item: any) => 
                        normStr(item.name) === targetCourseNorm || 
                        normStr(item.name).replace(/\s+/g, '-') === targetCourseNorm.replace(/\s+/g, '-') ||
                        normStr(item.name) === normStr(courseSearchName)
                    );
                }

                // Priority 2: Global Search if not found in specific class
                if (!foundDetail) {
                    Object.values(coursesJson).forEach((list: any) => {
                        if (!Array.isArray(list) || foundDetail) return;
                        const c = list.find((item: any) => 
                            normStr(item.name) === targetCourseNorm || 
                            normStr(item.name).replace(/\s+/g, '-') === targetCourseNorm.replace(/\s+/g, '-') ||
                            normStr(item.name) === normStr(courseSearchName)
                        );
                        if (c) foundDetail = c;
                    });
                }

                if (foundDetail) {
                    const created = await tx.course.create({
                        data: {
                            name: foundDetail.name,
                            maxPoints: foundDetail.maxPoints || 20,
                            domaine: foundDetail.domaine,
                            classroomName: existingClassroom?.name || classroomId,
                            schoolMatricule: matricule
                        }
                    });
                    solvedCourseId = created.id;
                    console.log("Created & solved courseId:", solvedCourseId);
                } else if (courseSearchName) {
                    // Last resort: create course directly from the name
                    const created = await tx.course.create({
                        data: {
                            name: courseSearchName,
                            maxPoints: parseFloat(String(maxScore)) || 20,
                            classroomName: existingClassroom?.name || classroomId,
                            schoolMatricule: matricule
                        }
                    });
                    solvedCourseId = created.id;
                    console.log("Created course from name fallback:", solvedCourseId, courseSearchName);
                }
            }

            // Sync/Resolve Period (in POST transaction)
            const isPeriodIdUuid = uuidRegex.test(periodId.trim());
            const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();
            const targetPeriodNorm = normStr(periodId);
            const targetPeriodPunct = normPunct(periodId);

            let existingPeriod = null;
            if (isPeriodIdUuid) {
                existingPeriod = await tx.period.findFirst({ where: { id: periodId.trim() } });
            } else if (matricule) {
                // Find existing period for this school+year (prefer matching schoolYear)
                const allPeriods = await tx.period.findMany({ where: { schoolMatricule: matricule } });
                const yearMatchedPeriods = activeSchoolYearPost
                    ? allPeriods.filter((p: any) => p.schoolYear === activeSchoolYearPost)
                    : allPeriods;
                const searchPool = yearMatchedPeriods.length > 0 ? yearMatchedPeriods : allPeriods;
                existingPeriod = searchPool.find((p: any) => {
                    const pNorm = normStr(p.name);
                    const pPunct = normPunct(p.name);
                    return pNorm === targetPeriodNorm || pNorm.includes(targetPeriodNorm) || targetPeriodNorm.includes(pNorm) ||
                           pPunct === targetPeriodPunct || pPunct.includes(targetPeriodPunct) || targetPeriodPunct.includes(pPunct);
                });
            }
            if (existingPeriod) {
                solvedPeriodId = existingPeriod.id;
                console.log("Solved periodId:", solvedPeriodId);
            } else if (matricule && !isPeriodIdUuid) {
                const school = await tx.school.findUnique({ where: { matricule } });
                const calendar = JSON.parse(school?.calendar || "{}");

                // Determine the classroom's level to search in the correct calendar section
                const classroomNameLower = (existingClassroom?.name || classroomId || "").toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const isMaternelleClass = classroomNameLower.includes("maternelle");
                const isPrimaireClass = !isMaternelleClass && (
                    classroomNameLower.includes("primaire") ||
                    // Heuristic: named like "1ère", "2ème" etc. without secondaire keywords
                    (classroomNameLower.match(/^\d+/) && !classroomNameLower.includes("cteb") && !classroomNameLower.includes("humanite"))
                );
                const calLevel = isMaternelleClass ? "maternelle" : (isPrimaireClass ? "primaire" : "secondaire");
                const levelForDB = calLevel.toUpperCase();

                // Search period in the detected level first, then fallback to all levels
                const levelsToSearch = [calLevel, ...['primaire', 'secondaire', 'maternelle'].filter(l => l !== calLevel)];
                let found: any = null;
                let foundLevel: string = calLevel;

                for (const lvl of levelsToSearch) {
                    const pList = calendar?.[lvl]?.periods || [];
                    const searchName = periodId.includes('-') ? periodId.split('-').pop()?.trim() : periodId;
                    const searchTerm = periodId.includes('-') ? periodId.split('-')[0]?.trim() : null;

                    const match = pList.find((p: any) =>
                        p.id === periodId ||
                        p.name === periodId ||
                        p.name === searchName ||
                        (p.term === searchTerm && p.name === searchName) ||
                        normPunct(p.id || "") === targetPeriodPunct ||
                        normStr(p.name) === targetPeriodNorm
                    );
                    if (match) {
                        found = match;
                        foundLevel = lvl;
                        break;
                    }
                }

                if (found) {
                    const created = await tx.period.create({
                        data: {
                            name: found.name,
                            type: found.type === 'exam' ? 'EXAM' : 'PERIOD',
                            term: found.term || 'TRIM1',
                            level: foundLevel.toUpperCase(),
                            schoolMatricule: matricule,
                            schoolYear: activeSchoolYearPost || undefined,
                        }
                    });
                    solvedPeriodId = created.id;
                    console.log(`[Grades POST] Created & solved periodId for level ${foundLevel}:`, solvedPeriodId, activeSchoolYearPost);
                }
            }

            // FINAL VALIDATION before Prisma call
            if (!uuidRegex.test(solvedCourseId) || !uuidRegex.test(solvedClassroomId) || !uuidRegex.test(solvedPeriodId)) {
                throw new Error(`Échec de résolution des identifiants (Bases de données non synchronisées): Course=${solvedCourseId}, Classroom=${solvedClassroomId}, Period=${solvedPeriodId}`);
            }

            console.log("Creating assessment with solved IDs:", { solvedCourseId, solvedClassroomId, solvedPeriodId });

            // 2. Create Assessment — with schoolYear for isolation
            const newAssessment = await tx.assessment.create({
                data: {
                    title,
                    type,
                    date: date ? new Date(date) : new Date(),
                    maxScore: parseFloat(String(maxScore)) || 0,
                    pondere: (pondere !== undefined && pondere !== null && String(pondere).trim() !== "") 
                        ? parseFloat(String(pondere)) 
                        : parseFloat(String(maxScore)) || 0,
                    courseId: solvedCourseId,
                    classroomId: solvedClassroomId,
                    periodId: solvedPeriodId,
                    isSuspended: Boolean(isSuspended),
                    schoolMatricule: matricule,
                    schoolYear: activeSchoolYearPost || undefined,
                }
            });
            console.log("Assessment created:", newAssessment.id);

            // 2. Create Results if provided
            if (results && Array.isArray(results)) {
                await tx.studentResult.createMany({
                    data: results.map((r: any) => ({
                        assessmentId: newAssessment.id,
                        studentId: r.studentId,
                        score: parseFloat(String(r.score)) || 0,
                        isExempt: Boolean(r.isExempt),
                        isAbsent: Boolean(r.isAbsent),
                        exemptionReason: r.exemptionReason || null,
                        schoolMatricule: matricule
                    }))
                });
            }

            return newAssessment;
        });

        return NextResponse.json({ success: true, data: assessment });
    } catch (error: any) {
        console.error("POST Grades Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de l'enregistrement" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        console.log("PUT Grades Body:", body);
        const { assessmentId, title, type, date, maxScore, pondere, isSuspended, results } = body;

        if (!assessmentId) {
            return NextResponse.json({ error: "assessmentId requis" }, { status: 400 });
        }

        // --- NEW: Closure Check ---
        const targetAssessment = await (db.assessment as any).findUnique({
            where: { id: assessmentId },
            select: { periodId: true, courseId: true, classroomId: true, schoolMatricule: true }
        });

        if (targetAssessment) {
            const closure = await (db as any).gradeSubmission.findUnique({
                where: {
                    periodId_courseId_classroomId: {
                        periodId: targetAssessment.periodId,
                        courseId: targetAssessment.courseId,
                        classroomId: targetAssessment.classroomId
                    }
                }
            });
            if (closure) {
                return NextResponse.json({ error: "Action impossible : Période clôturée." }, { status: 403 });
            }
        }
        // --------------------------

        await db.$transaction(async (tx: any) => {
            // Update assessment metadata if provided
            const updateData: any = {};
            if (title !== undefined) updateData.title = title;
            if (type !== undefined) updateData.type = type;
            if (date !== undefined) updateData.date = new Date(date);
            if (maxScore !== undefined) updateData.maxScore = parseFloat(String(maxScore)) || 0;
            if (pondere !== undefined) updateData.pondere = parseFloat(String(pondere)) || 0;
            if (isSuspended !== undefined) updateData.isSuspended = Boolean(isSuspended);

            console.log("Updating assessment with:", updateData);
            if (Object.keys(updateData).length > 0) {
                const current = await (tx.assessment as any).findUnique({ where: { id: assessmentId } });
                if (current?.isPublished) {
                    (updateData as any).hasPendingChanges = true;
                }
                
                await (tx.assessment as any).update({
                    where: { id: assessmentId },
                    data: updateData as any
                });
            }

            // Update results if provided
            if (results && Array.isArray(results)) {
                // If the assessment is published, mark as having pending changes
                const ass = await (tx.assessment as any).findUnique({ where: { id: assessmentId } });
                if (ass?.isPublished) {
                    await (tx.assessment as any).update({
                        where: { id: assessmentId },
                        data: { hasPendingChanges: true } as any
                    });
                }

                for (const r of results) {
                    await tx.studentResult.upsert({
                        where: {
                            studentId_assessmentId: {
                                studentId: r.studentId,
                                assessmentId: assessmentId
                            }
                        },
                        update: {
                            score: parseFloat(String(r.score)) || 0,
                            isExempt: Boolean(r.isExempt),
                            isAbsent: Boolean(r.isAbsent),
                            exemptionReason: r.exemptionReason !== undefined ? r.exemptionReason : null
                        },
                        create: {
                            assessmentId: assessmentId,
                            studentId: r.studentId,
                            score: parseFloat(String(r.score)) || 0,
                            isExempt: Boolean(r.isExempt),
                            isAbsent: Boolean(r.isAbsent),
                            exemptionReason: r.exemptionReason || null,
                            schoolMatricule: targetAssessment?.schoolMatricule || ""
                            // Initially publishedScore/publishedExempt are 0/false until Publish
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("PUT Grades Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de la mise à jour" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const assessmentId = searchParams.get("assessmentId");

        if (!assessmentId) {
            return NextResponse.json({ error: "assessmentId requis" }, { status: 400 });
        }

        // --- NEW: Closure Check ---
        const targetAssessment = await (db.assessment as any).findUnique({
            where: { id: assessmentId },
            select: { periodId: true, courseId: true, classroomId: true }
        });

        if (targetAssessment) {
            const closure = await (db as any).gradeSubmission.findUnique({
                where: {
                    periodId_courseId_classroomId: {
                        periodId: targetAssessment.periodId,
                        courseId: targetAssessment.courseId,
                        classroomId: targetAssessment.classroomId
                    }
                }
            });
            if (closure) {
                return NextResponse.json({ error: "Action impossible : Période clôturée." }, { status: 403 });
            }
        }
        // --------------------------

        await db.$transaction(async (tx: any) => {
            // Delete all student results first (foreign key constraint)
            await tx.studentResult.deleteMany({
                where: { assessmentId }
            });
            // Then delete the assessment itself
            await tx.assessment.delete({
                where: { id: assessmentId }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Grades Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de la suppression" }, { status: 500 });
    }
}
