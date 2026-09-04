const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../dev.db');
const db = new Database(dbPath);

async function testFlow() {
    console.log("--- 1. Checking Database State ---");
    const classrooms = db.prepare('SELECT id, name FROM Classroom').all();
    const courses = db.prepare('SELECT id, name, classroomName FROM Course').all();
    const schools = db.prepare('SELECT matricule FROM School').all();
    const matricule = schools[0]?.matricule;

    console.log("Classrooms:", classrooms);
    console.log("Courses:", courses);
    console.log("Schools:", schools.map(s => s.matricule));

    const testClassroom = "7e CTEB A";
    const testCourseSynthesized = "7E-CTEB-A-GEOMETRIE";
    const testCourseName = "Géométrie";

    console.log("\n--- 2. Simulating GET Request (/api/teacher/grades) ---");
    // This mimics the logic in our GET handler
    const activeMatricule = matricule;
    
    // Resolve Classroom
    const resolvedClassrooms = db.prepare('SELECT id FROM Classroom WHERE id = ? OR (name LIKE ? AND schoolMatricule = ?)').all(testClassroom, `%${testClassroom}%`, activeMatricule);
    const solvedClassroomIds = resolvedClassrooms.map(c => c.id);
    console.log("Solved Classroom IDs:", solvedClassroomIds);

    // Resolve Course
    const courseSearchName = testCourseName;
    const resolvedCourses = db.prepare('SELECT id FROM Course WHERE id = ? OR name LIKE ?').all(testCourseSynthesized, `%${courseSearchName}%`);
    const solvedCourseIds = resolvedCourses.map(c => c.id);
    console.log("Solved Course IDs:", solvedCourseIds);

    // Fetch Assessments
    if (solvedClassroomIds.length > 0) {
        const query = `SELECT id, title FROM Assessment WHERE classroomId IN (${solvedClassroomIds.map(id => `'${id}'`).join(',')}) AND courseId IN (${solvedCourseIds.map(id => `'${id}'`).join(',')})`;
        const assessments = db.prepare(query).all();
        console.log("Assessments Found:", assessments);
    } else {
        console.log("No classroom IDs resolved, skipping assessment search.");
    }
}

testFlow().catch(console.error).finally(() => db.close());
