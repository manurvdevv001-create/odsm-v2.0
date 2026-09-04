const sqlite = require('better-sqlite3');
const db = new sqlite('dev.db');
const row = db.prepare('SELECT courses FROM School WHERE matricule = ?').get('67AM3C');
if (row) {
    const c = JSON.parse(row.courses || '{}');
    const target = Object.keys(c).filter(k => k.includes('7EME EDUCATION DE BASE A'));
    if (target.length) {
        console.log(JSON.stringify(c[target[0]], null, 2));
    } else {
        // If exact not found, look for general 7EME EDUCATION DE BASE
        const gen = Object.keys(c).filter(k => k.includes('7EME EDUCATION DE BASE'));
        if (gen.length) {
            console.log(`Found under ${gen[0]}:`);
            console.log(JSON.stringify(c[gen[0]], null, 2));
        } else {
            console.log('Class not found. Keys are:');
            console.log(Object.keys(c));
        }
    }
} else {
    console.log('School not found');
}
