import "dotenv/config";
import path from "node:path";
import { parsePhoneNumber } from "libphonenumber-js";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function normalizePhone(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
        const parsed = parsePhoneNumber(trimmed.replace(/^00\s*/, "+"), "CD");
        return parsed.isValid() ? parsed.number : null;
    } catch {
        return null;
    }
}

function createClient() {
    if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
        return new PrismaClient({
            adapter: new PrismaLibSql({
                url: process.env.TURSO_DATABASE_URL,
                authToken: process.env.TURSO_AUTH_TOKEN,
            }),
        });
    }

    const configuredUrl = process.env.DATABASE_URL || "file:./dev.db";
    const url = configuredUrl.startsWith("file:")
        ? `file:${path.resolve(process.cwd(), configuredUrl.slice(5)).replace(/\\/g, "/")}`
        : configuredUrl;
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

const applyChanges = process.argv.includes("--apply");
const db = createClient();

try {
    const [guardians, staff] = await Promise.all([
        db.guardian.findMany({
            where: { personContactId: null },
            select: { id: true, schoolMatricule: true, firstName: true, lastName: true, middleName: true, phone: true },
        }),
        db.staffProfile.findMany({
            where: { personContactId: null },
            select: { id: true, schoolMatricule: true, firstName: true, lastName: true, middleName: true, phone: true },
        }),
    ]);
    const groups = new Map();
    const invalid = [];
    const noPhoneStaff = [];

    for (const [role, records] of [["guardian", guardians], ["staff", staff]]) {
        for (const record of records) {
            if (!record.phone?.trim()) {
                if (role === "staff") noPhoneStaff.push({ role, record });
                else invalid.push({ role, record, reason: "Téléphone requis" });
                continue;
            }
            const phone = normalizePhone(record.phone);
            if (!phone) {
                invalid.push({ role, record, reason: "Numéro invalide" });
                continue;
            }
            const key = `${record.schoolMatricule}\u0000${phone}`;
            const entries = groups.get(key) || [];
            entries.push({ role, record, phone });
            groups.set(key, entries);
        }
    }

    const conflicts = [];
    const backfillable = [];
    for (const entries of groups.values()) {
        if (entries.length > 1) conflicts.push(entries);
        else backfillable.push(entries[0]);
    }

    console.log(JSON.stringify({
        mode: applyChanges ? "apply" : "audit-only",
        summary: {
            uniquePhoneRecords: backfillable.length,
            noPhoneStaff: noPhoneStaff.length,
            conflicts: conflicts.length,
            invalid: invalid.length,
        },
        conflicts: conflicts.map(entries => entries.map(({ role, record, phone }) => ({
            schoolMatricule: record.schoolMatricule,
            phone,
            role,
            id: record.id,
            name: `${record.lastName} ${record.middleName || ""} ${record.firstName}`.trim(),
        }))),
        invalid: invalid.map(({ role, record, reason }) => ({
            schoolMatricule: record.schoolMatricule,
            role,
            id: record.id,
            name: `${record.lastName} ${record.middleName || ""} ${record.firstName}`.trim(),
            reason,
        })),
    }, null, 2));

    if (applyChanges) {
        for (const { role, record, phone } of backfillable) {
            await db.$transaction(async tx => {
                const contact = await tx.personContact.create({
                    data: {
                        schoolMatricule: record.schoolMatricule,
                        phone,
                        firstName: record.firstName,
                        lastName: record.lastName,
                        middleName: record.middleName,
                    },
                });
                await tx[role === "guardian" ? "guardian" : "staffProfile"].update({
                    where: { id: record.id },
                    data: { personContactId: contact.id, phone },
                });
            });
        }
        for (const { record } of noPhoneStaff) {
            await db.$transaction(async tx => {
                const contact = await tx.personContact.create({
                    data: {
                        schoolMatricule: record.schoolMatricule,
                        phone: null,
                        firstName: record.firstName,
                        lastName: record.lastName,
                        middleName: record.middleName,
                    },
                });
                await tx.staffProfile.update({
                    where: { id: record.id },
                    data: { personContactId: contact.id },
                });
            });
        }
        console.log(`Rapprochement appliqué à ${backfillable.length + noPhoneStaff.length} fiche(s); ${conflicts.length} conflit(s) et ${invalid.length} numéro(s) invalide(s) laissés inchangés.`);
    }
} finally {
    await db.$disconnect();
}
