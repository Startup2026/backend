const async_handler = require("express-async-handler")
const InterviewSchedule = require("../../../models/interview.model");
const Application = require("../../../models/application.model");
const StudentProfile = require("../../../models/studentprofile.model");
const StartupProfile = require("../../../models/startupprofile.model");
const { getIo } = require("../../../config/socket");
const { createAndSendNotification } = require("../../../utils/notificationHelper");
const { sendEmail } = require("../../../utils/emailHelper");

async function sendMailToApplicantsForInterview(doc) {
    try {
        // Support single applicationId or array of applicationIds
        const appIds = Array.isArray(doc.applicationId) ? doc.applicationId : [doc.applicationId];
        for (const appId of appIds) {
            if (!appId) continue;
            const application = await Application.findById(appId).populate('studentId', 'email firstName lastName userId');
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

            // Get startup details for dynamic sender
            const job = application.jobId;
            let companyName = "Startup Portal";
            let companyEmail = null;

            if (job && job.startupId) {
                // Assuming startupId is populated, if not you might need deep populate in the query above
                // For now, let's just stick to what was working, or fetch if needed.
                // The current findById query only populates studentId.
                // Ideally, we should populate job and startup.
            }
            
            // Re-fetch with deep population to get startup details for email personalization
            const fullApp = await Application.findById(appId).populate({
                 path: 'jobId',
                 populate: { path: 'startupId', select: 'startupName userId', populate: { path: 'userId', select: 'email' } }
            });
            
            if (fullApp && fullApp.jobId && fullApp.jobId.startupId) {
                 companyName = fullApp.jobId.startupId.startupName;
                 if (fullApp.jobId.startupId.userId) {
                     companyEmail = fullApp.jobId.startupId.userId.email;
                 }
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
                `Best regards,`,
                `${companyName}`
            ].join("\n");

            await sendEmail({
                to: to,
                fromName: companyName,
                replyTo: companyEmail || undefined, 
                subject: subject,
                text: text,
                html: text.replace(/\n/g, '<br>') // Simple conversion for HTML
            });

            // Update application status to INTERVIEW_SCHEDULED
            try {
                await Application.findByIdAndUpdate(appId, { 
                    status: 'INTERVIEW_SCHEDULED',
                    statusVisible: true,
                    notifiedAt: new Date(),
                    isNotified: true
                });

                // Create Notification & Emit Socket via Helper
                if (application.studentId && application.studentId.userId) {
                    await createAndSendNotification(
                        application.studentId.userId,
                        subject,
                        "You have an interview invited! Check your email for details.",
                        'application_update',
                        appId
                    );

                    // Standardized event for UI refresh
                    try {
                        const io = getIo();
                        io.to(application.studentId.userId.toString()).emit("applicationStatusUpdated", { 
                            applicationId: appId, 
                            status: 'INTERVIEW_SCHEDULED' 
                        });
                    } catch (ioErr) { console.warn(ioErr); }
                }

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
    
    // Check if startup already exists on request (from plan middleware)
    let startupId = req.startupProfile ? req.startupProfile._id : null;
    
    if (!startupId) {
        const startup = await StartupProfile.findOne({ userId: req.user.id });
        if (!startup) return res.status(404).json({ success: false, error: "Startup profile not found" });
        startupId = startup._id;
    }

    // Update Application status
    await Application.findByIdAndUpdate(applicationId, { 
        status: "INTERVIEW_SCHEDULED",
        statusVisible: false 
    });

    const newInterviewSchedule = new InterviewSchedule({ 
        interviewDate, 
        interviewTime, 
        mode, 
        interviewLink, 
        interviewer, 
        notes, 
        applicationId,
        startupId 
    });

    await newInterviewSchedule.save();
    return res.status(200).json({
        success: true,
        message: "Interview Scheduled!!!"
    })
});

const getInterviews = async_handler(async (req, res) => {
    const userId = req.user.id || req.user._id; 
    
    const startup = await StartupProfile.findOne({ userId });
    if (!startup) {
        return res.status(404).json({ success: false, error: "Startup profile not found" });
    }
    const startupId = startup._id;

    // Fetch interviews and populate deep to check Job ownership
    const interviews = await InterviewSchedule.find()
        .populate({
            path: 'applicationId',
            populate: [
                { path: 'studentId' },
                { path: 'jobId' } 
            ]
        })
        .sort({ createdAt: -1 });

    const myInterviews = interviews.filter(inv => {
        if (!inv.applicationId || !inv.applicationId.jobId) return false;
        
        // jobId might be populated or not, but we populated it above
        let jobStartup = inv.applicationId.jobId.startupId;
        if (typeof jobStartup === 'object' && jobStartup._id) {
             jobStartup = jobStartup._id;
        }
        return jobStartup.toString() === startupId.toString(); 
    });

    res.status(200).json({
        success: true,
        data: myInterviews
    });
});

const rescheduleInterview = async_handler(async (req, res) => {
    const { id } = req.params;
    const { interviewDate, interviewTime, mode, interviewLink, interviewer, notes } = req.body;

    const interview = await InterviewSchedule.findById(id);
    if (!interview) {
        return res.status(404).json({ success: false, error: "Interview not found" });
    }

    // Update fields
    if (interviewDate) interview.interviewDate = interviewDate;
    if (interviewTime) interview.interviewTime = interviewTime;
    if (mode) interview.mode = mode;
    if (interviewLink) interview.interviewLink = interviewLink;
    if (interviewer) interview.interviewer = interviewer;
    if (notes) interview.notes = notes;

    await interview.save();

    res.status(200).json({
        success: true,
        message: "Interview rescheduled successfully",
        data: interview
    });
});

const updateInterviewStatus = async_handler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const interview = await InterviewSchedule.findByIdAndUpdate(
        id,
        { status },
        { new: true }
    );

    if (!interview) {
        return res.status(404).json({ success: false, error: "Interview not found" });
    }

    res.status(200).json({
        success: true,
        message: `Interview status updated to ${status}`,
        data: interview
    });
});

const respondToInterview = async_handler(async (req, res) => {
    const { id } = req.params; 
    const { action } = req.body; // 'accept' or 'decline'
    
    const interview = await InterviewSchedule.findById(id).populate({
        path: 'startupId',
        populate: { path: 'userId' }
    }).populate({
        path: 'applicationId',
        populate: [
            { path: 'studentId' },
            { path: 'jobId' }
        ]
    });

    if (!interview) return res.status(404).json({ success: false, error: "Interview not found" });

    // Validate ownership
    if (interview.applicationId?.studentId?.userId?.toString() !== req.user.id) {
        return res.status(403).json({ success: false, error: "Unauthorized response" });
    }

    interview.status = action === 'accept' ? 'accepted' : 'declined';
    await interview.save();

    // Notify Startup
    if (interview.startupId && interview.startupId.userId) {
        const studentName = `${interview.applicationId.studentId.firstName} ${interview.applicationId.studentId.lastName}`;
        await createAndSendNotification(
            interview.startupId.userId._id,
            `Interview Invite ${action === 'accept' ? 'Accepted' : 'Declined'}`,
            `${studentName} has ${action}ed the interview request for ${interview.applicationId.jobId?.role}.`,
            action === 'accept' ? 'success' : 'warning',
            interview.applicationId._id
        );
    }

    res.status(200).json({ success: true, message: `Response registered: ${action}` });
});

module.exports = {
    scheduleInterview,
    getInterviews,
    rescheduleInterview,
    updateInterviewStatus,
    respondToInterview
};