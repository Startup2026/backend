const async_handler = require("express-async-handler");
const Application = require("../../../models/application.model");
const StartupProfile = require("../../../models/startupprofile.model");
const Job = require("../../../models/job.model");

const mainSummary = async_handler(async (req, res) => {
    // 1. Identify Startup
    const userId = req.user.id || req.user._id;
    const startup = await StartupProfile.findOne({ userId });

    if (!startup) {
        return res.status(404).json({ success: false, error: "Startup profile not found" });
    }

    const startupId = startup._id;

    // 2. Find all Jobs for this startup
    const jobs = await Job.find({ startupId }).select('_id');
    const jobIds = jobs.map(j => j._id);

    if (jobIds.length === 0) {
        return res.status(200).json({
            "mainSummary": {
                totalApplications: 0,
                totalShortlisted: 0,
                totalRejected: 0,
                lastsevendays: 0,
                avgATS: 0
            }
        });
    }

    // 3. Stats
    const totalApplications = await Application.countDocuments({ jobId: { $in: jobIds } });
    const totalShortlisted = await Application.countDocuments({ jobId: { $in: jobIds }, status: "SHORTLISTED" });
    const totalRejected = await Application.countDocuments({ jobId: { $in: jobIds }, status: "REJECTED" });
    
    const now = new Date();
    const sevendaysago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const lastsevendays = await Application.countDocuments({
        jobId: { $in: jobIds },
        createdAt: {
            $gte: sevendaysago
        }
    });

    const result = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
            $group: {
                _id: null,
                averageats: {
                    $avg: "$atsScore"
                },
            }
        }
    ]);

    const avgATS = result.length > 0 ? Math.round(result[0].averageats) : 0;

    return res.status(200).json({
        "mainSummary": { totalApplications, totalShortlisted, totalRejected, lastsevendays, avgATS }
    });
});

module.exports={
    mainSummary
}