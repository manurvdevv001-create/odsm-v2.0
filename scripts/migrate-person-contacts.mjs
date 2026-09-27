import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
    throw new Error("TURSO_DATABASE_URL est requis pour mettre à jour le schéma cloud.");
}
if (!url.startsWith("file:") && !authToken) {
    throw new Error("TURSO_AUTH_TOKEN est requis pour la base Turso distante.");
}

const client = createClient({ url, ...(authToken ? { authToken } : {}) });

async function tableColumns(table) {
    const result = await client.execute(`PRAGMA table_info("${table}")`);
    return new Set(result.rows.map(row => String(row.name)));
}

async function requireTable(table) {
    const result = await client.execute({
        sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [table],
    });
    if (result.rows.length === 0) {
        throw new Error(`La table requise ${table} est introuvable. Migration arrêtée sans modification.`);
    }
    return tableColumns(table);
}

try {
    const [staffColumns, guardianColumns, schoolColumns] = await Promise.all([
        requireTable("StaffProfile"),
        requireTable("Guardian"),
        requireTable("School"),
    ]);
    if (!schoolColumns.has("matricule")) {
        throw new Error("La colonne School.matricule est introuvable. Migration arrêtée sans modification.");
    }

    const personContact = await client.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'PersonContact'",
    );
    if (personContact.rows.length === 0) {
        await client.execute(`
            CREATE TABLE "PersonContact" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "schoolMatricule" TEXT NOT NULL,
                "phone" TEXT,
                "lastName" TEXT NOT NULL,
                "middleName" TEXT,
                "firstName" TEXT NOT NULL,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" DATETIME NOT NULL,
                CONSTRAINT "PersonContact_schoolMatricule_fkey"
                    FOREIGN KEY ("schoolMatricule") REFERENCES "School" ("matricule")
                    ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);
    } else {
        const columns = await tableColumns("PersonContact");
        const required = ["id", "schoolMatricule", "phone", "lastName", "middleName", "firstName", "createdAt", "updatedAt"];
        const missing = required.filter(column => !columns.has(column));
        if (missing.length) {
            throw new Error(`La table PersonContact existe mais il lui manque : ${missing.join(", ")}. Migration arrêtée.`);
        }
    }

    if (!staffColumns.has("personContactId")) {
        await client.execute(`
            ALTER TABLE "StaffProfile"
            ADD COLUMN "personContactId" TEXT
            REFERENCES "PersonContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        `);
    }
    if (!guardianColumns.has("personContactId")) {
        await client.execute(`
            ALTER TABLE "Guardian"
            ADD COLUMN "personContactId" TEXT
            REFERENCES "PersonContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        `);
    }
    if (!guardianColumns.has("middleName")) {
        await client.execute('ALTER TABLE "Guardian" ADD COLUMN "middleName" TEXT');
    }

    await client.batch([
        'CREATE UNIQUE INDEX IF NOT EXISTS "PersonContact_schoolMatricule_phone_key" ON "PersonContact" ("schoolMatricule", "phone")',
        'CREATE INDEX IF NOT EXISTS "PersonContact_schoolMatricule_idx" ON "PersonContact" ("schoolMatricule")',
        'CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_personContactId_key" ON "StaffProfile" ("personContactId")',
        'CREATE UNIQUE INDEX IF NOT EXISTS "Guardian_personContactId_key" ON "Guardian" ("personContactId")',
    ], "write");

    console.log("Schéma PersonContact appliqué et vérifié. Aucune fiche existante n'a été modifiée.");
} finally {
    client.close();
}
