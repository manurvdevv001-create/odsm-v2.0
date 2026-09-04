import "dotenv/config";
import { defineConfig } from "prisma/config";
import path from "path";

let databaseUrl = process.env["DATABASE_URL"] || "file:./dev.db";

// Force le chemin absolu pour éviter le décalage de dossier avec Prisma CLI
if (databaseUrl.startsWith("file:")) {
  const relativePath = databaseUrl.replace("file:", "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  databaseUrl = `file:${absolutePath.replace(/\\/g, "/")}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
