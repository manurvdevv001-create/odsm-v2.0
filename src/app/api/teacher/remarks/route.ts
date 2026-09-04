// src/app/api/teacher/remarks/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classroomId = searchParams.get("classroomId"); // To fetch all remarks for a class

    try {
        if (studentId) {
            const remarks = await db.disciplineRecord.findMany({
                where: { studentId },
                orderBy: { date: 'desc' }
            });
            return NextResponse.json(remarks);
        }

        if (classroomId) {
            // Fetch remarks for all students in a classroom
            const remarks = await db.disciplineRecord.findMany({
                where: {
                    student: {
                        classroomName: classroomId // Again, using name as ref for now
                    }
                },
                include: {
                    student: true
                },
                orderBy: { date: 'desc' }
            });
            return NextResponse.json(remarks);
        }

        return NextResponse.json({ error: "studentId ou classroomId requis" }, { status: 400 });
    } catch (error) {
        console.error("GET Remarks Error:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { 
            studentId, 
            type, 
            severity, 
            description, 
            schoolMatricule 
        } = body;

        if (!studentId || !type || !description || !schoolMatricule) {
            return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
        }

        const newRemark = await db.disciplineRecord.create({
            data: {
                studentId,
                type, // OBSERVATION, SANCTION, LATE, ABSENCE
                severity: severity || "LOW",
                description,
                date: new Date(),
                schoolMatricule,
                status: "PENDING"
            }
        });

        return NextResponse.json({ success: true, data: newRemark });
    } catch (error: any) {
        console.error("POST Remarks Error:", error);
        return NextResponse.json({ error: error.message || "Erreur lors de l'enregistrement" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    try {
        await db.disciplineRecord.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Erreur lors de la suppression" }, { status: 500 });
    }
}
