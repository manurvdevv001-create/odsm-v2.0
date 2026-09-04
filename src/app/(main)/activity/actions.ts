"use server";

import { db } from "@/lib/db";

export type ActivityFilter = {
    searchTerm?: string;
    startDate?: string;
    endDate?: string;
    schoolYear?: string;
    limit?: number;
    offset?: number;
};

export async function getActivities(matricule: string, filters: ActivityFilter = {}) {
    try {
        const { searchTerm, startDate, endDate, schoolYear, limit = 50, offset = 0 } = filters;

        const where: any = {
            schoolMatricule: matricule,
        };

        // 1. Search term (description or user)
        if (searchTerm) {
            where.OR = [
                { description: { contains: searchTerm } },
                { user: { contains: searchTerm } }
            ];
        }

        // 2. Date Range (Execution period)
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }

        // 3. Contextual School Year
        if (schoolYear && schoolYear !== "all") {
            where.schoolYear = schoolYear;
        }

        const [activities, total] = await Promise.all([
            db.activityLog.findMany({
                where,
                orderBy: { timestamp: "desc" },
                take: limit,
                skip: offset
            }),
            db.activityLog.count({ where })
        ]);

        return {
            success: true,
            activities,
            total,
            limit,
            offset
        };
    } catch (error) {
        console.error("getActivities error:", error);
        return { success: false, error: "Erreur lors de la récupération des activités." };
    }
}

export async function getUniqueYearsFromLogs(matricule: string) {
    try {
        const years = await db.activityLog.findMany({
            where: { schoolMatricule: matricule },
            select: { schoolYear: true },
            distinct: ['schoolYear']
        });
        return years.map((y: any) => y.schoolYear).filter(Boolean) as string[];
    } catch (error) {
        return [];
    }
}
export async function getActivityById(id: string) {
    try {
        const activity = await db.activityLog.findUnique({
            where: { id }
        });
        return { success: true, activity };
    } catch (error) {
        return { success: false, error: "Activité introuvable." };
    }
}
