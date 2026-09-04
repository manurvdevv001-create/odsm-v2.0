import { checkDatabaseHealth } from '../src/lib/db-health-actions';

async function test() {
    console.log("Testing server action...");
    const res = await checkDatabaseHealth();
    console.log("Result:", JSON.stringify(res, null, 2));
}

test();
