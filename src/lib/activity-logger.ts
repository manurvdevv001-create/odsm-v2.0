import { db } from "@/lib/db";

export type Activity = {
    timestamp: string;
    description: string;
    user?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    schoolYear?: string;
};

/**
 * Formats a name and ID into "Name (ID)" format.
 */
export function formatLogEntity(name: string, id: string | null | undefined): string {
    if (!id) return name;
    return `${name} (${id})`;
}

/**
 * Logs an activity to the school's activity log column.
 */
export async function logActivity(
    matricule: string, 
    description: string, 
    user: string = "Système", 
    type: Activity['type'] = 'info',
    schoolYear?: string,
    metadata: Record<string, any> = {}
) {
    if (!matricule) return;

    try {
        const school = await db.school.findUnique({
            where: { matricule },
            select: { calendar: true }
        });

        if (school) {
            // Fallback to active year if not provided
            let year = schoolYear;
            if (!year) {
                try {
                    const cal = JSON.parse(school.calendar || "{}");
                    year = cal.schoolYear;
                } catch (e) {}
            }

            // 1. Create entry in new ActivityLog table
            await db.activityLog.create({
                data: {
                    description,
                    user,
                    type: type || 'info',
                    schoolYear: year,
                    schoolMatricule: matricule,
                    timestamp: new Date(),
                    metadata: JSON.stringify(metadata)
                }
            });

            // 2. (Optional/Backward compatibility) Keep JSON log updated but limited to 50 for quick display
            const schoolData = await db.school.findUnique({
                where: { matricule },
                select: { activityLog: true }
            });

            if (schoolData) {
                let currentLog: Activity[] = [];
                try {
                    currentLog = JSON.parse(schoolData.activityLog || "[]");
                    if (!Array.isArray(currentLog)) currentLog = [];
                } catch (e) {}

                const newActivity: Activity = {
                    timestamp: new Date().toISOString(),
                    description,
                    user,
                    type,
                    schoolYear: year
                };

                const updatedLog = [newActivity, ...currentLog].slice(0, 50);

                await db.school.update({
                    where: { matricule },
                    data: {
                        activityLog: JSON.stringify(updatedLog)
                    }
                });
            }
        }
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}
