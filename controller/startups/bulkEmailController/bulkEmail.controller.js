const async_handler = require("express-async-handler");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Application = require("../../../models/application.model");
const Notification = require("../../../models/notification.model");
const Interview = require("../../../models/interview.model");
const { getIo } = require("../../../config/socket");
const { sendEmail } = require("../../../utils/emailHelper");
const { createAndSendNotification } = require("../../../utils/notificationHelper");

const sendBulkEmail = async_handler(async (req, res) => {
  const { subject: customSubject, message: customMessage, applicationIdList, isInterview, interviewDetails, template } = req.body;
  
  // NOTE: If 'template' is provided, we use default subject/message for that template unless overridden.
  // Supported templates: 'shortlisted', 'rejected', 'selected', 'interview'
  
  if (!process.env.brevo_api) {
      console.error("EMAIL CONFIG MISSING: brevo_api is not set.");
  }
  
  if (!applicationIdList || !Array.isArray(applicationIdList) || applicationIdList.length === 0) {
     return res.status(400).json({ success: false, error: "applicationIdList must be a non-empty array" });
  }

  // Pre-validate inputs if no template is used
  if (!template && (!customSubject || customMessage === undefined)) {
    return res.status(400).json({
      success: false,
      error: "subject and message are required when no template is specified",
    });
  }

  const results = { sent: [], failed: [] };

  for (const applicationId of applicationIdList) {
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      results.failed.push({ applicationId, error: "Invalid application ID" });
      continue;
    }

    const application = await Application.findById(applicationId)
      .populate("studentId", "email firstName lastName userId")
      .populate({
        path: "jobId",
        populate: {
          path: "startupId",
          select: "startupName userId",
          populate: { path: "userId", select: "email" },
        },
      });

    if (!application) {
      results.failed.push({ applicationId, error: "Application not found" });
      continue;
    }

    const student = application.studentId;
    const recipient = student && student.email;

    if (!recipient) {
      results.failed.push({ applicationId, error: "No student email available" });
      continue;
    }

    const job = application.jobId;
    const jobTitle = job ? job.role : "the role";
    const startupProfile = job ? job.startupId : null;
    const companyName = startupProfile ? startupProfile.startupName : "Company";
    const companyEmail =
      startupProfile && startupProfile.userId ? startupProfile.userId.email : null;

    let emailSubject = customSubject || subject; // default to passed subject if it exists
    let emailText = customMessage || message;     // default to passed message if it exists
    let emailHTML = "";

    if (template) {
        switch(template.toLowerCase()) {
            case 'shortlisted':
                emailSubject = emailSubject || `Great News! You are shortlisted for ${jobTitle} at ${companyName}`;
                emailText = emailText || `Hi ${student.firstName},\n\nYou have been shortlisted for the ${jobTitle} position at ${companyName}. We will be in touch shortly regarding next steps.\n\nBest,\n${companyName}`;
                emailHTML = `
                    <p>Hi ${student.firstName || "Candidate"},</p>
                    <p>We are pleased to inform you that you have been <strong>SHORTLISTED</strong> for the <strong>${jobTitle}</strong> position.</p>
                    ${customMessage ? `<p>${customMessage}</p>` : `<p>We were impressed with your profile and application.</p>`}
                    <p>We will contact you shortly with further instructions.</p>
                    <p>Best Regards,<br/>${companyName}</p>
                `;
                // Also update application status if needed
                application.status = "SHORTLISTED";
                break;
                
            case 'rejected':
                emailSubject = emailSubject || `Update on your application for ${jobTitle} at ${companyName}`;
                emailText = emailText || `Hi ${student.firstName},\n\nThank you for your interest. Unfortunately, we will not be moving forward with your application for ${jobTitle} at this time.\n\nBest,\n${companyName}`;
                emailHTML = `
                    <p>Hi ${student.firstName || "Candidate"},</p>
                    <p>Thank you for applying to the <strong>${jobTitle}</strong> position at ${companyName}.</p>
                    ${customMessage ? `<p>${customMessage}</p>` : `<p>After careful consideration, we have decided to pursue other candidates whose qualifications more closely align with our current needs.</p>`}
                    <p>We wish you the best in your job search.</p>
                    <p>Best Regards,<br/>${companyName}</p>
                `;
                application.status = "REJECTED";
                break;
                
            case 'selected':
                emailSubject = emailSubject || `Congratulations! You are selected for ${jobTitle} at ${companyName}`;
                emailText = emailText || `Hi ${student.firstName},\n\nCongratulations! We are thrilled to offer you the ${jobTitle} position at ${companyName}.\n\nBest,\n${companyName}`;
                emailHTML = `
                    <p>Hi ${student.firstName || "Candidate"},</p>
                    <p><strong>Congratulations!</strong></p>
                    <p>We are thrilled to offer you the position of <strong>${jobTitle}</strong> at ${companyName}.</p>
                    ${customMessage ? `<p>${customMessage}</p>` : `<p>Your skills and experience impressed our team.</p>`}
                    <p>Please check your email for the official offer letter or next steps.</p>
                    <p>Welcome aboard!</p>
                    <p>Best Regards,<br/>${companyName}</p>
                `;
                application.status = "SELECTED";
                break;

            case 'interview':
                emailSubject = emailSubject || `Interview Invitation: ${jobTitle} at ${companyName}`;
                emailText = emailText || `Hi ${student.firstName},\n\nWe would like to invite you for an interview for the ${jobTitle} position.\n\nBest,\n${companyName}`;
                emailHTML = `
                    <p>Hi ${student.firstName || "Candidate"},</p>
                    <p>We are excited to invite you to an interview for the <strong>${jobTitle}</strong> position.</p>
                    ${customMessage ? `<p>${customMessage}</p>` : `<p>Please see the details below or check your dashboard.</p>`}
                    ${interviewDetails ? `<p><strong>Interview Details:</strong><br/>${interviewDetails}</p>` : ''}
                    <p>Best Regards,<br/>${companyName}</p>
                `;
                application.status = "INTERVIEW_SCHEDULED";
                break;
                
            default:
                // Fallback for custom templates or unknown types
                 emailHTML = `
                  <p>Hi ${student.firstName || "Candidate"},</p>
                  <p>${emailText}</p>
                  <p>Regards,<br/>${companyName}</p>
                `;
                break;
        }
    } else {
        // No template, use raw message
         emailSubject = emailSubject || "Update from Startup";
        emailHTML = `
          <p>Hi ${student.firstName || "Candidate"},</p>
          <p>${emailText}</p>
          <p>Regards,<br/>${companyName}</p>
        `;
    }

    // 1. Try to Send Email
    let emailSent = false;
    let emailError = null;
    try {
      await sendEmail({
        to: recipient,
        fromName: companyName,
        replyTo: companyEmail || undefined,
        subject: emailSubject,
        html: emailHTML,
        text: emailText
      });
      console.log(`[BulkEmail] Email sent successfully to ${recipient}`);
      emailSent = true;
      
      // Update Notification Flags on Success
      application.isNotified = true;
      application.statusVisible = true;
      application.notifiedAt = new Date();
      await application.save();
      
      // Also send platform notification using helper if possible
       try {
            await createAndSendNotification(
                student.userId,
                emailSubject,
                `New email from ${companyName}: ${emailSubject}`,
                'application_update',
                application._id
             );
             
             // EMIT SOCKET EVENT FOR DASHBOARD UPDATE
             const io = getIo();
             io.to(student.userId.toString()).emit("applicationStatusUpdated", {
                applicationId: application._id,
                status: application.status,
                jobId: job._id,
                jobRole: jobTitle,
                company: companyName,
                isNotified: true,
                statusVisible: true
             });
        } catch (notifErr) {
            console.error("Failed to create notification or emit socket:", notifErr);
        }

    } catch (err) {
      console.error(`[BulkEmail] Email failed for ${recipient}:`, err.message);
      emailError = err.message;
    }

    // 2. Create Interview Record if applicable
    if (isInterview && interviewDetails) {
        try {
            const { date, time, mode, link } = interviewDetails;
            await Interview.create({
                applicationId: applicationId,
                interviewDate: date,
                interviewTime: time,
                mode: mode,
                interviewLink: link,
                status: 'scheduled'
            });
            console.log(`[BulkEmail] Interview scheduled for App ID: ${applicationId}`);

            // Update application status to INTERVIEW_SCHEDULED
            application.status = 'INTERVIEW_SCHEDULED';
            await application.save();
            
            console.log(`[BulkEmail] Interview scheduled and status updated for App ID: ${applicationId}`);

        } catch (intErr) {
            console.error(`[BulkEmail] Failed to create interview record for ${applicationId}:`, intErr);
            // Don't fail the whole request, just log it
        }
    }

    // 3. Always create Notification (even if email fails, we want in-app delivery)
    try {
      const notificationPayload = {
        recipient: student.userId,
        title: subject,
        message: message,
        type: isInterview ? "interview" : "info",
        relatedId: applicationId,
      };

      if (student.userId) {
        console.log(`[BulkEmail] Creating notification for User ID: ${student.userId}`);
        const notification = await Notification.create(notificationPayload);
        
        try {
          const io = getIo();
          const rooms = new Set([
            student.userId.toString(),
            student._id ? student._id.toString() : null,
          ]);
          console.log(`[BulkEmail] Emitting socket notification to rooms:`, Array.from(rooms));
          rooms.forEach((room) => {
            if (room) {
              io.to(room).emit("notification", notification);
            }
          });
        } catch (socketErr) {
          console.error("[BulkEmail] Socket emit failed:", socketErr);
        }
      } else {
          console.warn(`[BulkEmail] Skipping notification: No userId found for student in application ${applicationId}`);
      }
    } catch (notifErr) {
       console.error(`[BulkEmail] Notification creation failed for ${recipient}:`, notifErr);
    }

    // Record results
    if (emailSent) {
      results.sent.push({ applicationId, email: recipient, jobTitle });
    } else {
      // Even if email failed, we processed the application. 
      // We can decide to list it as 'failed' for email purposes, 
      // but if notification worked, it's partially successful.
      // For now, keep reporting as failed mail to alert the user.
      results.failed.push({ applicationId, error: emailError || "Email sending failed", notificationSent: true });
    }

  }

  console.log("[BulkEmail] Completed. Results:", JSON.stringify(results, null, 2));
  return res.status(200).json({ success: true, results });
});

module.exports = { sendBulkEmail };
