// src/app/api/teacher/attendance/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get("classroomId");
    const dateStr = searchParams.get("date"); // ISO date string

    if (!classroomId || !dateStr) {
        return NextResponse.json({ error: "classroomId et date requis" }, { status: 400 });
    }

    try {
        const date = new Date(dateStr);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));

        const records = await db.disciplineRecord.findMany({
            where: {
                date: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                type: {
                    in: ["ABSENCE", "LATE"]
                },
                student: {
                    classroomName: {
                        not: null // This is a bit weak, better link is needed
                    }
                }
            },
            include: {
                student: true
            }
        });

        return NextResponse.json(records);
    } catch (error) {
        console.error("GET Attendance Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { 
            date, 
            classroomId, 
            records, // Array of { studentId, type: 'ABSENCE' | 'LATE' | 'PRESENT', description }
            schoolMatricule
        } = body;

        if (!date || !schoolMatricule || !records) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        const attendanceDate = new Date(date);

        await db.$transaction(async (tx: any) => {
            // 1. Delete existing records for this day to avoid duplicates if re-submitting
            const startOfDay = new Date(new Date(attendanceDate).setHours(0, 0, 0, 0));
            const endOfDay = new Date(new Date(attendanceDate).setHours(23, 59, 59, 999));

            // We only delete ABSENCE and LATE records for this specific class's students
            // Since we don't have a direct link to classroom in DisciplineRecord, we filter by students
            const classStudents = await tx.student.findMany({
                where: { classroomName: body.classroomName }, // Pass classroomName in body
                select: { id: true }
            });
            const studentIds = classStudents.map((s: any) => s.id);

            await tx.disciplineRecord.deleteMany({
                where: {
                    studentId: { in: studentIds },
                    date: { gte: startOfDay, lte: endOfDay },
                    type: { in: ["ABSENCE", "LATE"] }
                }
            });

            // 2. Insert new records for non-PRESENT students
            const recordsToInsert = records
                .filter((r: any) => r.type !== "PRESENT")
                .map((r: any) => ({
                    studentId: r.studentId,
                    type: r.type,
                    severity: "LOW",
                    date: attendanceDate,
                    description: r.description || (r.type === "ABSENCE" ? "Absent en classe" : "Retard en classe"),
                    schoolMatricule: schoolMatricule,
                    status: "RESOLVED"
                }));

            if (recordsToInsert.length > 0) {
                await tx.disciplineRecord.createMany({
                    data: recordsToInsert
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("POST Attendance Error:", error);
        return NextResponse.json({ error: error.message || "Erreur de pointage" }, { status: 500 });
    }
}
