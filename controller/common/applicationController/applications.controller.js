const async_handler = require("express-async-handler");
const Application = require("../../../models/application.model");
const Job = require("../../../models/job.model");
const StudentProfile = require("../../../models/studentprofile.model");
const Notification = require("../../../models/notification.model");
const mongoose = require("mongoose");
const axios = require('axios');
const FormData = require('form-data');
const { createAndSendNotification } = require("../../../utils/notificationHelper");
const { sendEmail } = require("../../../utils/emailHelper");
const { getUploadedFileUrl } = require("../../../utils/uploadUrl");

const createApplication = async_handler(async (req, res) => {
    const { jobId, studentId } = req.params; // studentId here is likely userId from frontend
    // Check if resume file was uploaded
    const resumeFile = req.files && req.files['resume'] ? req.files['resume'][0] : null;

    console.log(`Processing application for Job: ${jobId}, User/Student: ${studentId}`);

    // Resolve Student Profile ID from User ID if needed
    // The frontend sends user._id, but the Application model expects StudentProfile _id
    let profileId = studentId;
    const studentProfile = await StudentProfile.findOne({ userId: studentId });
    if (studentProfile) {
        profileId = studentProfile._id;
    } else {
        // Fallback: check if the ID passed IS the profile ID
        const profileById = await StudentProfile.findById(studentId);
        if (profileById) {
            profileId = profileById._id;
        } else {
            // Profile doesn't exist for this user?
            console.warn(`Student Profile not found for ID: ${studentId}`);
            // Proceeding might fail population later, but we'll try
        }
    }

    let atsScore = 0;
    let applicationStatus = "APPLIED";

    try {
        // 1. Fetch Job Description
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
        }

        if (job.deadline) {
            const deadlineDate = new Date(job.deadline);
            if (Number.isNaN(deadlineDate.getTime())) {
                return res.status(400).json({ success: false, error: "Job deadline is invalid" });
            }

            // Treat deadline as inclusive through end of day.
            deadlineDate.setHours(23, 59, 59, 999);
            if (deadlineDate < new Date()) {
                return res.status(400).json({ success: false, error: "Application deadline has passed for this job" });
            }
        }

        const jobDescription = `
            Role: ${job.role}
            About Role: ${job.aboutRole}
            Key Responsibilities: ${job.keyResponsibilities || ''}
            Requirements: ${job.requirements || ''}
            Tags: ${job.Tag ? job.Tag.join(', ') : ''}
        `;

        // 2. Process Resume and Call ATS Service
        if (resumeFile) {
            try {
                // Prepare form data with in-memory file buffer from multer.
                const form = new FormData();
                form.append('resume', resumeFile.buffer, {
                    filename: resumeFile.originalname || 'resume-file',
                    contentType: resumeFile.mimetype,
                });
                form.append('job_description', jobDescription);

                // Call Flask API
                const flaskUrl = 'http://127.0.0.1:8000/ats-score';
                const flaskResponse = await axios.post(flaskUrl, form, {
                    headers: {
                        ...form.getHeaders()
                    }
                });
                
                console.log("ATS Response:", flaskResponse.data);

                if (flaskResponse.data) {
                    atsScore = flaskResponse.data.ats_score || 0;
                    const flaskStatus = flaskResponse.data.status;

                    if (flaskStatus === 'Shortlisted') {
                        applicationStatus = 'SHORTLISTED';
                    } else if (flaskStatus === 'Rejected') {
                        applicationStatus = 'REJECTED';
                    }
                }

            } catch (atsError) {
                console.error("ATS Service Error:", atsError.message);
                if (atsError.response) {
                    console.error("ATS Service Response:", atsError.response.data);
                }
                // Continue with default status if ATS fails
            }
        }

    } catch (error) {
        console.error("Create application error:", error);
         return res.status(500).json({ success: false, error: "Failed to process application" });
    }

    // 3. Save Application
    // Construct resume URL (relative path for serving)
    let finalResumeUrl = getUploadedFileUrl(resumeFile);
    
    // If no new resume uploaded, use the one from student profile
    if (!finalResumeUrl && studentProfile && studentProfile.resumeUrl) {
        finalResumeUrl = studentProfile.resumeUrl;
    }

    const newApplication = new Application({ 
        atsScore, 
        status: applicationStatus, 
        jobId, 
        studentId: profileId, 
        resumeUrl: finalResumeUrl
    });
    
    await newApplication.save();

    // Notify Startup about new application
    try {
        const fullJob = await Job.findById(jobId).populate({
            path: 'startupId',
            populate: { path: 'userId' }
        });
        if (fullJob && fullJob.startupId && fullJob.startupId.userId) {
            const student = await StudentProfile.findById(profileId);
            const studentName = student ? `${student.firstName} ${student.lastName}` : "A student";
            await createAndSendNotification(
                fullJob.startupId.userId._id,
                "New Application Received",
                `${studentName} has applied for the ${fullJob.role} position.`,
                'info',
                newApplication._id
            );
        }
    } catch (notifErr) {
        console.error("Failed to notify startup:", notifErr);
    }

    return res.status(201).json({
        success: true,
        message: "Application submitted.",
        data: newApplication
    });
});

