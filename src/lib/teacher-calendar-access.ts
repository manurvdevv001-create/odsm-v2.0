import { getClassroomLevel, parseAssignedClassrooms, resolveClassroomNames } from "@/lib/classroom-utils";
import { matchTeacherName } from "@/lib/utils";

export type TeacherCalendarLevel = "maternelle" | "primaire" | "secondaire";

const LEVEL_ORDER: TeacherCalendarLevel[] = ["maternelle", "primaire", "secondaire"];

function parseAssignedCourses(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseAssignedLevels(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== "string" || !value.trim()) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
    } catch {
        return [value];
    }
}

function academicLevelsIn(value: unknown): TeacherCalendarLevel[] {
    const normalized = String(value || "").trim().toLowerCase();
    return LEVEL_ORDER.filter(level => normalized.includes(level));
}

function isLevelEnabled(schoolData: Record<string, any>, level: TeacherCalendarLevel) {
    const configured = schoolData.levels;
    if (!configured || typeof configured !== "object" || Object.keys(configured).length === 0) return true;
    return Boolean(configured[level] ?? configured[level.toUpperCase()]);
}

export function getTeacherCalendarLevels(user: any, schoolData: Record<string, any>): TeacherCalendarLevel[] {
    const profile = user?.profile || {};
    const classrooms = Array.isArray(schoolData.classrooms) ? schoolData.classrooms : [];
    const classroomRefs = new Set<string>(parseAssignedClassrooms(profile.assignedClassroom));
    const timetables = schoolData.timetables && typeof schoolData.timetables === "object"
        ? schoolData.timetables as Record<string, Record<string, any>>
        : {};

    for (const assignment of parseAssignedCourses(profile.assignedCourses)) {
        if (typeof assignment === "object" && assignment !== null && "classroom" in assignment) {
            const classroom = (assignment as { classroom?: unknown }).classroom;
            if (typeof classroom === "string" && classroom.trim()) classroomRefs.add(classroom);
        }
    }

    const teacherName = user?.name || [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    for (const [classroomRef, slots] of Object.entries(timetables)) {
        if (Object.values(slots || {}).some(slot => slot?.teacher && matchTeacherName(teacherName, slot.teacher))) {
            classroomRefs.add(classroomRef);
        }
    }

    const classroomNames = resolveClassroomNames([...classroomRefs], classrooms);
    const assignedLevels = new Set<TeacherCalendarLevel>();
    for (const classroomName of classroomNames) {
        const level = getClassroomLevel(classroomName, schoolData);
        if (level) assignedLevels.add(level);
    }

    for (const value of [profile.level, ...parseAssignedLevels(profile.levels)]) {
        for (const level of academicLevelsIn(value)) assignedLevels.add(level);
    }

    return LEVEL_ORDER.filter(level => assignedLevels.has(level) && isLevelEnabled(schoolData, level));
}
