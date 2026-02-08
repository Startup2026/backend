const async_handler = require("express-async-handler");
const Application = require("../../../models/application.model");
const Job = require("../../../models/job.model");
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const createApplication = async_handler(async (req, res) => {
    const { jobId, studentId } = req.params;
    // Check if resume file was uploaded
    const resumeFile = req.files && req.files['resume'] ? req.files['resume'][0] : null;

    console.log(`Processing application for Job: ${jobId}, Student: ${studentId}`);

    let atsScore = 0;
    let applicationStatus = "APPLIED";

    try {
        // 1. Fetch Job Description
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ success: false, error: "Job not found" });
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
                // Prepare form data with file stream from disk
                const form = new FormData();
                form.append('resume', fs.createReadStream(resumeFile.path));
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
    const resumeUrl = resumeFile ? `/media/${resumeFile.filename}` : null;

    const newApplication = new Application({ 
        atsScore, 
        status: applicationStatus, 
        jobId, 
        studentId, 
        resumeUrl: resumeUrl
    });
    
    await newApplication.save();

    return res.status(201).json({
        success: true,
        message: "Application submitted.",
        data: newApplication
    });
});

const getAllApplications = async_handler(async (req, res) => {
    const allApplications = await Application.find()
        .populate('studentId', 'firstname lastname')
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
    const { studentId } = req.params;
    
    // Find all applications for this student and populate job + startup details
    const applications = await Application.find({ studentId })
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

    const application = await Application.findByIdAndUpdate(applicationId, req.body, {
        new: true, runValidators: true
    });

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'Application not found'
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Application updated',
        data: application
    });
});

const deleteApplication = async_handler(async (req, res) => {
    const applicationId = req.params.applicationId;

    const application = await Application.findByIdAndDelete(applicationId);

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'Application not found'
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Application deleted'
    });
});

module.exports = {
    createApplication, getAllApplications, getApplication, getStudentApplications, updateApplication, deleteApplication
};

