const sqlite = require('better-sqlite3');
const db = new sqlite('dev.db');

const row = db.prepare('SELECT courses FROM School WHERE matricule = ?').get('67AM3C');
if (row) {
    const courses = JSON.parse(row.courses || '{}');
    console.log('--- Courses for 1ERE PRIMAIRE A ---');
    console.log(JSON.stringify(courses['1ERE PRIMAIRE A'], null, 2));
} else {
    console.log('School not found');
}
