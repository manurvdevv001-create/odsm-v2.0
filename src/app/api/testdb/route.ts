import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
    try {
        const school = await db.school.findFirst();
        const timetables = typeof school?.timetables === 'string' ? JSON.parse(school.timetables) : school?.timetables;
        const classrooms = Object.keys(timetables || {});
        
        const dbClassrooms = await db.classroom.findMany({ select: { id: true, name: true } });
        const dbCourses = await db.course.findMany({ select: { id: true, name: true, classroomName: true } });
        
        return NextResponse.json({ 
            timetableClassrooms: classrooms,
            dbClassrooms: dbClassrooms.map((c: any) => c.name),
            dbCourses: dbCourses.map((c: any) => ({ name: c.name, classroom: c.classroomName })),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message });
    }
}
