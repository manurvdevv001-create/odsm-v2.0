// src/app/api/admin/annual-decisions/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

const norm = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() ?? "";
const VALID_DECISIONS = ['PROMU', 'MAINTENU', 'DEMIS', 'EXCLU', 'RETIRE'];

/**
 * GET: Fetch students + their annual decisions for a classroom
 * Query params: classroomId (name or UUID), schoolYear?
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get("classroomId");
    const schoolYear = searchParams.get("schoolYear");

    try {
        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = schoolYear || calendar?.schoolYear;

        // Resolve classroom by ID or name
        let classroom: any = null;
        if (classroomId) {
            const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
            classroom = allClassrooms.find((c: any) => c.id === classroomId || norm(c.name) === norm(classroomId));
        }

        const resolvedName = classroom?.name || classroomId;

        // Fetch students
        const students = await db.student.findMany({
            where: {
                schoolMatricule: school.matricule,
                classroomName: resolvedName,
                schoolYear: activeYear,
                status: { in: ["active", "pending_payment"] }
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
        });

        const studentIds = students.map((s: any) => s.id);

        // Fetch existing decisions
        const decisions = studentIds.length > 0
            ? await (db as any).annualDecision.findMany({
                where: { studentId: { in: studentIds }, schoolYear: activeYear, schoolMatricule: school.matricule }
            })
            : [];

        const decisionMap: Record<string, any> = {};
        decisions.forEach((d: any) => { decisionMap[d.studentId] = d; });

        // Fetch all grades for dropdown population
        const grades = await db.grade.findMany({
            where: { schoolMatricule: school.matricule },
            orderBy: { displayOrder: 'asc' }
        });

        // Check if classroom is already closed for the current year
        const annualClosure = await (db as any).annualClosure.findFirst({
            where: {
                schoolYear: activeYear,
                schoolMatricule: school.matricule,
                entityType: 'CLASSROOM',
                entityId: classroom?.id || classroomId || ""
            }
        });

        const result = students.map((s: any) => ({
            id: s.id,
            matricule: s.matricule,
            firstName: s.firstName,
            lastName: s.lastName,
            middleName: s.middleName,
            gradeName: s.gradeName,
            classroomName: s.classroomName,
            status: s.status,
            annualDecision: decisionMap[s.id] || null
        }));

        return NextResponse.json({
            students: result,
            grades,
            schoolYear: activeYear,
            classroomId: classroom?.id || classroomId,
            classroomName: resolvedName,
            annualClosure: annualClosure || null
        });
    } catch (error: any) {
        console.error("[Annual Decisions GET]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT: Bulk upsert decisions for an entire classroom
 * Body: { classroomId, decisions: [{ studentId, decision, targetGradeId? }] }
 */
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { classroomId, decisions } = body;

        if (!decisions || !Array.isArray(decisions)) {
            return NextResponse.json({ error: "decisions (array) requis" }, { status: 400 });
        }

        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear;

        // Resolve classroom
        const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
        const classroom = allClassrooms.find((c: any) => c.id === classroomId || norm(c.name) === norm(classroomId || ""));

        let count = 0;
        for (const dec of decisions) {
            const { studentId, decision, targetGradeId } = dec;
            if (!studentId || !decision) continue;
            if (!VALID_DECISIONS.includes(decision)) continue;

            const existing = await (db as any).annualDecision.findFirst({
                where: { studentId, schoolYear: activeYear, schoolMatricule: school.matricule }
            });

            if (existing) {
                await (db as any).annualDecision.update({
                    where: { id: existing.id },
                    data: {
                        decision,
                        targetGradeId: targetGradeId || null,
                        fromClassroomId: classroom?.id || existing.fromClassroomId,
                        fromGradeId: classroom?.gradeId || existing.fromGradeId
                    }
                });
            } else {
                await (db as any).annualDecision.create({
                    data: {
                        studentId,
                        schoolYear: activeYear,
                        schoolMatricule: school.matricule,
                        fromClassroomId: classroom?.id || "",
                        fromGradeId: classroom?.gradeId || "",
                        decision,
                        targetGradeId: targetGradeId || null
                    }
                });
            }
            count++;
        }

        return NextResponse.json({ success: true, count });
    } catch (error: any) {
        console.error("[Annual Decisions PUT]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
