import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { parseAssignedClassrooms } from "@/lib/classroom-utils";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const staffId = url.searchParams.get("staffId");
        const schoolMatricule = url.searchParams.get("schoolMatricule");

        if (!staffId || !schoolMatricule) {
            return NextResponse.json({ error: "staffId et schoolMatricule sont requis." }, { status: 400 });
        }

        const teacher = await db.staffProfile.findUnique({
            where: { id: staffId },
        });

        if (!teacher || teacher.schoolMatricule !== schoolMatricule) {
            return NextResponse.json({ error: "Enseignant introuvable." }, { status: 404 });
        }

        const classroomsList = await db.classroom.findMany({
            where: { schoolMatricule },
            select: { id: true, name: true }
        });
        const classroomsById = new Map(classroomsList.map((c: any) => [c.id, c.name]));

        // 1. Identify all classrooms the teacher is involved in
        const classrooms = new Set<string>();
        // assignedClassroom peut être un nom, un UUID, ou une chaîne JSON (tableau)
        for (const ref of parseAssignedClassrooms(teacher.assignedClassroom)) {
            const resolved = classroomsById.get(ref) || ref;
            if (resolved) classrooms.add(resolved);
        }

        let coursesList: any[] = [];
        try {
            if (teacher.assignedCourses) {
                const parsedCourses = JSON.parse(teacher.assignedCourses);
                coursesList = Array.isArray(parsedCourses) ? parsedCourses.filter(c => c !== null && typeof c === 'object') : [];
                coursesList.forEach((c: any) => {
                    if (c.classroom) {
                        const resolved = classroomsById.get(String(c.classroom)) || String(c.classroom);
                        if (resolved) classrooms.add(resolved);
                    }
                });
            }
        } catch (e) {
            console.error("Erreur parsing assignedCourses", e);
        }

        const classroomArray = Array.from(classrooms);

        // 2. Fetch students in those classrooms
        const students = await db.student.findMany({
            where: {
                schoolMatricule: schoolMatricule,
                classroomName: {
                    in: classroomArray
                },
                status: {
                    in: ["active", "pending_payment"] // only fetch active/pending students
                }
            },
            select: {
                id: true,
                matricule: true,
                firstName: true,
                lastName: true,
                middleName: true,
                gender: true,
                classroomName: true,
                status: true,
            }
        });

        return NextResponse.json({
            teacherProfile: teacher,
            courses: coursesList,
            students: students,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("API /api/sync/pull/teacher error:", error);
        return NextResponse.json({ error: "Erreur de synchronisation." }, { status: 500 });
    }
}
