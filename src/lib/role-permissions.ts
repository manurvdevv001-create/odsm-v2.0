// src/lib/role-permissions.ts
// Centralized role-based permissions for ODSM

import { parseAssignedClassrooms } from "./classroom-utils";

import {
    LayoutDashboard,
    Users,
    Banknote,
    GraduationCap,
    Calendar,
    Settings,
    History,
    School,
    BookOpen,
    CalendarDays,
} from "lucide-react";

export type SystemRole =
    | "ADMIN"
    | "ADMIN_SYSTEM"
    | "SUPERADMIN"
    | "SUPERVISOR"
    | "PREFET"
    | "SECRETARY"
    | "CASHIER"
    | "SECRETARY_CASHIER"
    | "DISCIPLINE"
    | "TEACHER";

export interface NavItem {
    href: string;
    label: string;
    icon: any;
}

// All possible nav items
const ALL_NAV_ITEMS: NavItem[] = [
    { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/teacher", label: "Espace Enseignant", icon: BookOpen },
    { href: "/students", label: "Élèves", icon: Users },
    { href: "/finances", label: "Finances", icon: Banknote },
    { href: "/staff", label: "Personnel", icon: GraduationCap },
    { href: "/classrooms", label: "Locaux", icon: School },
    { href: "/timetable", label: "Horaires", icon: Calendar },
    { href: "/calendar", label: "Calendrier Scolaire", icon: CalendarDays },
    { href: "/activity", label: "Journal", icon: History },
    { href: "/settings", label: "Paramètres", icon: Settings },
    { href: "/settings/calendar", label: "Calendrier Scolaire", icon: CalendarDays },
];

// Routes each role is allowed to access
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
    // Admin roles — full access (except teacher portal)
    ADMIN: ["/dashboard", "/students", "/finances", "/staff", "/classrooms", "/timetable", "/calendar", "/activity", "/settings"],
    ADMIN_SYSTEM: ["/dashboard", "/activity", "/calendar", "/settings", "/settings/users", "/settings/backups"],
    SUPERADMIN: ["/dashboard", "/students", "/finances", "/staff", "/classrooms", "/timetable", "/calendar", "/activity", "/settings"],

    // Supervisor / Directeur — read-only visualization + category migration in finance
    SUPERVISOR: ["/dashboard", "/finances", "/staff", "/classrooms", "/timetable", "/calendar", "/activity", "/settings/users", "/settings/finance", "/settings/calendar"],

    // Secretary — everything except Finances, Personnel, Journal, Paramètres; gets Calendrier Scolaire
    SECRETARY: ["/dashboard", "/students", "/classrooms", "/timetable", "/calendar", "/settings/calendar"],

    // Cashier (Percepteur) — only Finances + Dashboard
    CASHIER: ["/dashboard", "/finances", "/calendar"],

    // Secretary + Cashier — union of both
    SECRETARY_CASHIER: ["/dashboard", "/students", "/finances", "/classrooms", "/timetable", "/calendar", "/settings/calendar"],

    // Teacher — only teacher portal
    TEACHER: ["/teacher", "/calendar"],

    // Préfet des Études (Directeur de discipline) — supervisor of discipline + visualization
    PREFET: ["/dashboard", "/classrooms", "/timetable", "/calendar", "/activity"],

    // Discipline — attendance, conduct, discipline journal
    DISCIPLINE: ["/dashboard", "/classrooms", "/timetable", "/calendar", "/activity"],
};

/**
 * Get navigation items for a given role
 */
export function getNavItems(role: string): NavItem[] {
    const normalizedRole = (role || "").toUpperCase();
    const allowedRoutes = ROLE_ALLOWED_ROUTES[normalizedRole] || ["/dashboard"];

    const items = ALL_NAV_ITEMS.filter(item => allowedRoutes.includes(item.href));

    // If role has settings sub-pages (e.g. SUPERVISOR), include the main settings nav item
    const hasSettingsSubPages = allowedRoutes.some(r => r.startsWith("/settings/"));
    const hasSettingsNav = items.some(i => i.href === "/settings");
    if (hasSettingsSubPages && !hasSettingsNav) {
        const settingsItem = ALL_NAV_ITEMS.find(i => i.href === "/settings");
        if (settingsItem) items.push(settingsItem);
    }

    return items;
}

/**
 * Check if a role is an "office" role (Secrétariat/Perception)
 */
export function isOfficeRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "SECRETARY" || r === "CASHIER" || r === "SECRETARY_CASHIER";
}

/**
 * Check if a role is an admin-level role
 */
export function isAdminRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "ADMIN" || r === "SUPERADMIN" || r === "ADMIN_SYSTEM";
}

/**
 * Get display label for the header badge
 */
export function getRoleDisplayLabel(role: string): string {
    const r = (role || "").toUpperCase();
    const labels: Record<string, string> = {
        ADMIN: "ADMINISTRATEUR GÉNÉRAL",
        ADMIN_SYSTEM: "ADMIN SYSTÈME & BACKUPS",
        SUPERADMIN: "SUPER ADMIN",
        SUPERVISOR: "SUPERVISEUR",
        SECRETARY: "SECRÉTAIRE",
        CASHIER: "PERCEPTEUR",
        SECRETARY_CASHIER: "SEC. & PERCEPT.",
        TEACHER: "ENSEIGNANT",
        PREFET: "PRÉFET DES ÉTUDES",
        DISCIPLINE: "DISCIPLINE",
    };
    return labels[r] || r;
}

