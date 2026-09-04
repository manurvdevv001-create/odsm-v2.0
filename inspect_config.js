const sqlite = require('better-sqlite3');
const db = new sqlite('dev.db');

console.log('--- Schools Configuration ---');
const schools = db.prepare('SELECT matricule, name, structure, courses, calendar FROM School').all();
schools.forEach(school => {
  console.log(`Matricule: ${school.matricule}`);
  console.log(`Name: ${school.name}`);
  // Parse and re-stringify to pretty print if they are valid JSON
  try { console.log(`Structure: ${JSON.stringify(JSON.parse(school.structure), null, 2)}`); } catch(e) { console.log(`Structure: ${school.structure}`); }
  try { console.log(`Courses: ${JSON.stringify(JSON.parse(school.courses), null, 2)}`); } catch(e) { console.log(`Courses: ${school.courses}`); }
  try { console.log(`Calendar: ${JSON.stringify(JSON.parse(school.calendar), null, 2)}`); } catch(e) { console.log(`Calendar: ${school.calendar}`); }
  console.log('---------------------------');
});

console.log('\n--- Classrooms ---');
const classrooms = db.prepare('SELECT id, name, grade, level FROM Classroom').all();
console.log(JSON.stringify(classrooms, null, 2));

console.log('\n--- Courses ---');
const courses = db.prepare('SELECT id, name, classroomName FROM Course').all();
console.log(JSON.stringify(courses, null, 2));

console.log('\n--- Periods ---');
const periods = db.prepare('SELECT id, name, term, schoolMatricule FROM Period').all();
console.log(JSON.stringify(periods, null, 2));
