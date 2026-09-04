
import { authenticator } from "otplib";

async function test() {
    const secret = authenticator.generateSecret();
    console.log("Secret generated:", secret);
    
    const randomCode = "123456";
    try {
        const result = authenticator.verify({ token: randomCode, secret });
        console.log("Authenticator.verify result for random code:", result);
        console.log("Type of result:", typeof result);
    } catch (e) {
        console.log("Authenticator.verify threw an error:", e);
    }
}

test();
