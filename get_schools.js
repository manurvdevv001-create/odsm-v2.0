const Database = require('better-sqlite3');
const db = new Database('./dev.db');
const schools = db.prepare('SELECT matricule, name, password FROM School').all();
console.log(JSON.stringify(schools, null, 2));
