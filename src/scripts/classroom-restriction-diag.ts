import { db } from "../lib/db";
import { parseAssignedClassrooms, resolveClassroomNames } from "../lib/classroom-utils";

/**
 * Diagnostic de la "restriction par local spécifique" dans l'espace enseignant.
 * But : montrer où l'identifiant de classe (nom vs UUID) se casse entre :
 *  - les classes en base (Classroom.name)
 *  - les élèves (Student.classroomName)
 *  - les horaires (timetables keys)
 *  - les profils enseignants (assignedClassroom / assignedCourses)
 *  - les épreuves (Assessment.classroomId)
 * et simuler la résolution fuzzy du GET /api/teacher/grades.
 */

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function slugify(s: string) {
    return s.replace(/\s+/g, "-");
}

async function run() {
    const schools = await db.school.findMany({ select: { matricule: true, name: true } });
    console.log("=== ÉCOLES ===");
    console.log(schools.map(s => `${s.matricule} — ${s.name}`).join("\n"));

    if (schools.length === 0) {
        console.log("Aucune école trouvée.");
        return;
    }

    const matricule = process.argv[2] || schools[0].matricule;
    const school = await db.school.findUnique({
        where: { matricule },
        select: { name: true, timetables: true, users: true }
    });
    if (!school) { console.log("École introuvable:", matricule); return; }
    console.log(`\n=== ÉCOLE ACTIVE : ${school.name} (${matricule}) ===`);

    // 1. Classrooms
    const classrooms = await db.classroom.findMany({ where: { schoolMatricule: matricule } });
    console.log(`\n=== CLASSROOMS (${classrooms.length}) ===`);
    classrooms.forEach(c => console.log(`- ${c.id} | name="${c.name}" | grade="${c.grade}" | level="${c.level}"`));

    // 2. Timetables keys
    let timetables: any = {};
    try { timetables = JSON.parse(school.timetables || "{}"); } catch { timetables = {}; }
    const ttKeys = Object.keys(timetables || {});
    console.log(`\n=== TIMETABLES KEYS (${ttKeys.length}) ===`);
    ttKeys.forEach(k => console.log(`- "${k}"${uuidRegex.test(k) ? "  [UUID]" : "  [NOM]"}${!uuidRegex.test(k) && classrooms.some(c => norm(c.name) === norm(k)) ? "  → correspond à un Classroom.name" : ""}`));

    // 3. Étudiants par classe
    const students = await db.student.findMany({ where: { schoolMatricule: matricule }, select: { id: true, classroomName: true, gradeName: true, schoolYear: true } });
    console.log(`\n=== ÉLÈVES (${students.length}) — répartition par classroomName ===`);
    const byClass: Record<string, number> = {};
    students.forEach(s => { const k = s.classroomName || "(vide)"; byClass[k] = (byClass[k] || 0) + 1; });
    Object.entries(byClass).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        const match = classrooms.find(c => norm(c.name) === norm(k));
        console.log(`- "${k}" (${v})${match ? "" : "   ⚠ AUCUNE classe en base ne porte ce nom !"}`);
    });

    // 4. Profils enseignants
    const staff = await db.staffProfile.findMany({ where: { schoolMatricule: matricule } });
    console.log(`\n=== PROFILS ENSEIGNANTS (${staff.length}) ===`);
    for (const t of staff) {
        let assignedCourses: any[] = [];
        try { assignedCourses = typeof t.assignedCourses === 'string' ? JSON.parse(t.assignedCourses) : (t.assignedCourses || []); } catch { assignedCourses = []; }
        console.log(`- ${t.lastName} ${t.firstName} (level=${t.level})`);
        const refs = parseAssignedClassrooms(t.assignedClassroom);
        const resolvedRefs = resolveClassroomNames(refs, classrooms);
        refs.forEach((ref, i) => {
            const isUuid = uuidRegex.test(String(ref));
            const nameMatch = !isUuid && classrooms.some(c => norm(c.name) === norm(String(ref)));
            const idMatch = isUuid && classrooms.some(c => c.id === String(ref));
            const isJsonArray = t.assignedClassroom && t.assignedClassroom.trim().startsWith('[');
            console.log(`  assignedClassroom ref[${i}]="${ref}"${isUuid ? "[UUID]" : "[NOM]"}  → ${nameMatch || idMatch ? "✓ résolvable" : (isJsonArray && resolvedRefs.length > 0 ? "✓ résolu via parsing JSON" : "⚠ NE MATCH AUCUNE CLASSE")}${isJsonArray ? ` (déjà parsé par le code → "${resolvedRefs.join('", "')}")` : ""}`);
        });
        console.log(`  cours: ${assignedCourses.map((a: any) => typeof a === 'object' ? `${a.classroom}:${(a.courses || []).join(",")}` : a).join(" | ")}`);
    }

    // 5. Épreuves : classroomId références-t-elles des classes existantes ?
    const assessments = await (db.assessment as any).findMany({ where: { schoolMatricule: matricule }, select: { id: true, title: true, classroomId: true, courseId: true, periodId: true } });
    console.log(`\n=== ÉPREUVES (${assessments.length}) — cohérence classroomId ===`);
    const orphanAssessments = assessments.filter((a: any) => !classrooms.some(c => c.id === a.classroomId));
    console.log(`- ${assessments.length - orphanAssessments.length}/${assessments.length} pointent vers une classe existante`);
    orphanAssessments.slice(0, 10).forEach((a: any) => console.log(`  ⚠ Épreuve "${a.title}" → classroomId="${a.classroomId}" (introuvable) — courseId="${a.courseId}"`));
    if (orphanAssessments.length > 0) {
        const distinctClassroomIds = [...new Set(orphanAssessments.map((a: any) => a.classroomId))];
        const distinctCourseIds = [...new Set(orphanAssessments.map((a: any) => a.courseId))];
        console.log(`  distinct classroomId orphelins (${distinctClassroomIds.length}):`, distinctClassroomIds.slice(0, 15));
        console.log(`  distinct courseId orphelins (${distinctCourseIds.length}):`, distinctCourseIds.slice(0, 15));
    }

    // 6. Simulation de la résolution du GET /api/teacher/grades
    console.log(`\n=== SIMULATION RÉSOLUTION GET /api/teacher/grades ===`);
    const courseIdParam = process.argv[3];
    const classroomIdParam = process.argv[4];
    if (courseIdParam && classroomIdParam) {
        let solvedClassroomIds: string[] = [];
        if (uuidRegex.test(classroomIdParam)) solvedClassroomIds.push(classroomIdParam);
        const allClassrooms = await db.classroom.findMany(); // sans filtre école (logique actuelle)
        const targetNorm = norm(classroomIdParam);
        const matchedByName = allClassrooms.filter((c: any) => {
            const cNorm = norm(c.name);
            return cNorm === targetNorm || cNorm.includes(targetNorm) || targetNorm.includes(cNorm);
        });
        console.log(`- classroomId param="${classroomIdParam}"`);
        console.log(`  → matchs par nom (TOUTES écoles confondues): ${matchedByName.length}`);
        matchedByName.forEach(c => console.log(`    ${c.id} | "${c.name}" | école=${c.schoolMatricule}${c.schoolMatricule !== matricule ? "  ⚠ AUTRE ÉCOLE !" : ""}`));
        solvedClassroomIds = [...new Set([...solvedClassroomIds, ...matchedByName.map(c => c.id)])];
        console.log(`  → solvedClassroomIds (${solvedClassroomIds.length}):`, solvedClassroomIds);

        // Résolution cours
        let courseNameFromId = courseIdParam;
        const classPrefix = slugify(classroomIdParam) + "-";
        if (courseIdParam.toLowerCase().startsWith(classPrefix.toLowerCase())) {
            courseNameFromId = courseIdParam.slice(classPrefix.length);
        } else if (courseIdParam.includes('-') && !uuidRegex.test(courseIdParam)) {
            const parts = courseIdParam.split('-');
            courseNameFromId = parts.length > 2 ? parts.slice(2).join('-') : parts.slice(1).join('-');
        }
        const searchClassroomName = uuidRegex.test(classroomIdParam)
            ? (classrooms.find(c => c.id === classroomIdParam)?.name || classroomIdParam)
            : classroomIdParam;
        const allCoursesInRoom = await db.course.findMany({ where: { classroomName: { contains: searchClassroomName } } });
        const normCourse = (s: string) => norm(s).replace(/\s+/g, '-');
        const matchedCourses = allCoursesInRoom.filter((c: any) => {
            const n = normCourse(c.name);
            return n.includes(normCourse(courseNameFromId)) || normCourse(courseNameFromId).includes(n);
        });
        console.log(`- courseId param="${courseIdParam}" → nom extrait="${courseNameFromId}"`);
        console.log(`  → cours dans la classe "${searchClassroomName}": ${matchedCourses.length}`);
        matchedCourses.forEach(c => console.log(`    ${c.id} | "${c.name}" | classroomName="${c.classroomName}"`));

        if (matchedCourses.length === 0) {
            const globalCourses = await db.course.findMany({ where: { OR: [{ id: courseIdParam }, { name: { contains: courseNameFromId } }] } });
            console.log(`  ⚠ FALLBACK GLOBAL (recherche par nom sans restriction de classe): ${globalCourses.length}`);
            globalCourses.forEach(c => {
                const inOtherClass = !norm(c.classroomName || "") || norm(c.classroomName || "") !== norm(searchClassroomName);
                console.log(`    ${c.id} | "${c.name}" | classroomName="${c.classroomName}"${inOtherClass ? "  ⚠ AUTRE CLASSE !" : ""}`);
            });
        }

        // Requête épreuves finale
        const assessmentWhere: any = {
            schoolMatricule: matricule,
            classroomId: { in: solvedClassroomIds },
            ...(matchedCourses.length > 0 ? { courseId: { in: matchedCourses.map(c => c.id) } } : {})
        };
        const matchedAssessments = await (db.assessment as any).findMany({ where: assessmentWhere, select: { id: true, title: true, classroomId: true, courseId: true } });
        console.log(`- épreuves résultantes: ${matchedAssessments.length}`);
        const otherClass = matchedAssessments.filter((a: any) => !classrooms.some(c => c.id === a.classroomId && c.id === classroomIdParam));
        if (otherClass.length > 0) {
            console.log(`  ⚠ ${otherClass.length} épreuves d'AUTRES classes/écoles incluses !`);
            otherClass.slice(0, 10).forEach((a: any) => console.log(`    "${a.title}" | classroomId=${a.classroomId} | courseId=${a.courseId}`));
        }
    } else {
        console.log("Passer les paramètres : npx tsx src/scripts/classroom-restriction-diag.ts <matricule> \"<courseId slug>\" \"<classroomId|nom>\"");
        console.log("Exemple : npx tsx src/scripts/classroom-restriction-diag.ts M123 \"7e-CTEB-A-Geometrie\" \"7E CTEB A\"");
    }
}

run().catch(e => { console.error("Erreur:", e); process.exit(1); });
