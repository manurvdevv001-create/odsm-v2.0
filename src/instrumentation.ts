export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const databaseUrl = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!databaseUrl) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("TURSO_DATABASE_URL est requis au démarrage de l'application en production.");
        }
        return;
    }
    if (!databaseUrl.startsWith("file:") && !authToken) {
        throw new Error("TURSO_AUTH_TOKEN est requis pour initialiser la base Turso.");
    }

    const { migratePersonContactSchema } = await import("./lib/person-contact-schema.mjs");
    const result = await migratePersonContactSchema(databaseUrl, authToken);

    console.info(result.changed
        ? "[ODSM DB] Mise à jour du schéma PersonContact terminée."
        : "[ODSM DB] Schéma PersonContact déjà à jour.");
}
