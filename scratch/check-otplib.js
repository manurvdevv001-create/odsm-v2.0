
const otplib = require('otplib');
console.log("Keys in otplib:", Object.keys(otplib));

const { authenticator } = otplib;
if (authenticator) {
    console.log("authenticator found");
    console.log("Keys in authenticator:", Object.keys(authenticator));
} else {
    console.log("authenticator NOT found");
}
