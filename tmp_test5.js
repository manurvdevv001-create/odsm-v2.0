const { PrismaClient } = require('./node_modules/.prisma/client/index.js');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

const libsql = createClient({
    url: "libsql://dummy.turso.io",
    authToken: "dummy",
});
const adapter = new PrismaLibSql(libsql);

const prisma = new PrismaClient({ 
    adapter,
    datasourceUrl: "libsql://dummy.turso.io"
});

prisma.school.findMany().catch(e => console.error("ASYNC ERROR:", e.message));
