
import { generateSecret, verify, generate } from "otplib";

async function test() {
    const secret = generateSecret();
    console.log("Secret generated:", secret);
    
    // Generate a code for the current time
    const code = (generate as any)({ secret });
    console.log("Generated code:", code);
    
    try {
        const result = await (verify as any)({ token: code, secret });
        console.log("Verify result for CORRECT code:", result);
        
        const wrongCode = "000000";
        const resultWrong = await (verify as any)({ token: wrongCode, secret });
        console.log("Verify result for WRONG code:", resultWrong);
    } catch (e) {
        console.log("Verify threw an error:", e);
    }
}

test();
