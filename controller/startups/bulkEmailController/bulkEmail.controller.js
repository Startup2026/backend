const async_handler = require("express-async-handler");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Application = require("../../../models/application.model");
const Notification = require("../../../models/notification.model");
const Interview = require("../../../models/interview.model");
const { getIo } = require("../../../config/socket");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MJ_SENDER_EMAIL,
    pass: process.env.EMAIL_PASS || "your_password",
  },
});

const sendBulkEmail = async_handler(async (req, res) => {
  const { subject, message, applicationIdList, isInterview, interviewDetails } = req.body;
  
  if (!process.env.MJ_SENDER_EMAIL || !process.env.EMAIL_PASS) {
      console.error("EMAIL CONFIG MISSING: MJ_SENDER_EMAIL or EMAIL_PASS is not set.");
  }

  console.log(`[BulkEmail] Attempting to send to ${applicationIdList?.length || 0} applicants`);

  if (!subject || !message) {
    return res.status(400).json({
      success: false,
      error: "subject and message are required",
    });
  }

  if (!Array.isArray(applicationIdList) || applicationIdList.length === 0) {
    return res.status(400).json({
      success: false,
      error: "applicationIdList must be a non-empty array",
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

    const emailHTML = `
      <p>Hi ${student.firstName || "Candidate"},</p>
      <p>${message}</p>
      <p>Regards,<br/>${companyName}</p>
    `;

    // 1. Try to send Email
    let emailSent = false;
    let emailError = null;
    try {
      const mailOptions = {
        from: `"${companyName}" <${process.env.MJ_SENDER_EMAIL}>`,
        to: recipient,
        replyTo: companyEmail || undefined,
        subject,
        html: emailHTML,
        text: message,
      };

      console.log(`[BulkEmail] Sending email to ${recipient} (App ID: ${applicationId})`);
      await transporter.sendMail(mailOptions);
      console.log(`[BulkEmail] Email sent successfully to ${recipient}`);
      emailSent = true;
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
