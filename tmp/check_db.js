const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../dev.db');
const db = new Database(dbPath);

const schools = db.prepare('SELECT matricule, name, structure FROM School').all();
console.log(`Found ${schools.length} schools:`);
schools.forEach(s => {
    console.log(`--- School: ${s.name} (${s.matricule}) ---`);
    console.log("Structure JSON:", s.structure);
    try {
        const struct = JSON.parse(s.structure || '{}');
        const names = struct.classrooms?.map(c => c.name) || [];
        console.log("Classroom Names in JSON:", names);
    } catch(e) { console.log("JSON Parse Error"); }
});

const classrooms = db.prepare('SELECT name, schoolMatricule FROM Classroom').all();
console.log("Global Classrooms in DB:", classrooms);

db.close();
