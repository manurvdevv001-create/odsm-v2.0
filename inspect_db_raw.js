const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new Database(dbPath);

console.log('--- Courses Table ---');
const courses = db.prepare('SELECT * FROM Course LIMIT 20').all();
console.log(JSON.stringify(courses, null, 2));

console.log('\n--- Schools Table (Courses JSON) ---');
const schools = db.prepare('SELECT matricule, name, courses FROM School LIMIT 1').all();
schools.forEach(s => {
    console.log(`School: ${s.name} (${s.matricule})`);
    try {
        const c = JSON.parse(s.courses);
        console.log('Courses structure sample (first 2 keys):');
        const keys = Object.keys(c).slice(0, 2);
        keys.forEach(k => {
            console.log(`Grade: ${k}`, JSON.stringify(c[k].slice(0, 2), null, 2));
        });
    } catch (e) {
        console.log('Raw courses:', s.courses);
    }
});

db.close();
