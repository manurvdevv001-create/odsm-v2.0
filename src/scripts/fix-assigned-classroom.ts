import { db } from "../lib/db";
import { parseAssignedClassrooms } from "../lib/classroom-utils";

/**
 * Migration : normalise StaffProfile.assignedClassroom.
 * - "[]" / vide → null
 * - "["1ère Maternelle"]" (1 élément) → valeur simple
 * - "["<uuid>"]" (1 élément) → nom de classe si résolvable, sinon UUID
 * - plusieurs éléments → conservé en JSON (restrictions multi-classes)
 */
async function run() {
    const staff = await db.staffProfile.findMany({ select: { id: true, lastName: true, firstName: true, schoolMatricule: true, assignedClassroom: true } });

    const schools = [...new Set(staff.map(s => s.schoolMatricule).filter((m): m is string => !!m))];
    const classrooms = await db.classroom.findMany({ where: { schoolMatricule: { in: schools } }, select: { id: true, name: true, schoolMatricule: true } });
    const byId = new Map(classrooms.map(c => [`${c.schoolMatricule}:${c.id}`, c.name]));

    let updated = 0;
    for (const s of staff) {
        const raw = s.assignedClassroom;
        if (!raw) continue;

        let refs: string[] = [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                if (parsed.length === 0) {
                    await db.staffProfile.update({ where: { id: s.id }, data: { assignedClassroom: null } });
                    console.log(`- ${s.lastName} ${s.firstName} : "[]" → null`);
                    updated++;
                    continue;
                }
                refs = parsed.map(String).filter(Boolean);
            } else {
                continue; // déjà une valeur simple
            }
        } catch {
            continue; // déjà une valeur simple (nom ou UUID)
        }

        if (refs.length === 1) {
            const resolved = byId.get(`${s.schoolMatricule}:${refs[0]}`) || refs[0];
            await db.staffProfile.update({ where: { id: s.id }, data: { assignedClassroom: resolved } });
            console.log(`- ${s.lastName} ${s.firstName} : ${JSON.stringify(refs)} → "${resolved}"`);
            updated++;
        } else if (refs.length > 1) {
            const resolved = refs.map(r => byId.get(`${s.schoolMatricule}:${r}`) || r);
            await db.staffProfile.update({ where: { id: s.id }, data: { assignedClassroom: JSON.stringify(resolved) } });
            console.log(`- ${s.lastName} ${s.firstName} : ${refs.length} éléments → "${resolved.join('", "')}"`);
            updated++;
        }
    }

    console.log(`\nProfils mis à jour : ${updated}/${staff.length}`);

    // Vérification finale
    const after = await db.staffProfile.findMany({ select: { lastName: true, firstName: true, assignedClassroom: true } });
    console.log("\n=== ÉTAT FINAL ===");
    after.forEach(s => console.log(`- ${s.lastName} ${s.firstName} : "${s.assignedClassroom}"`));
}

run().catch(e => { console.error("Erreur:", e); process.exit(1); });
