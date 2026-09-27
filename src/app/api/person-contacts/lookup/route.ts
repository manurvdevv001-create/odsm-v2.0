import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/phone-number";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const matricule = request.nextUrl.searchParams.get("matricule");
    const input = request.nextUrl.searchParams.get("phone");
    if (!matricule || !input) {
        return NextResponse.json({ error: "Matricule et téléphone requis." }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    if (session.matricule !== matricule) {
        return NextResponse.json({ error: "Accès refusé à cet établissement." }, { status: 403 });
    }

    const phone = normalizePhoneNumber(input);
    if (!phone) {
        return NextResponse.json({ error: "Le numéro de téléphone n'est pas valide." }, { status: 400 });
    }

    try {
        const contact = await db.personContact.findUnique({
            where: { schoolMatricule_phone: { schoolMatricule: matricule, phone: phone.e164 } },
            include: {
                guardian: { select: { id: true } },
                staffProfile: { select: { id: true } },
            },
        });

        if (contact) {
            return NextResponse.json({
                phone: phone.e164,
                contact: {
                    id: contact.id,
                    firstName: contact.firstName,
                    lastName: contact.lastName,
                    middleName: contact.middleName,
                    roles: {
                        guardian: !!contact.guardian,
                        staff: !!contact.staffProfile,
                    },
                },
            });
        }

        const [guardians, staff] = await Promise.all([
            db.guardian.findMany({
                where: { schoolMatricule: matricule, personContactId: null },
                select: { id: true, firstName: true, lastName: true, phone: true },
            }),
            db.staffProfile.findMany({
                where: { schoolMatricule: matricule, personContactId: null },
                select: { id: true, firstName: true, lastName: true, middleName: true, phone: true },
            }),
        ]);
        const legacyMatches = [
            ...guardians.filter(item => normalizePhoneNumber(item.phone)?.e164 === phone.e164).map(item => ({
                id: item.id,
                role: "guardian" as const,
                firstName: item.firstName,
                lastName: item.lastName,
                middleName: null,
            })),
            ...staff.filter(item => normalizePhoneNumber(item.phone || "")?.e164 === phone.e164).map(item => ({
                id: item.id,
                role: "staff" as const,
                firstName: item.firstName,
                lastName: item.lastName,
                middleName: item.middleName,
            })),
        ];

        return NextResponse.json({ phone: phone.e164, contact: null, legacyMatches });
    } catch (error) {
        console.error("Person contact lookup failed:", error);
        return NextResponse.json({ error: "Impossible de vérifier ce numéro pour le moment." }, { status: 500 });
    }
}