const getAllApplications = async_handler(async (req, res) => {
    const allApplications = await Application.find()
        .populate('studentId')
        .populate('jobId');
    return res.status(200).json({
        success: true,
        data: allApplications
    });
});

const getApplication = async_handler(async (req, res) => {
    const { jobId, studentId } = req.params;
    const application = await Application.findOne({ jobId, studentId })
        .populate('studentId', 'firstname lastname')
        .populate('jobId');

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'Application not found'
        });
    }

    return res.status(200).json({
        success: true,
        data: application
    });
});

const getStudentApplications = async_handler(async (req, res) => {
    const { studentId } = req.params; // This is actually userId from frontend
    
    let queryIds = [studentId];
    
    // Resolve StudentProfile from userId
    const studentProfile = await StudentProfile.findOne({ userId: studentId });
    if (studentProfile) {
        queryIds.push(studentProfile._id);
    } 
    
    // Find all applications for this student and populate job + startup details
    const applications = await Application.find({ studentId: { $in: queryIds } })
        .populate({
            path: 'jobId',
            select: 'role jobType location salary stipend',
            populate: {
                path: 'startupId',
                select: 'startupName profilepic location'
            }
        })
        .sort({ createdAt: -1 });

    return res.status(200).json({
        success: true,
        data: applications
    });
});

const updateApplication = async_handler(async (req, res) => {
    const applicationId = req.params.applicationId;
    const { status } = req.body;

    const application = await Application.findByIdAndUpdate(applicationId, req.body, {
        new: true, runValidators: true
    })
    .populate('studentId')
    .populate({
        path: 'jobId',
        populate: { path: 'startupId' }
    });

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'Application not found'
        });
    }

    // Send Notifications if status changed
    // NOTE: We do NOT send email here anymore.
    // The email sending is now handled by the Bulk Email controller or specific "Notify" actions.
    // This endpoint only updates the status in the database.
    // However, if the frontend explicitly requests a notification (e.g. via query param or body), we could support it.
    // For now, based on requirements, we disable the automatic email here so that dashboard status changes are silent.
    
    /* 
    if (status && ['SHORTLISTED', 'REJECTED', 'SELECTED', 'INTERVIEW_SCHEDULED', 'HIRED'].includes(status)) {
        // ... (Email logic removed/commented out) ...
    }
    */
    // const startup = job.startupId; 

    /* 
    if (status && ['SHORTLISTED', 'REJECTED', 'SELECTED', 'INTERVIEW_SCHEDULED', 'HIRED'].includes(status)) {
        // ... (Email logic removed/commented out) ...
        const student = application.studentId;
        const job = application.jobId;

        // ... notification logic was here ...
    }
    */

    return res.status(200).json({
        success: true,
        message: 'Application updated',
        data: application
    });
});

const deleteApplication = async_handler(async (req, res) => {
    const applicationId = req.params.applicationId;

    // Fetch before delete to get details for notification
    const application = await Application.findById(applicationId).populate({
        path: 'jobId',
        populate: { path: 'startupId', populate: { path: 'userId' } }
    }).populate('studentId');

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'Application not found'
        });
    }

    // Role check: only student can delete their own application, or startup for their job?
    // For now, let's assume it's the student withdrawing
    const student = application.studentId;
    const job = application.jobId;
    const startup = job ? job.startupId : null;

    await Application.findByIdAndDelete(applicationId);

    // Notify Startup about withdrawal
    if (startup && startup.userId && req.user.role === 'STUDENT') {
        try {
            await createAndSendNotification(
                startup.userId._id,
                "Application Withdrawn",
                `${student.firstName} ${student.lastName} has withdrawn their application for the ${job.role} position.`,
                'warning',
                null
            );
        } catch (notifErr) {
            console.error("Failed to notify startup of withdrawal:", notifErr);
        }
    }

    return res.status(200).json({
        success: true,
        message: 'Application deleted'
    });
});

const getJobApplicants = async_handler(async (req, res) => {
    const { jobId } = req.params;

    let query = Application.find({ jobId });

    // Apply applicant limit if on FREE plan
    if (req.planFeatures && req.planFeatures.applicantLimit !== Infinity) {
        query = query.limit(req.planFeatures.applicantLimit);
    }

    const applications = await query
        .populate({
            path: 'studentId',
            select: 'firstName lastName email profilepic skills education experience resumeUrl' // Added resumeUrl
        })
        .sort({ atsScore: -1 });

    return res.status(200).json({
        success: true,
        count: applications.length,
        limitApplied: req.planFeatures ? req.planFeatures.applicantLimit : null,
        data: applications
    });
});

module.exports = {
    createApplication, getAllApplications, getApplication, getStudentApplications, updateApplication, deleteApplication, getJobApplicants
};

