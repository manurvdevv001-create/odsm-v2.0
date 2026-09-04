
import { db } from "./src/lib/db";

async function deepCheck() {
    const school = await db.school.findFirst();
    if (!school) return;

    const structure = JSON.parse(school.structure || "{}");
    const timetables = JSON.parse(school.timetables || "{}");
    
    console.log("--- STRUCTURE CHECK ---");
    ['maternelle', 'primaire', 'secondaire'].forEach(level => {
        const cls = structure[level]?.classrooms || [];
        console.log(`Level ${level}:`, cls.map((c:any) => ({ id: c.id, name: c.name })));
    });

    console.log("\n--- TIMETABLE KEYS ---");
    console.log(Object.keys(timetables));

    const targetName = "2EME MATERNELLE";
    const foundInMat = (structure.maternelle?.classrooms || []).find((c:any) => c.name.toUpperCase().includes("2EME"));
    console.log("\nTarget 2EME MATERNELLE search in Maternelle level:", foundInMat);
}

deepCheck();
