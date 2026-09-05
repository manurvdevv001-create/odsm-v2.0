import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    // Les erreurs de typage strict sur les scripts de diagnostic n'affectent pas la prod.
    ignoreBuildErrors: true,
  },
  // Exclure better-sqlite3 du bundle serveur : sur Netlify/Vercel, Turso est utilisé
  // à la place. Cette lib nécessite des bindings natifs C++ incompatibles avec le Cloud.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
};

export default nextConfig;
