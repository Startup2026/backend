const async_handler = require("express-async-handler")
const InterviewSchedule = require("../../models/interview.model");
const Application = require("../../models/application.model");
const StudentProfile = require("../../models/studentprofile.model");
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || "user@example.com",
        pass: process.env.SMTP_PASS || "password",
    },
});

transporter.verify().catch((err) => console.warn("SMTP verify failed:", err));

async function sendMailToApplicantsForInterview(doc) {
    try {
        // Support single applicationId or array of applicationIds
        const appIds = Array.isArray(doc.applicationId) ? doc.applicationId : [doc.applicationId];
        for (const appId of appIds) {
            if (!appId) continue;
            const application = await Application.findById(appId).populate('studentId', 'email firstName lastName');
            if (!application) {
                console.info(`Application ${appId} not found, skipping.`);
                continue;
            }

            // Only send emails to students of SHORTLISTED applications
            if (application.status !== 'SHORTLISTED') {
                console.info(`Skipping application ${appId} (status=${application.status}) — not shortlisted.`);
                continue;
            }

            if (!application.studentId || !application.studentId.email) {
                console.info(`Application ${appId} has no student email, skipping.`);
                continue;
            }

            const to = application.studentId.email;
            const candidateName = application.studentId.firstName || 'Candidate';
            const subject = `Interview Scheduled on ${doc.interviewDate || doc.scheduleDate || 'N/A'}`;
            const text = [
                `Dear ${candidateName},`,
                ``,
                `Your interview has been scheduled.`,
                `Date: ${doc.interviewDate || doc.scheduleDate || 'N/A'}`,
                `Time: ${doc.interviewTime || 'N/A'}`,
                `Mode: ${doc.mode || 'N/A'}`,
                `Link: ${doc.interviewLink || 'N/A'}`,
                `Notes: ${doc.notes || 'N/A'}`,
                ``,
                `Best regards`,
            ].join("\n");

            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to,
                subject,
                text,
            });

            // Update application status to INTERVIEW_SCHEDULED
            try {
                await Application.findByIdAndUpdate(appId, { status: 'INTERVIEW_SCHEDULED' });
            } catch (updateErr) {
                console.warn('Failed to update application status for', appId, updateErr);
            }
        }
    } catch (err) {
        console.error("Error sending interview emails:", err);
    }
}

if (InterviewSchedule && InterviewSchedule.schema) {
    InterviewSchedule.schema.post("save", function (doc) {
        // fire-and-forget; the controller's response won't wait on email delivery
        sendMailToApplicantsForInterview(doc).catch((err) => console.error(err));
    });
}
const scheduleInterview = async_handler(async (req, res) => {
    const {
        interviewDate, interviewTime, mode, interviewLink, interviewer, notes
    } = req.body;
    const { applicationId } = req.params;
    const newInterviewSchedule = new InterviewSchedule({ interviewDate, interviewTime, mode, interviewLink, interviewer, notes, applicationId });

    await newInterviewSchedule.save();
    return res.status(200).json({
        "message": "Interview Scheduled!!!"
    })
});

module.exports = {
    scheduleInterview
};