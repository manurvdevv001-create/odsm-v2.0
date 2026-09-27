import { createClient } from "@libsql/client";

async function executeWithBusyRetry(operation) {
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            const isBusy = error && typeof error === "object" && "code" in error && error.code === "SQLITE_BUSY";
            if (!isBusy || attempt === maxAttempts - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.min(100 * 2 ** attempt, 1600)));
        }
    }
    throw new Error("Impossible d'obtenir un verrou d'écriture pour la migration du schéma.");
}

async function tableColumns(client, table) {
    const result = await client.execute(`PRAGMA table_info("${table}")`);
    return new Set(result.rows.map(row => String(row.name)));
}

async function requireTable(client, table) {
    const result = await client.execute({
        sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [table],
    });
    if (result.rows.length === 0) {
        throw new Error(`La table requise ${table} est introuvable. Migration arrêtée sans modification.`);
    }
    return tableColumns(client, table);
}

export async function migratePersonContactSchema(url, authToken) {
    if (!url) throw new Error("TURSO_DATABASE_URL est requis pour mettre à jour le schéma cloud.");
    if (!url.startsWith("file:") && !authToken) {
        throw new Error("TURSO_AUTH_TOKEN est requis pour la base Turso distante.");
    }

    const client = createClient({ url, ...(authToken ? { authToken } : {}) });
    try {
        await requireTable(client, "StaffProfile");
        await requireTable(client, "Guardian");
        const schoolColumns = await requireTable(client, "School");
        if (!schoolColumns.has("matricule")) {
            throw new Error("La colonne School.matricule est introuvable. Migration arrêtée sans modification.");
        }

        let changed = false;
        const personContact = await client.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'PersonContact'",
        );
        if (personContact.rows.length === 0) {
            await executeWithBusyRetry(() => client.execute(`
                CREATE TABLE IF NOT EXISTS "PersonContact" (
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
            `));
            changed = true;
        } else {
            const columns = await tableColumns(client, "PersonContact");
            const required = ["id", "schoolMatricule", "phone", "lastName", "middleName", "firstName", "createdAt", "updatedAt"];
            const missing = required.filter(column => !columns.has(column));
            if (missing.length) {
                throw new Error(`La table PersonContact existe mais il lui manque : ${missing.join(", ")}. Migration arrêtée.`);
            }
        }

        const addColumnIfMissing = async (table, column, sql) => {
            if ((await tableColumns(client, table)).has(column)) return false;
            try {
                await executeWithBusyRetry(() => client.execute(sql));
                return true;
            } catch (error) {
                if ((await tableColumns(client, table)).has(column)) return false;
                throw error;
            }
        };
        if (await addColumnIfMissing("StaffProfile", "personContactId", `
            ALTER TABLE "StaffProfile"
            ADD COLUMN "personContactId" TEXT
            REFERENCES "PersonContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        `)) changed = true;
        if (await addColumnIfMissing("Guardian", "personContactId", `
            ALTER TABLE "Guardian"
            ADD COLUMN "personContactId" TEXT
            REFERENCES "PersonContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        `)) changed = true;
        if (await addColumnIfMissing("Guardian", "middleName", 'ALTER TABLE "Guardian" ADD COLUMN "middleName" TEXT')) {
            changed = true;
        }

        const indexes = [
            'CREATE UNIQUE INDEX IF NOT EXISTS "PersonContact_schoolMatricule_phone_key" ON "PersonContact" ("schoolMatricule", "phone")',
            'CREATE INDEX IF NOT EXISTS "PersonContact_schoolMatricule_idx" ON "PersonContact" ("schoolMatricule")',
            'CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_personContactId_key" ON "StaffProfile" ("personContactId")',
            'CREATE UNIQUE INDEX IF NOT EXISTS "Guardian_personContactId_key" ON "Guardian" ("personContactId")',
        ];
        for (const sql of indexes) {
            await executeWithBusyRetry(() => client.execute(sql));
        }
        return { changed };
    } finally {
        client.close();
    }
}
