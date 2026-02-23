const path = require('path');
const dotenv = require('dotenv');
// Load .env from current directory
const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

console.log(`Loaded .env from: ${envPath}`);
if (result.error) {
  console.error("Error loading .env file:", result.error);
}

const { sendEmail } = require('./utils/emailHelper');

const test = async () => {
    console.log("Checking environment variables...");
    const BREVO_KEY = process.env.brevo_api;
    const VERIFY_FROM = process.env.verify_from_mail;
    const NOTIFY_FROM = process.env.notification_mail;

    if (!BREVO_KEY) console.error("❌ MISSING: brevo_api");
    else console.log("✅ FOUND: brevo_api");

    if (!VERIFY_FROM) console.error("❌ MISSING: verify_from_mail");
    else console.log(`✅ FOUND: verify_from_mail (${VERIFY_FROM})`);

    if (!NOTIFY_FROM) console.error("❌ MISSING: notification_mail");
    else console.log(`✅ FOUND: notification_mail (${NOTIFY_FROM})`);

    if (!BREVO_KEY || !VERIFY_FROM) {
        console.error("Stopping test because required variables are missing.");
        return;
    }

    console.log("\nAttempting to send email...");
    try {
        await sendEmail({
            to: process.env.TEST_EMAIL_RECIPIENT || "sanchitskumbhar@gmail.com", // Change this if needed
            subject: "Debug Test Email " + new Date().toISOString(),
            html: "<h1>It Works!</h1><p>This is a test email sent from the debug script.</p>",
            isVerification: true
        });
        console.log("✅ Email sent successfully! Check your inbox (and spam folder).");
    } catch (error) {
        console.error("❌ Failed to send email.");
        if (error.response) {
            console.error("Response Status:", error.response.status);
            console.error("Response Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
};

test();
