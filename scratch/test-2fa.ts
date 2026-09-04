
import { generateSecret, verify } from "otplib";

async function test() {
    const secret = generateSecret();
    console.log("Secret generated:", secret);
    
    // Testing with a random code
    const randomCode = "123456";
    try {
        const result = (verify as any)({ token: randomCode, secret });
        console.log("Verify result for random code:", result);
        
        if (result instanceof Promise) {
            console.log("Verify returned a Promise, awaiting it...");
            console.log("Awaited result:", await result);
        }
    } catch (e) {
        console.log("Verify threw an error:", e);
    }
}

test();
