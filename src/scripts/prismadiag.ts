import { db } from "../lib/db";

async function run() {
    console.log("--- SIMULATING PRISMA ROUTE LOGIC ---");
    const courseId = "7e-CTEB-A-G%C3%A9om%C3%A9trie";
    const classroomId = "7E CTEB A";
    const periodId = "Semestre 1 - Période 1";

    let solvedClassroomIds: string[] = [];
    let solvedCourseIds: string[] = [];
    let solvedPeriodIds: string[] = [];

    // 1. Classroom
    const exactClassroom = await db.classroom.findUnique({ where: { id: classroomId } });
    if (exactClassroom) solvedClassroomIds.push(exactClassroom.id);
    else {
        const allClassrooms = await db.classroom.findMany();
        const targetClassroomNorm = classroomId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const matchedClassrooms = allClassrooms.filter(c => 
            c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === targetClassroomNorm
        );
        solvedClassroomIds = matchedClassrooms.map(c => c.id);
    }
    console.log("Classrooms:", solvedClassroomIds.length, solvedClassroomIds);

    // 2. Course
    const decodedCourseId = decodeURIComponent(courseId);
    const courseNameFromId = decodedCourseId.includes('-') ? (decodedCourseId.split('-').pop() || decodedCourseId) : decodedCourseId;
    const normalizedTargetCourse = courseNameFromId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const allDbCourses = await db.course.findMany();
    const matchedCourses = allDbCourses.filter(c => {
        if (c.id === courseId) return true;
        const normName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (!normName.includes(normalizedTargetCourse) && !normalizedTargetCourse.includes(normName)) return false;
        if (classroomId) {
            const normRoom = classroomId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const cRoomNorm = (c.classroomName || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (cRoomNorm && cRoomNorm !== normRoom) return false;
        }
        return true;
    });
    solvedCourseIds = matchedCourses.map(c => c.id);
    console.log("Courses:", solvedCourseIds.length, solvedCourseIds);

    // 3. Period
    const exactPeriod = await db.period.findUnique({ where: { id: periodId } });
    if (exactPeriod) solvedPeriodIds.push(exactPeriod.id);
    else {
        const allPeriods = await db.period.findMany();
        const targetPeriodNorm = periodId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const matchedPeriods = allPeriods.filter(p => 
            p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() === targetPeriodNorm
        );
        solvedPeriodIds = matchedPeriods.map(p => p.id);
    }
    console.log("Periods:", solvedPeriodIds.length, solvedPeriodIds);

    // 4. Assessment
    let finalCourseId = solvedCourseIds[0];
    let finalClassroomId = solvedClassroomIds[0];
    let finalPeriodId = solvedPeriodIds[0];

    if (solvedCourseIds.length > 0 && solvedClassroomIds.length > 0) {
        let sampleAssessment = null;
        try {
            sampleAssessment = await (db as any).assessment.findFirst({
                where: {
                    classroomId: { in: solvedClassroomIds },
                    courseId: { in: solvedCourseIds },
                    ...(solvedPeriodIds.length > 0 ? { periodId: { in: solvedPeriodIds } } : {})
                }
            });
            console.log("Sample Assessment output:", sampleAssessment);
        } catch (e: any) {
            console.log("Prisma Error:", e.name, e.message);
        }
        
        if (sampleAssessment) {
            finalCourseId = sampleAssessment.courseId;
            finalClassroomId = sampleAssessment.classroomId;
            if (sampleAssessment.periodId) finalPeriodId = sampleAssessment.periodId;
            console.log("Final IDs mapped from assessment.");
        }
    } else {
        console.log("Skipping assessment query because Course or Classroom IDs are empty.");
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    console.log("Regex Validation:");
    console.log("- courseId:", finalCourseId, uuidRegex.test(finalCourseId || ''));
    console.log("- classroomId:", finalClassroomId, uuidRegex.test(finalClassroomId || ''));
    console.log("- periodId:", finalPeriodId, uuidRegex.test(finalPeriodId || ''));

    console.log("Is final valid?", !!finalCourseId && !!finalClassroomId && !!finalPeriodId &&
        uuidRegex.test(finalCourseId) && uuidRegex.test(finalClassroomId) && uuidRegex.test(finalPeriodId));

}
run();
