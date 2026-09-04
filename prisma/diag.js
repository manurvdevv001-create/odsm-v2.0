const Database = require('better-sqlite3');
const db = new Database('./dev.db');

const courseId = "7e-CTEB-A-G%C3%A9om%C3%A9trie";
const classroomId = "7E CTEB A";
const periodId = "Semestre 1 - Période 1";

console.log("--- SIMULATING POST ROUTE LOGIC ---");

// 2. Resolve Classroom
const classQ = db.prepare(`SELECT id, name FROM Classroom WHERE id = ? OR name = ?`).all(classroomId, classroomId);
const solvedClassroomIds = classQ.map(c => c.id);
console.log("1. Classroom IDs:", solvedClassroomIds.length ? solvedClassroomIds : "EMPTY");

// 3. Resolve Course
const decodedCourseId = decodeURIComponent(courseId);
const courseNameFromId = decodedCourseId.includes('-') ? (decodedCourseId.split('-').pop() || decodedCourseId) : decodedCourseId;
const normalizedTarget = courseNameFromId.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const allCoursesInRoom = db.prepare(`SELECT id, name FROM Course WHERE classroomName = ?`).all(classroomId);
const matchedCourses = allCoursesInRoom.filter(c => {
    const normalizedName = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalizedName.includes(normalizedTarget) || normalizedTarget.includes(normalizedName);
});
let solvedCourseIds = matchedCourses.map(c => c.id);

if (solvedCourseIds.length === 0) {
    const globalCourses = db.prepare(`SELECT id, name FROM Course WHERE id = ? OR name = ?`).all(courseId, courseNameFromId);
    solvedCourseIds = globalCourses.map(c => c.id);
}
console.log("2. Course IDs:", solvedCourseIds.length ? solvedCourseIds : "EMPTY");

// 4. Resolve Period
const periodQ = db.prepare(`SELECT id, name FROM Period WHERE id = ? OR name = ?`).all(periodId, periodId);
const solvedPeriodIds = periodQ.map(p => p.id);
console.log("3. Period IDs:", solvedPeriodIds.length ? solvedPeriodIds : "EMPTY", periodQ);

// 5. Find sample assessment
if (solvedCourseIds.length > 0 && solvedClassroomIds.length > 0) {
    let q = `SELECT id, courseId, classroomId, periodId FROM Assessment WHERE classroomId IN (${solvedClassroomIds.map(()=>'?').join(',')}) AND courseId IN (${solvedCourseIds.map(()=>'?').join(',')})`;
    let params = [...solvedClassroomIds, ...solvedCourseIds];
    
    if (solvedPeriodIds.length > 0) {
        q += ` AND periodId IN (${solvedPeriodIds.map(()=>'?').join(',')})`;
        params.push(...solvedPeriodIds);
    }
    
    const sampleAssessment = db.prepare(q).get(...params);
    if (sampleAssessment) {
        console.log("4. Assessment FOUND!");
        console.log("   finalCourseId =", sampleAssessment.courseId);
        console.log("   finalClassroomId =", sampleAssessment.classroomId);
        console.log("   finalPeriodId =", sampleAssessment.periodId);
    } else {
        console.log("4. Assessment NOT FOUND using those DB lookups!");
        
        // Let's see if ANY assessment exists for this course + classroom
        const fall = `SELECT id, courseId, classroomId, periodId FROM Assessment WHERE classroomId IN (${solvedClassroomIds.map(()=>'?').join(',')}) AND courseId IN (${solvedCourseIds.map(()=>'?').join(',')})`;
        const fallParams = [...solvedClassroomIds, ...solvedCourseIds];
        const anyAss = db.prepare(fall).all(...fallParams);
        console.log(`   (Fallback without period filter: found ${anyAss.length} assessments. IDs: ${anyAss.map(a => a.periodId).join(', ')})`);
    }
} else {
    console.log("Skipping assessment query because Course or Classroom IDs are empty.");
}

db.close();