/**
 * Get the initial letter for the user avatar in the header
 */
export function getRoleAvatarLetter(role: string): string {
    const r = (role || "").toUpperCase();
    const letters: Record<string, string> = {
        ADMIN: "A",
        ADMIN_SYSTEM: "S",
        SUPERADMIN: "S",
        SUPERVISOR: "D",
        SECRETARY: "S",
        CASHIER: "P",
        SECRETARY_CASHIER: "SP",
        TEACHER: "E",
        PREFET: "P",
        DISCIPLINE: "D",
    };
    return letters[r] || "U";
}

/**
 * Check if a specific route is allowed for a role
 */
export function isRouteAllowed(role: string, pathname: string): boolean {
    const normalizedRole = (role || "").toUpperCase();

    // Admin roles have access to everything (except teacher portal)
    if (isAdminRole(normalizedRole)) {
        if (normalizedRole === "ADMIN_SYSTEM") {
            const allowedRoutes = ROLE_ALLOWED_ROUTES.ADMIN_SYSTEM || ["/dashboard"];
            return allowedRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
        }
        return pathname !== "/teacher";
    }

    // Teacher only has access to /teacher
    if (normalizedRole === "TEACHER") {
        return pathname.startsWith("/teacher");
    }

    // Supervisor can access specific settings sub-pages
    if (normalizedRole === "SUPERVISOR") {
        if (pathname === "/settings" || pathname.startsWith("/settings/")) {
            const allowedSettingsPaths = ["/settings/users", "/settings/finance", "/settings/calendar"];
            // Allow the main settings page (hub) and specific sub-pages
            if (pathname === "/settings") return true;
            return allowedSettingsPaths.some(p => pathname === p || pathname.startsWith(p + "/"));
        }
    }

    const allowedRoutes = ROLE_ALLOWED_ROUTES[normalizedRole] || ["/dashboard"];

    // Check if the pathname starts with any allowed route
    return allowedRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
}

/**
 * Check if the Finances page should show restricted tabs (no Catégories/Rapports)
 */
export function isFinanceRestricted(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "CASHIER" || r === "SECRETARY_CASHIER";
}

/**
 * Check if the Finances page should hide the Journal de Caisse tab
 */
export function isFinanceJournalHidden(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "SUPERVISOR";
}

/**
 * Check if the role is a Supervisor (read-only director)
 */
export function isSupervisorRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "SUPERVISOR";
}

/**
 * Check if the role is a Discipline-related role
 */
export function isDisciplineRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "DISCIPLINE" || r === "PREFET";
}

/**
 * Check if the role is a Prefet (Directeur de discipline — supervisor of discipline)
 */
export function isPrefetRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "PREFET";
}

/**
 * Check if a role operates in read-only mode (no modifications allowed)
 */
export function isReadOnlyRole(role: string): boolean {
    const r = (role || "").toUpperCase();
    return r === "SUPERVISOR" || r === "PREFET";
}

/**
 * Get the home href for a role
 */
export function getHomeHref(role: string): string {
    const r = (role || "").toUpperCase();
    return r === "TEACHER" ? "/teacher" : "/dashboard";
}

/**
 * Get data access restrictions for a user based on their staff profile
 * @returns Object containing allowed levels and classrooms. Empty arrays mean no restriction.
 */
export function getUserRestrictions(user: any): { levels: string[], classrooms: string[] } {
    if (!user || !user.profile) return { levels: [], classrooms: [] };
    
    // Si c'est un enseignant, on ne filtre pas par ce biais (logique à part)
    if (user.role?.toUpperCase() === "TEACHER") return { levels: [], classrooms: [] };

    let levels = user.profile.levels || [];
    if (!Array.isArray(levels) && typeof levels === 'string') {
        try { levels = JSON.parse(levels); } catch { levels = []; }
    }
    if (!Array.isArray(levels)) levels = [];
    if (levels.length === 0 && user.profile.level) {
        levels = [user.profile.level];
    }
    levels = levels.filter((l: string) => l && l.trim() !== '');
    
    let classrooms = user.profile.assignedClassrooms || [];
    if (!Array.isArray(classrooms)) {
        try {
            const parsed = typeof user.profile.assignedClassrooms === 'string' ? JSON.parse(user.profile.assignedClassrooms) : [];
            classrooms = Array.isArray(parsed) ? parsed : [];
        } catch {
            classrooms = [];
        }
    }
    if (classrooms.length === 0 && user.profile.assignedClassroom) {
        // assignedClassroom peut être un nom, un UUID, ou une chaîne JSON (tableau)
        classrooms = parseAssignedClassrooms(user.profile.assignedClassroom);
    }
    classrooms = classrooms.filter((c: string) => c && c.trim() !== '');

    // Note: If both are empty, it means the user has full access to the whole establishment
    return { levels, classrooms };
}
