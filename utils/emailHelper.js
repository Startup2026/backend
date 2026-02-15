const axios = require('axios');

/**
 * Sends an email using Brevo API ONLY.
 * 
 * @param {Object} options 
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} [options.text] - Email plain text content
 * @param {string} [options.from] - Sender email (defaults to notification_mail or verify_from_mail)
 * @param {string} [options.fromName] - Sender name
 * @param {string} [options.replyTo] - Reply-to email
 * @param {boolean} [options.isVerification] - Whether this is a verification email (uses verify_from_mail)
 */
const sendEmail = async ({ to, subject, html, text, from, fromName, replyTo, isVerification = false }) => {
  const brevoApiKey = process.env.brevo_api;
  const defaultFrom = isVerification ? process.env.verify_from_mail : process.env.notification_mail;
  const senderEmail = from || defaultFrom;
  const senderName = fromName || "Wostup";

  console.log("Attempting to send email via Brevo:", {
    to,
    senderEmail,
    subject,
    isVerification
  });

  if (!brevoApiKey) {
    throw new Error("BREVO_API_KEY (brevo_api) is missing in environment variables.");
  }
  
  if (!senderEmail) {
    throw new Error(`Sender email is missing. verify_from_mail or notification_mail must be set in .env. isVerification: ${isVerification}`);
  }

  try {
    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text || html.replace(/<[^>]*>?/gm, ''), // Basic fallback for text
        replyTo: replyTo ? { email: replyTo } : undefined
      },
      {
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`Email sent to ${to} via Brevo successfully`);
    return { success: true };
  } catch (error) {
    console.error('Brevo Email Error:', error.response ? error.response.data : error.message);
    throw new Error("Failed to send email via Brevo: " + (error.response ? JSON.stringify(error.response.data) : error.message));
  }
};

module.exports = { sendEmail };
