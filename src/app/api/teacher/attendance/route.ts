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
        const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
        const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

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
                    classroomName: classroomId
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
            classroomName,
            records, // Array of { studentId, type: 'ABSENCE' | 'LATE' | 'PRESENT', description }
            schoolMatricule: rawSchoolMatricule,
            matricule: rawMatricule
        } = body;

        const targetClassroom = classroomName || classroomId;
        const schoolMatricule = rawSchoolMatricule || rawMatricule;

        if (!date || !records || !targetClassroom) {
            return NextResponse.json({ error: "Données requises manquantes (date, classroomId ou records)" }, { status: 400 });
        }

        const attendanceDate = new Date(date);

        await db.$transaction(async (tx: any) => {
            // Identifier les élèves de la classe
            const classStudents = await tx.student.findMany({
                where: { classroomName: targetClassroom },
                select: { id: true, schoolMatricule: true }
            });
            const studentIds = classStudents.map((s: any) => s.id);
            
            // Déterminer le matricule école effectif
            const resolvedMatricule = schoolMatricule || classStudents[0]?.schoolMatricule;
            if (!resolvedMatricule) {
                throw new Error("Matricule de l'établissement introuvable pour enregistrer le pointage.");
            }

            // 1. Supprimer les pointages existants pour ce jour afin d'éviter les doublons lors des re-soumissions
            const startOfDay = new Date(new Date(attendanceDate).setHours(0, 0, 0, 0));
            const endOfDay = new Date(new Date(attendanceDate).setHours(23, 59, 59, 999));

            if (studentIds.length > 0) {
                await tx.disciplineRecord.deleteMany({
                    where: {
                        studentId: { in: studentIds },
                        date: { gte: startOfDay, lte: endOfDay },
                        type: { in: ["ABSENCE", "LATE"] }
                    }
                });
            }

            // 2. Insérer les nouveaux enregistrements pour les élèves non présents (ABSENCE ou LATE)
            const recordsToInsert = records
                .filter((r: any) => r.type !== "PRESENT")
                .map((r: any) => ({
                    studentId: r.studentId,
                    type: r.type,
                    severity: "LOW",
                    date: attendanceDate,
                    description: r.description || (r.type === "ABSENCE" ? "Absent à l'appel" : "Arrivé en retard"),
                    schoolMatricule: resolvedMatricule,
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
