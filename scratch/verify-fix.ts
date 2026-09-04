
import { generateSecret, generate } from "otplib";

// Mocking the fix logic to test it in isolation first, 
// then we can test the actual file if needed.
async function verify2FACodeMock(verifyFn: any, token: string, secret: string): Promise<boolean> {
    try {
        const result = await verifyFn({ token, secret });
        if (typeof result === 'boolean') {
            return result;
        }
        return !!(result as any)?.valid;
    } catch (error) {
        return false;
    }
}

async function test() {
    const { verify } = await import("otplib");
    const secret = generateSecret();
    console.log("Secret:", secret);
    
    const correctCode = await (generate as any)({ secret });
    const wrongCode = "000000";
    
    console.log("Testing WRONG code '000000'...");
    const resultWrong = await verify2FACodeMock(verify, wrongCode, secret);
    console.log("Result (should be false):", resultWrong);
    
    if (resultWrong === true) {
        console.error("FAIL: Wrong code was accepted!");
    } else {
        console.log("SUCCESS: Wrong code was rejected.");
    }
    
    console.log("\nTesting CORRECT code...");
    const resultCorrect = await verify2FACodeMock(verify, correctCode, secret);
    console.log("Result (should be true):", resultCorrect);
    
    if (resultCorrect === true) {
        console.log("SUCCESS: Correct code was accepted.");
    } else {
        console.error("FAIL: Correct code was rejected!");
    }
}

test();
