const async_handler = require("express-async-handler");
const Application = require("../../../models/application.model");

const createApplication = async_handler(async (req, res) => {
    const {
        atsScore, status
    } = req.body;
    const { jobId, studentId } = req.params;
    console.log(jobId)
    const newApplication = new Application({ atsScore, status, jobId, studentId });
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
    createApplication, getAllApplications, getApplication, updateApplication, deleteApplication
};

