import "dotenv/config";
import { migratePersonContactSchema } from "../src/lib/person-contact-schema.mjs";

const result = await migratePersonContactSchema(
    process.env.TURSO_DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
);

console.log(result.changed
    ? "Schéma PersonContact appliqué. Aucune fiche existante n'a été modifiée."
    : "Schéma PersonContact déjà à jour.");
