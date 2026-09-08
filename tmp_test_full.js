process.env.TURSO_DATABASE_URL = "libsql://odsm-prod-manurvdevv001-create.aws-us-east-1.turso.io";
process.env.TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODg0NTA3MDAsImlkIjoiMDFhMDY3ZjMtZjkwMS03OGVhLTgxYTEtYjdiMTQwNjUyMWM0Iiwia2lkIjoidU5DT2lxTzg5cGtiRlRrdGFLbWZ6SVBDMUVMOFdVV3RZSjh2VTdpQWdHayIsInJpZCI6ImYxZmUxMTBjLTlhMWYtNGYyZi1hNmFhLWJjYWI5MmZmNzYxOSJ9.WOpewUH7aWN3odfkdWbswgErEwP7Nyqy7gm3JhXnWOw8coxMlKj7fo7hHAdpqd4c0kGADZpBFzaMh5_0OQgOCA";
delete process.env.DATABASE_URL;

const { PrismaClient } = require('./node_modules/.prisma/client/index.js');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');

const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});
const adapter = new PrismaLibSql(libsql);

const prisma = new PrismaClient({ adapter });

async function test() {
    try {
        console.log("Running query...");
        await prisma.school.findMany();
        console.log("Success!");
    } catch(e) {
        console.error("QUERY ERROR:", e.message);
    }
}
test();
