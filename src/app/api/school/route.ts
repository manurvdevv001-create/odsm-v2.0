import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTeacherFullName, matchTeacherName } from "@/lib/utils";
import { getCurrentSchoolYear } from "@/lib/school-year-utils";
import { getSchoolSettingsForYear } from "@/lib/school-settings";
import { parseAssignedClassrooms } from "@/lib/classroom-utils";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    let matricule = searchParams.get("matricule");
    const mode = searchParams.get("mode"); // 'teacher' or 'admin'
    const classId = searchParams.get("classId"); // classroomName (fallback from client)
    const staffId = searchParams.get("staffId"); // teacher's staffProfile ID

    // Security: Validate matricule via session if available
    const session = await getSession();
    if (session) {
        // If session exists, we MUST use the matricule from the session
        // or at least verify it matches.
        if (matricule && matricule !== session.matricule) {
            return NextResponse.json({ error: "Violation de sécurité : Matricule incohérent." }, { status: 403 });
        }
        matricule = session.matricule;
    } else if (!matricule) {
        // No session and no matricule provided? That's unauthorized for an Internet-exposed app
        // But for local/mobile, we might still allow it if matricule is provided (for now)
        // However, we should encourage session usage.
    }

    try {
        if (!matricule) {
            return NextResponse.json({ error: "Matricule de l'établissement requis (via session ou paramètre)." }, { status: 400 });
        }

        const school = await db.school.findUnique({
            where: { matricule },
            select: {
                id: true,
                name: true,
                matricule: true,
                secopeMatricule: true,
                logo: true,
                address: true,
                city: true,
                province: true,
                phone: true,
                levels: true,
                calendar: true,
                configuration: true,
                structure: true,
                courses: true,
                timeSlots: true,
                timetables: true,
                activityLog: true,
                users: true,
                teachers: mode !== "teacher",
            },
        });

        if (!school) {
            return NextResponse.json({ error: "Aucune école trouvée." }, { status: 404 });
        }

        const classroomsList = await db.classroom.findMany({
            where: { schoolMatricule: matricule }
        });

        let schoolSettings = await getSchoolSettingsForYear(matricule, year || undefined);
        if (!schoolSettings) {
            // Fallback to legacy school data if year parsing fails or active year is missing.
            const schoolCalendar = JSON.parse(school.calendar || "{}");
            const activeYear = schoolCalendar?.schoolYear || year || undefined;
            schoolSettings = {
                schoolMatricule: matricule,
                schoolYear: activeYear || getCurrentSchoolYear(),
                isDraft: false,
                activeYear: activeYear || null,
                yearState: activeYear ? (year && year !== activeYear ? "draft" : "active") : "draft",
                calendar: schoolCalendar,
                financeSettings: {},
                configuration: JSON.parse(school.configuration || "{}"),
                structure: JSON.parse(school.structure || "{}"),
                courses: JSON.parse(school.courses || "{}"),
                timeSlots: JSON.parse(school.timeSlots || "{}"),
                timetables: JSON.parse(school.timetables || "{}"),
                activityLog: JSON.parse(school.activityLog || "[]"),
                users: JSON.parse(school.users || "[]"),
            };
        }

        const {
            schoolYear: targetYear,
            activeYear,
            yearState,
            calendar,
            configuration,
            structure,
            courses,
            timeSlots,
            financeSettings: yearFinanceSettings,
            activityLog,
        } = schoolSettings;
        let timetables = schoolSettings.timetables;

        let freshProfile: any = null;
        let classroomList: string[] = classId ? classId.split(",") : [];

        if (mode === "teacher" && staffId) {
            freshProfile = await db.staffProfile.findUnique({
                where: { id: staffId }
            });

            if (freshProfile) {
                const freshClassrooms = new Set<string>();
                const classroomsById = new Map(classroomsList.map((c: any) => [c.id, c.name]));

                // assignedClassroom peut être un nom, un UUID, ou une chaîne JSON (tableau)
                for (const ref of parseAssignedClassrooms(freshProfile.assignedClassroom)) {
                    const resolved = classroomsById.get(ref) || ref;
                    if (resolved) freshClassrooms.add(resolved);
                }

                try {
                    const rawCourses = typeof freshProfile.assignedCourses === 'string'
                        ? JSON.parse(freshProfile.assignedCourses)
                        : (freshProfile.assignedCourses || []);
                    if (Array.isArray(rawCourses)) {
                        rawCourses.forEach((a: any) => {
                            if (a && typeof a === 'object' && a.classroom) {
                                const resolved = classroomsById.get(String(a.classroom)) || String(a.classroom);
                                if (resolved) freshClassrooms.add(resolved);
                            }
                        });
                    }
                } catch (e) {}

                const teacherProfileName = getTeacherFullName(freshProfile);
                for (const [classroom, slots] of Object.entries(timetables || {})) {
                    if (typeof slots === 'object' && slots !== null) {
                        for (const slot of Object.values(slots as Record<string, any>)) {
                            if (slot?.teacher) {
                                const t = slot.teacher;
                                if (matchTeacherName(teacherProfileName, t) || t.includes(freshProfile.lastName)) {
                                    freshClassrooms.add(classroom);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (freshClassrooms.size > 0) {
                    classroomList = Array.from(freshClassrooms);
                }
            }
        }

        const archivedCalendars = configuration?.archivedCalendars || {};
        let teachers = (school.teachers || []) as any[];

        if (yearState !== "active" && archivedCalendars[targetYear]) {
            const archive = archivedCalendars[targetYear];
            if (archive.staffAssignments && Array.isArray(archive.staffAssignments)) {
                teachers = teachers.map((t) => {
                    const snapshot = archive.staffAssignments.find((s: any) => s.id === t.id);
                    if (snapshot) {
                        return {
                            ...t,
                            assignedClassroom: snapshot.assignedClassroom,
                            assignedCourses: snapshot.assignedCourses,
                        };
                    }
                    return t;
                });
            }
        }

        // 1. Fetch Targeted Students
        let students: any[] = [];
        if (mode === "teacher" && classroomList.length > 0) {
            students = await db.student.findMany({
                where: { 
                    schoolMatricule: school.matricule,
                    classroomName: { in: classroomList },
                    schoolYear: targetYear
                }
            });
        } else {
            // Admin mode: filter all students by year
            students = await db.student.findMany({
                where: {
                    schoolMatricule: school.matricule,
                    schoolYear: targetYear
                }
            });
        }

        // 2. Query guardians (Admin only)
        let guardians = [];
        if (mode !== "teacher") {
            try {
                // For guardians, we fetch those who have students in the target year
                guardians = await (db as any).guardian.findMany({
                    where: { 
                        schoolMatricule: school.matricule,
                        students: {
                            some: { schoolYear: targetYear }
                        }
                    },
                    include: { 
                        students: {
                            where: { schoolYear: targetYear }
                        }
                    }
                });
            } catch (e) {
                console.error("Failed to fetch guardians separately:", e);
            }
        }

        // 3. Filter Payments by year
        const payments = await db.payment.findMany({
            where: {
                schoolMatricule: school.matricule,
                schoolYear: targetYear
            },
            include: { details: true }
        });

        const financeSettings = mode !== "teacher" ? yearFinanceSettings : {};

        // Prune timetables for teachers
        if (mode === "teacher" && classroomList.length > 0) {
            const filteredTimetables: any = {};
            classroomList.forEach(cId => {
                if (timetables[cId]) {
                    filteredTimetables[cId] = timetables[cId];
                }
            });
            timetables = filteredTimetables;
        }

        return NextResponse.json({
            id: school.id,
            name: school.name,
            matricule: school.matricule,
            secopeMatricule: school.secopeMatricule,
            logo: school.logo,
            address: school.address,
            city: school.city,
            province: school.province,
            phone: school.phone,
            levels: JSON.parse(school.levels || "{}"),
            calendar,
            activeYear,
            yearState,
            configuration: mode !== "teacher" ? configuration : {},
            structure,
            courses,
            timeSlots,
            timetables,
            classrooms: classroomsList,
            financeSettings,
            activityLog: mode !== "teacher" ? activityLog : [],
            teachers: mode !== "teacher" ? teachers : [],
            students: students,
            payments: (payments || []).map((p: any) => ({
                ...p,
                transactionNumber: p.transactionNo,
                totalAmountPaid: p.amount,
                details: (p.details || []).map((d: any) => ({
                    ...d,
                    feeItemId: d.feeName,
                    amountPaid: d.amount
                }))
            })),
            guardians: guardians || [],
            studentCount: students.length,
            teacherCount: school.teachers?.length || 0,
            paymentCount: payments.length,
            // Fresh teacher profile from DB (only in teacher mode)
            ...(freshProfile ? { freshProfile } : {}),
        });
    } catch (error) {
        console.error("API /api/school error:", error);
        return NextResponse.json(
            { error: "Erreur lors du chargement des données." },
            { status: 500 }
        );
    }
}
