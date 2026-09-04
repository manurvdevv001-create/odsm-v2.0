// src/app/api/admin/annual-closures/route.ts
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-logger";

import { getSession } from "@/lib/auth";

const norm = (s: string) => s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() ?? "";

/**
 * GET: Check closure status for a classroom or a full grade (level)
 * Query: classroomId?, gradeId?, schoolYear?
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get("classroomId");
    const gradeId = searchParams.get("gradeId");
    const schoolYear = searchParams.get("schoolYear");

    try {
        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = schoolYear || calendar?.schoolYear;

        if (classroomId) {
            // Check if a specific classroom is closed
            const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
            const classroom = allClassrooms.find((c: any) => c.id === classroomId || norm(c.name) === norm(classroomId));

            if (!classroom) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });

            const closure = await (db as any).annualClosure.findFirst({
                where: {
                    schoolYear: activeYear,
                    schoolMatricule: school.matricule,
                    entityType: 'CLASSROOM',
                    entityId: classroom.id
                }
            });

            // Count students with and without decisions
            const students = await db.student.findMany({
                where: {
                    schoolMatricule: school.matricule,
                    classroomName: classroom.name,
                    schoolYear: activeYear,
                    status: { in: ["active", "pending_payment"] }
                }
            });
            const studentIds = students.map((s: any) => s.id);
            const decisions = studentIds.length > 0
                ? await (db as any).annualDecision.findMany({
                    where: { studentId: { in: studentIds }, schoolYear: activeYear, schoolMatricule: school.matricule }
                })
                : [];
            const studentsWithDecision = decisions.length;
            const allHaveDecisions = students.length > 0 && studentsWithDecision === students.length;

            return NextResponse.json({
                classroomId: classroom.id,
                classroomName: classroom.name,
                schoolYear: activeYear,
                isClosed: !!closure,
                closure: closure || null,
                totalStudents: students.length,
                studentsWithDecision,
                allHaveDecisions,
                canClose: allHaveDecisions && !closure
            });
        }

        if (gradeId) {
            // Check if all classrooms for a grade are closed
            const classrooms = await db.classroom.findMany({
                where: { schoolMatricule: school.matricule, gradeId }
            });

            const closures = await (db as any).annualClosure.findMany({
                where: {
                    schoolYear: activeYear,
                    schoolMatricule: school.matricule,
                    entityType: 'CLASSROOM',
                    entityId: { in: classrooms.map((c: any) => c.id) }
                }
            });

            const closedIds = new Set(closures.map((c: any) => c.entityId));
            const allClassroomsClosed = classrooms.length > 0 && classrooms.every((c: any) => closedIds.has(c.id));

            const gradeClosure = await (db as any).annualClosure.findFirst({
                where: {
                    schoolYear: activeYear,
                    schoolMatricule: school.matricule,
                    entityType: 'GRADE',
                    entityId: gradeId
                }
            });

            const classroomStatus = classrooms.map((c: any) => ({
                id: c.id,
                name: c.name,
                isClosed: closedIds.has(c.id)
            }));

            return NextResponse.json({
                gradeId,
                schoolYear: activeYear,
                classroomStatus,
                allClassroomsClosed,
                isGradeClosed: !!gradeClosure,
                gradeClosure: gradeClosure || null,
                canCloseGrade: allClassroomsClosed && !gradeClosure
            });
        }

        // Return all closure statuses for the year
        const allClosures = await (db as any).annualClosure.findMany({
            where: { schoolYear: activeYear, schoolMatricule: school.matricule }
        });
        return NextResponse.json({ closures: allClosures, schoolYear: activeYear });

    } catch (error: any) {
        console.error("[Annual Closures GET]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST: Close a classroom or a full grade for the year
 * Body: { entityType: 'CLASSROOM'|'GRADE', entityId, closedByUserId, closedByName? }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { entityType, entityId, closedByUserId, closedByName } = body;

        if (!entityType || !entityId || !closedByUserId) {
            return NextResponse.json({ error: "entityType, entityId et closedByUserId sont requis" }, { status: 400 });
        }

        if (!['CLASSROOM', 'GRADE'].includes(entityType)) {
            return NextResponse.json({ error: "entityType doit être CLASSROOM ou GRADE" }, { status: 400 });
        }

        const session = await getSession();
        const school = session ? await db.school.findUnique({ where: { matricule: session.matricule } }) : await db.school.findFirst();
        if (!school) return NextResponse.json({ error: "École introuvable" }, { status: 404 });

        const calendar = typeof school.calendar === 'string' ? JSON.parse(school.calendar) : school.calendar;
        const activeYear = calendar?.schoolYear;

        // Guard: for GRADE closure, all classrooms of that grade must be closed
        if (entityType === 'GRADE') {
            const classrooms = await db.classroom.findMany({
                where: { schoolMatricule: school.matricule, gradeId: entityId }
            });
            const closures = await (db as any).annualClosure.findMany({
                where: {
                    schoolYear: activeYear,
                    schoolMatricule: school.matricule,
                    entityType: 'CLASSROOM',
                    entityId: { in: classrooms.map((c: any) => c.id) }
                }
            });
            if (closures.length < classrooms.length) {
                return NextResponse.json({
                    error: "Impossible de clôturer le niveau : tous les locaux doivent être clôturés d'abord."
                }, { status: 400 });
            }
        }

        // Guard: for CLASSROOM closure, all students must have a decision
        if (entityType === 'CLASSROOM') {
            const allClassrooms = await db.classroom.findMany({ where: { schoolMatricule: school.matricule } });
            const classroom = allClassrooms.find((c: any) => c.id === entityId);
            if (classroom) {
                const students = await db.student.findMany({
                    where: {
                        schoolMatricule: school.matricule,
                        classroomName: classroom.name,
                        schoolYear: activeYear,
                        status: { in: ["active", "pending_payment"] }
                    }
                });
                const studentIds = students.map((s: any) => s.id);
                const decisions = studentIds.length > 0
                    ? await (db as any).annualDecision.findMany({
                        where: { studentId: { in: studentIds }, schoolYear: activeYear, schoolMatricule: school.matricule }
                    })
                    : [];
                if (decisions.length < students.length) {
                    return NextResponse.json({
                        error: `Clôture impossible : ${students.length - decisions.length} élève(s) sans décision de fin d'année.`
                    }, { status: 400 });
                }
            }
        }

        // Check not already closed
        const existing = await (db as any).annualClosure.findFirst({
            where: { schoolYear: activeYear, schoolMatricule: school.matricule, entityType, entityId }
        });
        if (existing) {
            return NextResponse.json({ error: "Cet entité est déjà clôturée pour cette année." }, { status: 409 });
        }

        const closure = await (db as any).annualClosure.create({
            data: {
                schoolYear: activeYear,
                schoolMatricule: school.matricule,
                entityType,
                entityId,
                closedByUserId
            }
        });

        // Log activity
        await logActivity(
            school.matricule,
            `Clôture annuelle (${activeYear}) : ${entityType === 'CLASSROOM' ? 'Local' : 'Niveau'} [${entityId}] clôturé par ${closedByName || closedByUserId}`,
            closedByName || closedByUserId,
            "warning",
            activeYear,
            { entityType, entityId, schoolYear: activeYear }
        );

        return NextResponse.json({ success: true, closure });
    } catch (error: any) {
        console.error("[Annual Closures POST]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
