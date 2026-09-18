// src/app/api/admin/period-monitoring/details/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { classroomNamesMatch } from "@/lib/classroom-utils";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normStr = (s: string) => {
    if (!s) return "";
    let norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
    norm = norm.replace(/([2-9])eme/g, '$1e');
    norm = norm.replace(/education de base/g, 'cteb');
    return norm.replace(/\s+/g, ' ');
};
const normPunct = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]+/g, "").trim();

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomName = searchParams.get("classroomId"); // classroom name or ID
    const periodId = searchParams.get("periodId");

    if (!classroomName) {
        return NextResponse.json({ error: "classroomId (nom de classe) requis" }, { status: 400 });
    }

    try {
        // Find school
        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) {
            return NextResponse.json({ error: "Aucune école trouvée." }, { status: 404 });
        }

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear || "2024-2025";

        // Resolve classroom ID and level
        let resolvedClassroomId = classroomName;
        let classroomLevel = "secondaire";
        let classroomGrade = "";
        
        const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
        const targetNorm = normStr(classroomName);
        const matchedClassroom = allClassrooms.find((c: any) => {
            const cNorm = normStr(c.name);
            return c.id === classroomName || cNorm === targetNorm;
        });

        if (matchedClassroom) {
            resolvedClassroomId = matchedClassroom.id;
            classroomGrade = matchedClassroom.grade || "";
        }
        
        // Compute level from name to override potential DB errors
        const nameNormForLevel = normStr(matchedClassroom?.name || classroomName);
        if (nameNormForLevel.includes("maternelle") || nameNormForLevel.includes("accueil")) {
            classroomLevel = "maternelle";
        } else {
            const secKw = ["cteb","humanite","secondaire","litter","scienti","commercial","pedagogi","techni","bio","meca","elec","7e ","8e ","education de base"];
            if (secKw.some((kw) => nameNormForLevel.includes(kw))) {
                classroomLevel = "secondaire";
            } else {
                const cal = typeof school.calendar === "string" ? JSON.parse(school.calendar) : school.calendar || {};
                const secCl: string[] = cal?.secondaire?.classes || [];
                const matCl: string[] = cal?.maternelle?.classes || [];
                if (secCl.some((c: string) => normStr(c) === nameNormForLevel)) classroomLevel = "secondaire";
                else if (matCl.some((c: string) => normStr(c) === nameNormForLevel)) classroomLevel = "maternelle";
                else classroomLevel = "primaire";
            }
        }

        // Fetch students
        const students = await db.student.findMany({
            where: {
                schoolMatricule: school.matricule,
                classroomName: matchedClassroom?.name || classroomName,
                schoolYear: activeYear,
                status: { in: ["active", "pending_payment"] }
            },
            include: {
                conducts: true
            }
        });

        // Resolve periods
        const cLevel = matchedClassroom?.level?.toLowerCase() || "";
        const cNameLower = (matchedClassroom?.name || classroomName).toLowerCase();
        const isMaternelle = cNameLower.includes("maternelle") || cNameLower.includes("maternel") || cLevel === "maternelle";
        const isPrimaire = cNameLower.includes("primaire") || cLevel === "primaire";
        const isSec = !isMaternelle && !isPrimaire;
        const rawLevel = isMaternelle ? "maternelle" : (isPrimaire ? "primaire" : "secondaire");
        const levelCalendar = calendar?.[rawLevel] || {};
        const periods = levelCalendar?.periods || [];

        // Build a mapping from calendar period ID → DB period UUID
        const allDbPeriods = await db.period.findMany({ where: { schoolMatricule: school.matricule } });
        const calPeriodIdToUuid: Record<string, string> = {};
        const levelCalPeriods = calendar?.[rawLevel]?.periods || [];
        levelCalPeriods.forEach((cp: any, idx: number) => {
            const calNameNorm = normStr(cp.name);
            let dbMatch = allDbPeriods.find((p: any) => normStr(p.name) === calNameNorm);
            if (!dbMatch) {
                const thisLevelPeriods = allDbPeriods
                    .filter((p: any) => normStr(p.level) === normStr(rawLevel))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                const calType = cp.type === 'exam' ? 'EXAM' : 'PERIOD';
                const typePeriods = thisLevelPeriods.filter((p: any) => p.type === calType);
                const typeCalPeriods = levelCalPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                const posInType = typeCalPeriods.findIndex((p: any) => p.id === cp.id);
                if (posInType !== -1 && typePeriods[posInType]) {
                    dbMatch = typePeriods[posInType];
                }
            }
            if (dbMatch) {
                calPeriodIdToUuid[cp.id] = dbMatch.id;
            }
        });

        // Fetch assessments for this classroom to calculate averages
        const assessments = await db.assessment.findMany({
            where: {
                classroomId: resolvedClassroomId,
                isPublished: true
            },
            include: {
                results: true,
                course: true,
                period: true
            }
        });

        // Parse school courses to find max points
        const coursesObj = typeof school.courses === 'string' ? JSON.parse(school.courses) : (school.courses || {});
        const gradeKey = Object.keys(coursesObj).find(k => 
            classroomNamesMatch(k, classroomGrade) || classroomNamesMatch(k, matchedClassroom?.name || classroomName)
        );
        const gradeCourses = gradeKey ? coursesObj[gradeKey] : [];

        // Map courses using normalized keys and fallback to ID
        const timetableSlots = typeof school.timetables === 'string' ? JSON.parse(school.timetables) : (school.timetables || {});
        const tbKeys = Object.keys(timetableSlots);
        const nameKeyTb = tbKeys.find(k => normStr(k) === normStr(matchedClassroom?.name || classroomName));
        let classroomTimetable = nameKeyTb ? timetableSlots[nameKeyTb] : {};

        if (Object.keys(classroomTimetable).length === 0 && resolvedClassroomId) {
            classroomTimetable = timetableSlots[resolvedClassroomId] || {};
        }

        const courseNames = new Set<string>();
        Object.values(classroomTimetable).forEach((slot: any) => {
            if (slot?.course) courseNames.add(slot.course.trim());
        });
        if (Array.isArray(gradeCourses)) {
            gradeCourses.forEach((c: any) => {
                if (c?.name) courseNames.add(c.name.trim());
            });
        }

        const classCourses = Array.from(courseNames).map(name => {
            const config = Array.isArray(gradeCourses) ? gradeCourses.find((c: any) => normStr(c.name) === normStr(name)) : null;
            return {
                name,
                max: config?.maxPoints || config?.max || 20
            };
        });

        // Compute student profiles including conduct, ENAFEP, failures, repêchage
        const studentDetails = students.map((student: any) => {
            const studentData = JSON.parse(student.data || "{}");
            const dbPeriodIdForConduct = calPeriodIdToUuid[periodId || ""] || periodId || "";
            const periodConduct = student.conducts?.find((c: any) => c.periodId === dbPeriodIdForConduct);

            // Calculate failures and averages
            const courseFailures: Array<{ courseName: string; average: number; max: number }> = [];
            let studentTotalCurrentPeriodEarned = 0;
            let studentTotalCurrentPeriodPossible = 0;
            let studentTotalAnnualEarned = 0;
            let studentTotalAnnualPossible = 0;

            classCourses.forEach(course => {
                let totalEarned = 0;
                let totalPossible = 0;
                const targetCourseNorm = normStr(course.name);

                // Group assessments for this course
                const courseAssts = assessments.filter((a: any) => {
                    const cName = normStr(a.courseName || a.course?.name || "");
                    const cId = normStr(a.courseId || "");
                    return cName === targetCourseNorm || cId.includes(targetCourseNorm.replace(/\s+/g, '-'));
                });

                periods.forEach((p: any) => {
                    const normPeriodName = normStr(p.name);
                    const dbPeriodId = calPeriodIdToUuid[p.id] || p.id;
                    const periodAssts = courseAssts.filter((a: any) => {
                        return a.periodId === dbPeriodId;
                    });

                    let periodEarned = 0;
                    let periodPossible = 0;
                    let hasResult = false;

                    periodAssts.forEach(ass => {
                        const res = ass.results?.find((r: any) => r.studentId === student.id);
                        if (res) {
                            const pondere = Number(ass.pondere || ass.maxScore || 1);
                            periodEarned += (Number(res.publishedScore || 0) / Number(ass.maxScore || 1)) * pondere;
                            periodPossible += pondere;
                            hasResult = true;
                        }
                    });

                    if (periodPossible > 0) {
                        const isExam = /exam|-ex\b|\bex\b/i.test(normPeriodName);
                        const periodMax = isExam && !isMaternelle ? course.max * 2 : course.max;
                        const periodScore = (periodEarned / periodPossible) * periodMax;
                        totalEarned += periodScore;
                        totalPossible += periodMax;

                        if (dbPeriodId === dbPeriodIdForConduct) {
                            studentTotalCurrentPeriodEarned += periodScore;
                            studentTotalCurrentPeriodPossible += periodMax;
                        }
                    }
                });

                studentTotalAnnualEarned += totalEarned;
                studentTotalAnnualPossible += totalPossible;

                if (totalPossible > 0) {
                    const averagePercent = (totalEarned / totalPossible) * 100;
                    if (averagePercent < 50) {
                        courseFailures.push({
                            courseName: course.name,
                            average: Number(averagePercent.toFixed(1)),
                            max: course.max
                        });
                    }
                }
            });

            const currentPeriodAverage = studentTotalCurrentPeriodPossible > 0 ? (studentTotalCurrentPeriodEarned / studentTotalCurrentPeriodPossible) * 100 : null;
            const annualAverage = studentTotalAnnualPossible > 0 ? (studentTotalAnnualEarned / studentTotalAnnualPossible) * 100 : null;

            return {
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                middleName: student.middleName,
                matricule: student.matricule,
                currentPeriodAverage: currentPeriodAverage !== null ? Number(currentPeriodAverage.toFixed(2)) : null,
                annualAverage: annualAverage !== null ? Number(annualAverage.toFixed(2)) : null,
                conduct: periodConduct?.grade || "",
                application: periodConduct?.application || "",
                comment: periodConduct?.comment || "",
                enafepScore: studentData.enafepScore !== undefined ? studentData.enafepScore : null,
                stateExamScore: studentData.stateExamScore !== undefined ? studentData.stateExamScore : null,
                jurySchoolScore: studentData.jurySchoolScore !== undefined ? studentData.jurySchoolScore : null,
                juryExamScore: studentData.juryExamScore !== undefined ? studentData.juryExamScore : null,
                juryLesson2: studentData.juryLesson2 !== undefined ? studentData.juryLesson2 : null,
                repechageCourses: studentData.repechageCourses || [],
                failingCourses: courseFailures,
                finalDecision: studentData.finalDecision !== undefined ? studentData.finalDecision : null,
                finalConduct: studentData.finalConduct !== undefined ? studentData.finalConduct : null,
                finalApplication: studentData.finalApplication !== undefined ? studentData.finalApplication : null,
            };
        });

        return NextResponse.json({
            students: studentDetails,
            isSecondary: isSec,
            classroomLevel
        });

    } catch (error: any) {
        console.error("[Period Monitoring Details GET] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { periodId, classroomId, updates } = body;

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: "updates (array) requis" }, { status: 400 });
        }

        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) {
            return NextResponse.json({ error: "Aucune école trouvée." }, { status: 404 });
        }

        // Resolve calendar period ID to DB UUID
        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear || "2024-2025";
        const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
        const targetNorm = normStr(classroomId || "");
        const matchedClassroom = allClassrooms.find((c: any) => {
            const cNorm = normStr(c.name);
            return c.id === classroomId || cNorm === targetNorm;
        });
        const cLevel = matchedClassroom?.level?.toLowerCase() || "";
        const cNameLower = (matchedClassroom?.name || classroomId || "").toLowerCase();
        const isMaternelle = cNameLower.includes("maternelle") || cNameLower.includes("maternel") || cLevel === "maternelle";
        const isPrimaire = cNameLower.includes("primaire") || cLevel === "primaire";
        const rawLevel = isMaternelle ? "maternelle" : (isPrimaire ? "primaire" : "secondaire");
        const levelCalPeriods = calendar?.[rawLevel]?.periods || [];
        const allDbPeriods = await db.period.findMany({ where: { schoolMatricule: school.matricule } });
        const calPeriodIdToUuid: Record<string, string> = {};
        levelCalPeriods.forEach((cp: any, idx: number) => {
            const calNameNorm = normStr(cp.name);
            let dbMatch = allDbPeriods.find((p: any) => normStr(p.name) === calNameNorm);
            if (!dbMatch) {
                const thisLevelPeriods = allDbPeriods
                    .filter((p: any) => normStr(p.level) === normStr(rawLevel))
                    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'));
                const calType = cp.type === 'exam' ? 'EXAM' : 'PERIOD';
                const typePeriods = thisLevelPeriods.filter((p: any) => p.type === calType);
                const typeCalPeriods = levelCalPeriods.filter((p: any) => (p.type === 'exam' ? 'EXAM' : 'PERIOD') === calType);
                const posInType = typeCalPeriods.findIndex((p: any) => p.id === cp.id);
                if (posInType !== -1 && typePeriods[posInType]) {
                    dbMatch = typePeriods[posInType];
                }
            }
            if (dbMatch) {
                calPeriodIdToUuid[cp.id] = dbMatch.id;
            }
        });
        let dbPeriodId = calPeriodIdToUuid[periodId || ""] || periodId;
        // Fallback: try to match by period name if mapping by calendar ID failed
        if (!dbPeriodId && periodId) {
            const calPeriod = levelCalPeriods.find((cp: any) => cp.id === periodId);
            const periodNameToMatch = calPeriod?.name || periodId;
            const found = allDbPeriods.find((p: any) => normStr(p.name) === normStr(periodNameToMatch));
            if (found) {
                dbPeriodId = found.id;
                console.warn('[Details POST] Fallback matched calendar period name to DB period', { periodId, periodNameToMatch, matchedPeriod: found.id });
            }
        }
        console.log("[Details POST] Debug", { periodId, classroomId, cNameLower, rawLevel, calPeriodIdToUuid, dbPeriodId });

        // Bulk operations
        for (const update of updates) {
            const {
                studentId,
                conduct,
                application,
                comment,
                enafepScore,
                stateExamScore,
                jurySchoolScore,
                juryExamScore,
                juryLesson1,
                juryLesson2,
                repechageCourses,
                finalDecision,
                finalConduct,
                finalApplication
            } = update;

            if (!studentId) continue;

            // Update qualitative mentions if periodId is provided
            if (dbPeriodId && (conduct !== undefined || application !== undefined || comment !== undefined)) {
                const conductWhere = { studentId_periodId: { studentId, periodId: dbPeriodId } };
                const conductRecord = await db.studentConduct.findUnique({ where: conductWhere });

                const updateData: any = {};
                if (conduct !== undefined) updateData.grade = conduct || null;
                if (application !== undefined) updateData.application = application || null;
                if (comment !== undefined) updateData.comment = comment || null;

                if (conductRecord) {
                    await db.studentConduct.update({
                        where: conductWhere,
                        data: updateData
                    });
                } else {
                    await db.studentConduct.create({
                        data: {
                            studentId,
                            periodId: dbPeriodId,
                            schoolMatricule: school.matricule,
                            grade: conduct || null,
                            application: application || null,
                            comment: comment || null
                        }
                    });
                }
            }

            // Update JSON data fields in Student
            const student = await db.student.findUnique({ where: { id: studentId } });
            if (student) {
                const studentData = JSON.parse(student.data || "{}");
                
                if (enafepScore !== undefined) studentData.enafepScore = enafepScore;
                if (stateExamScore !== undefined) studentData.stateExamScore = stateExamScore;
                if (jurySchoolScore !== undefined) studentData.jurySchoolScore = jurySchoolScore;
                if (juryExamScore !== undefined) studentData.juryExamScore = juryExamScore;
                if (juryLesson1 !== undefined) studentData.juryLesson1 = juryLesson1;
                if (juryLesson2 !== undefined) studentData.juryLesson2 = juryLesson2;
                if (repechageCourses !== undefined) studentData.repechageCourses = repechageCourses;
                if (finalDecision !== undefined) studentData.finalDecision = finalDecision;
                if (finalConduct !== undefined) studentData.finalConduct = finalConduct;
                if (finalApplication !== undefined) studentData.finalApplication = finalApplication;

                await db.student.update({
                    where: { id: studentId },
                    data: {
                        data: JSON.stringify(studentData)
                    }
                });

                // Sync finalDecision → AnnualDecision table for structured tracking
                if (finalDecision !== undefined && matchedClassroom) {
                    const DECISION_MAP: Record<string, string> = {
                        'PROMU': 'PROMU', 'Promu': 'PROMU', 'promu': 'PROMU',
                        'MAINTENU': 'MAINTENU', 'Maintenu': 'MAINTENU', 'maintenu': 'MAINTENU',
                        'DEMIS': 'DEMIS', 'Démis': 'DEMIS', 'demis': 'DEMIS',
                        'EXCLU': 'EXCLU', 'Exclu': 'EXCLU', 'exclu': 'EXCLU',
                        'RETIRE': 'RETIRE', 'Retiré': 'RETIRE', 'retire': 'RETIRE'
                    };
                    const normalizedDecision = finalDecision ? DECISION_MAP[finalDecision] : null;
                    if (normalizedDecision) {
                        const existingAnnualDecision = await (db as any).annualDecision.findFirst({
                            where: {
                                studentId,
                                schoolYear: activeYear,
                                schoolMatricule: school.matricule
                            }
                        });
                        if (existingAnnualDecision) {
                            await (db as any).annualDecision.update({
                                where: { id: existingAnnualDecision.id },
                                data: { decision: normalizedDecision }
                            });
                        } else {
                            await (db as any).annualDecision.create({
                                data: {
                                    studentId,
                                    schoolYear: activeYear,
                                    schoolMatricule: school.matricule,
                                    fromClassroomId: matchedClassroom.id,
                                    fromGradeId: matchedClassroom.gradeId || "",
                                    decision: normalizedDecision,
                                    targetGradeId: null
                                }
                            });
                        }
                    }
                }

            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Period Monitoring Details POST] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
