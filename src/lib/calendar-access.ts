import { getClassroomLevel, resolveClassroomNames } from "./classroom-utils";
import { getUserRestrictions } from "./role-permissions";

export type AcademicLevel = "maternelle" | "primaire" | "secondaire";

const LEVELS: AcademicLevel[] = ["maternelle", "primaire", "secondaire"];

export function sortAcademicLevels(levels: AcademicLevel[]): AcademicLevel[] {
    const visible = new Set(levels);
    return LEVELS.filter(level => visible.has(level));
}

function normalizeLevel(value: unknown): AcademicLevel | null {
    const normalized = String(value || "").trim().toLowerCase();
    return LEVELS.includes(normalized as AcademicLevel) ? normalized as AcademicLevel : null;
}

function parseAssignedCourses(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map(course => typeof course === "object" && course !== null ? (course as { classroom?: unknown }).classroom : null)
            .filter((classroom): classroom is string => typeof classroom === "string" && classroom.trim() !== "");
    }
    if (typeof value !== "string") return [];
    try {
        return parseAssignedCourses(JSON.parse(value));
    } catch {
        return [];
    }
}

export function getVisibleCalendarLevels(user: any, schoolData: Record<string, any>): AcademicLevel[] {
    const configuredLevels = schoolData?.levels || {};
    const enabledLevels = LEVELS.filter(level =>
        Boolean(configuredLevels[level] ?? configuredLevels[level.toUpperCase()])
    );
    const isEnabled = (level: AcademicLevel) => enabledLevels.includes(level);
    const assignedRefs: string[] = [];
    const profile = user?.profile;

    if (profile?.assignedClassroom) {
        try {
            const parsed = JSON.parse(profile.assignedClassroom);
            if (Array.isArray(parsed)) assignedRefs.push(...parsed.map(String));
            else assignedRefs.push(String(parsed));
        } catch {
            assignedRefs.push(String(profile.assignedClassroom));
        }
    }
    assignedRefs.push(...parseAssignedCourses(profile?.assignedCourses));

    const classroomNames = resolveClassroomNames(
        assignedRefs.filter(Boolean),
        Array.isArray(schoolData.classrooms) ? schoolData.classrooms : []
    );
    const assignedLevels = classroomNames
        .map(classroom => getClassroomLevel(classroom, schoolData))
        .filter((level): level is AcademicLevel => level !== null);

    const role = String(user?.role || "").toUpperCase();
    if (role === "TEACHER") {
        const profileLevel = normalizeLevel(profile?.level);
        return sortAcademicLevels(Array.from(new Set([
            ...assignedLevels.filter(isEnabled),
            ...(profileLevel && isEnabled(profileLevel) ? [profileLevel] : [])
        ])));
    }

    const restrictions = getUserRestrictions(user);
    const restrictedClassroomNames = resolveClassroomNames(
        restrictions.classrooms,
        Array.isArray(schoolData.classrooms) ? schoolData.classrooms : []
    );
    const restrictedClassroomLevels = restrictedClassroomNames
        .map(classroom => getClassroomLevel(classroom, schoolData))
        .filter((level): level is AcademicLevel => level !== null);
    const restrictedLevels = restrictions.levels
        .map(normalizeLevel)
        .filter((level): level is AcademicLevel => level !== null);
    const levels = [...restrictedLevels, ...assignedLevels, ...restrictedClassroomLevels];

    if (restrictions.levels.length === 0 && restrictions.classrooms.length === 0) {
        return enabledLevels.filter(level => schoolData.calendar?.[level]);
    }

    return sortAcademicLevels(Array.from(new Set(levels.filter(isEnabled))));
}
