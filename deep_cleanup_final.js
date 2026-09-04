const Database = require('better-sqlite3');
const path = require('path');

async function main() {
    const dbPath = path.resolve(__dirname, 'dev.db');
    console.log(`Opening database at: ${dbPath}`);
    const db = new Database(dbPath);

    try {
        const school = db.prepare('SELECT id, timetables FROM School LIMIT 1').get();
        if (!school) {
            console.log("No school found");
            return;
        }

        const timetables = JSON.parse(school.timetables || "{}");
        const ghostCourseNames = ["Vocabulaire", "Opérations", "Expression Ecrite", "Expresson Ecrite", "Mesures des grandeurs", "Expression Orale (f)"];
        const keys = Object.keys(timetables);
        let deletedCount = 0;

        const newTimetables = { ...timetables };

        keys.forEach(key => {
            const slots = Object.values(timetables[key] || {});
            const hasGhostCourse = slots.some((s) => ghostCourseNames.includes(s.course));
            
            // Delete if it's a Maternelle key (ID 67AM3C or Full Name) AND has ghost courses.
            // We also delete the Full Name keys entirely for Maternelle because we want to use IDs (1ERA, etc.)
            const isMaternelleKey = key === "67AM3C" || 
                                    key.toLowerCase().includes("maternelle") ||
                                    key.toLowerCase().includes("maternel");

            // ALSO target keys that are IDs but polluted (like 67AM3C)
            if (isMaternelleKey && hasGhostCourse) {
                console.log(`Deleting polluted key: ${key}`);
                delete newTimetables[key];
                deletedCount++;
            }
        });

        if (deletedCount > 0) {
            const update = db.prepare('UPDATE School SET timetables = ? WHERE id = ?');
            update.run(JSON.stringify(newTimetables), school.id);
            console.log(`Cleanup complete. Deleted ${deletedCount} polluted keys.`);
        } else {
            console.log("No polluted keys found.");
        }

    } catch (err) {
        console.error("Database error:", err);
    } finally {
        db.close();
    }
}

main();
