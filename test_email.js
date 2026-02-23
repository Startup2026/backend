const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { sendEmail } = require('./utils/emailHelper');

const testEmail = async () => {
    try {
        console.log("Testing email sending...");
        // Use a dummy email or the user's email if known, but for safety I'll use a temporary one or the one from environment if suitable.
        // I will use a placeholder and ask the user to check logs, or if I can see the output here.
        // I'll try sending to a safe testing email or just see if the API accepts it.
        // Since I can't receive it, I rely on the API response.
        
        await sendEmail({
            to: "sanchitskumbhar@gmail.com", // Assuming this might be a valid internal email or I should use a dummy
            subject: "Test Email from Debug Script",
            html: "<p>This is a test email to verify the Brevo configuration.</p>",
            isVerification: true
        });
        console.log("Test email finished successfully.");
    } catch (error) {
        console.error("Test email failed:", error);
    }
};

testEmail();
