const async_handler = require("express-async-handler");
const Application = require("../../models/application.model");

const createApplication = async_handler(async (req, res) => {
    const {
        skills, atsScore, status
    } = req.body;
    const { jobId, studentId } = req.params;

    const newApplication = new Application({ skills, atsScore, status, jobId, studentId });

    await newApplication.save();

    return res.status(200).json({
        "message": "Appication Submmited!!!"
    })
});

const getAllApplications = async_handler(async (req, res) => {
    const allApplications = await Application.find().populate('studentid', 'firstname lastname');
    return res.status(201).json({
        "data": allApplications
    })
});

const getApplication = async_handler(async (req, res) => {
    const { jobId, studentId } = req.params;
    const application = await Application.findById({ studentId, jobId });

    return res.status(200).json({
        "data": application
    })
});

const updateApplication = async_handler(async (req, res) => {
    const  applicationId  = req.params.applicationid;

    const application = await Application.findByIdAndUpdate(applicationId, req.body, {
        new: true, runValidators: true
    });

    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'application not found'
        });
    }

    return res.status(201).json({
        "message": "application updated"
    });
});

const deleteApplication = async_handler(async (req, res) => {
    const applicationId  = req.params.applicationId;

    const application = await Application.findByIdAndDelete(applicationId);


    if (!application) {
        return res.status(404).json({
            success: false,
            error: 'application not found'
        });
    }

    return res.status(201).json({
        "message": "Application deleted!!!"
    })
});

module.exports = {
    createApplication, getAllApplications, getApplication, updateApplication, deleteApplication
};

