const sqlite = require('better-sqlite3');
const db = new sqlite('dev.db');

const row = db.prepare('SELECT structure FROM School WHERE matricule = ?').get('67AM3C');
if (row) {
    console.log('--- Structure for 67AM3C ---');
    console.log(JSON.stringify(JSON.parse(row.structure || '{}'), null, 2));
} else {
    console.log('School not found');
}
