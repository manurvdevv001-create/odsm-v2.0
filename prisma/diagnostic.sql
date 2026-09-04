SELECT '=== GRADE SUBMISSIONS ===' as label;
SELECT id, periodId, courseId, classroomId, status FROM GradeSubmission;

SELECT '=== COURSES (sample) ===' as label;
SELECT id, name, classroomName FROM Course LIMIT 20;

SELECT '=== CLASSROOMS ===' as label;
SELECT id, name, schoolMatricule FROM Classroom;

SELECT '=== ASSESSMENTS (sample courseId/classroomId) ===' as label;
SELECT DISTINCT courseId, classroomId, periodId FROM Assessment LIMIT 10;
