import { db } from "./src/lib/db";
import * as fs from "fs";

async function diagnose() {
    let output = "=== CLASSROOM MATRICULE DIAGNOSTIC ===\n";
    try {
        const classrooms = await db.classroom.findMany({
            where: { name: { contains: "7e CTEB A" } }
        });
        
        output += `Classrooms matching '7e CTEB A': ${classrooms.length}\n`;
        classrooms.forEach(c => {
            output += `- Name: '${c.name}', ID: ${c.id}, Matricule: '${c.schoolMatricule}'\n`;
        });

        const schools = await db.school.findMany();
        output += `\nSchools in DB: ${schools.length}\n`;
        schools.forEach(s => {
            output += `- Name: '${s.name}', Matricule: '${s.matricule}'\n`;
        });

        fs.writeFileSync("db_diag_matricule.txt", output);
        console.log("Diagnostic written to db_diag_matricule.txt");

    } catch (e: any) {
        fs.writeFileSync("db_diag_matricule_error.txt", e.message || String(e));
        console.error(e);
    } finally {
        process.exit();
    }
}

diagnose();
