import { NextResponse } from "next/server";
import { checkLicense } from "@/lib/license-check";

export async function GET() {
    try {
        const licenseStatus = await checkLicense();

        if (!licenseStatus.isValid || !licenseStatus.license) {
            return NextResponse.json(
                { error: licenseStatus.message || "Aucune licence active." },
                { status: 404 }
            );
        }

        const license = licenseStatus.license;
        const now = new Date();
        const endDate = new Date(license.endDate);
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return NextResponse.json({
            id: license.id,
            type: license.type,
            customName: license.customName ?? null,
            status: license.status,
            startDate: license.startDate,
            endDate: license.endDate,
            daysLeft: Math.max(0, daysLeft),
        });
    } catch (error) {
        console.error("GET /api/license error:", error);
        return NextResponse.json(
            { error: "Erreur lors de la recuperation de la licence." },
            { status: 500 }
        );
    }
}
