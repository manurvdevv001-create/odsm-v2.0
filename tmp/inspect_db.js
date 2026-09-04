const Database = require('better-sqlite3');
const path = require('path');

try {
    const dbPath = path.join(__dirname, '..', 'dev.db');
    console.log("Connecting to:", dbPath);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    
    // Get the first school
    const schoolRow = db.prepare('SELECT courses FROM School LIMIT 1').get();
    
    if (schoolRow && schoolRow.courses) {
        const courses = JSON.parse(schoolRow.courses);
        
        // Let's see what keys exist
        console.log("Keys in courses:", Object.keys(courses));
        
        // Find if any key contains "1"
        const primaryKeys = Object.keys(courses).filter(k => k.includes('1'));
        for (const key of primaryKeys) {
            console.log(`\n--- Courses in [${key}] ---`);
            const gradeCourses = courses[key];
            const tech = gradeCourses.find(c => c.name.toLowerCase().includes('tech'));
            if (tech) {
                console.log("Found tech course:", tech);
            } else {
                console.log("No 'tech' course found in", key);
            }
        }

        // Also let's find that 20 base course
        console.log("\n--- Searching ALL for tech ---");
        for (const [grade, gradeCourses] of Object.entries(courses)) {
             const tech = gradeCourses.find(c => c.name.toLowerCase().includes('tech'));
             if (tech) {
                 console.log(`Found in [${grade}]:`, tech);
             }
        }
    } else {
        console.log("No courses found.");
    }
    
    db.close();
} catch (e) {
    console.error(e.message);
}
