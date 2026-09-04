import { db as prisma } from './src/lib/db';

const normalizeStr = (s: string) => {
    if (!s) return "";
    let norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    norm = norm.replace(/1ere/g, '1e').replace(/1er/g, '1e');
    norm = norm.replace(/([2-9])eme/g, '$1e');
    norm = norm.replace(/education de base/g, 'cteb');
    return norm.replace(/\s+/g, ' ');
};

async function main() {
    console.log("Starting migration to UUID...");

    const schools = await prisma.school.findMany();
    for (const school of schools) {
        console.log(`Processing school: ${school.matricule}`);

        // Fetch all classrooms for this school
        const classrooms = await prisma.classroom.findMany({
            where: { schoolMatricule: school.matricule }
        });

        // Create mapping: normalized_name -> UUID
        const classroomMap = new Map<string, string>();
        classrooms.forEach(c => {
            classroomMap.set(normalizeStr(c.name), c.id);
        });

        // 1. Migrate courses
        let updatedCourses = school.courses;
        if (school.courses) {
            try {
                const coursesJson = JSON.parse(school.courses);
                const newCoursesJson: Record<string, any> = {};
                let changed = false;

                for (const [key, val] of Object.entries(coursesJson)) {
                    const normKey = normalizeStr(key);
                    const classroomId = classroomMap.get(normKey);
                    
                    if (classroomId) {
                        newCoursesJson[classroomId] = val; // Store under UUID
                        changed = true;
                    } else {
                        // Fallback: keep original key if no classroom found
                        newCoursesJson[key] = val;
                    }
                }

                if (changed) {
                    updatedCourses = JSON.stringify(newCoursesJson);
                    console.log(`  -> Migrated courses JSON for school`);
                }
            } catch (e) {
                console.error("  -> Failed to parse courses JSON");
            }
        }

        // 2. Migrate timetables
        let updatedTimetables = school.timetables;
        if (school.timetables) {
            try {
                const timetablesJson = JSON.parse(school.timetables as string);
                const newTimetablesJson: Record<string, any> = {};
                let changed = false;

                for (const [key, val] of Object.entries(timetablesJson)) {
                    const normKey = normalizeStr(key);
                    const classroomId = classroomMap.get(normKey);
                    
                    if (classroomId) {
                        newTimetablesJson[classroomId] = val; // Store under UUID
                        changed = true;
                    } else {
                        newTimetablesJson[key] = val;
                    }
                }

                if (changed) {
                    updatedTimetables = JSON.stringify(newTimetablesJson);
                    console.log(`  -> Migrated timetables JSON for school`);
                }
            } catch (e) {
                console.error("  -> Failed to parse timetables JSON");
            }
        }

        // Save school if changed
        if (updatedCourses !== school.courses || updatedTimetables !== school.timetables) {
            await prisma.school.update({
                where: { id: school.id },
                data: {
                    courses: updatedCourses,
                    timetables: updatedTimetables
                }
            });
            console.log(`  -> Saved school updates`);
        }

        // 3. Migrate StaffProfile.assignedClassroom
        const staffProfiles = await prisma.staffProfile.findMany({
            where: { schoolMatricule: school.matricule, assignedClassroom: { not: null } }
        });

        for (const staff of staffProfiles) {
            if (!staff.assignedClassroom) continue;
            // Check if it's already a UUID (very simple check: contains '-')
            if (staff.assignedClassroom.includes('-') && staff.assignedClassroom.length > 20) {
                continue; // Likely already a UUID
            }

            const normKey = normalizeStr(staff.assignedClassroom);
            const classroomId = classroomMap.get(normKey);

            if (classroomId) {
                await prisma.staffProfile.update({
                    where: { id: staff.id },
                    data: { assignedClassroom: classroomId }
                });
                console.log(`  -> Migrated assignedClassroom for staff ${staff.firstName} ${staff.lastName}`);
            }
        }
    }

    console.log("Migration completed successfully!");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
