const { createClient } = require('@libsql/client');
async function test() {
    const libsql = createClient({
        url: 'libsql://odsm-prod-manurvdevv001-create.aws-us-east-1.turso.io',
        authToken: 'dummy',
    });
    try {
        await libsql.execute("SELECT 1");
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}
test();
