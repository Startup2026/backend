const async_handler = require("express-async-handler");
const mongoose = require("mongoose");
const Application = require("../../models/application.model");
const Job = require("../../models/job.model");
const StartupProfile = require("../../models/startupprofile.model");

/**
 * GET /api/analytics/hiring/summary
 * Returns analytics for the logged-in startup user.
 * Supports query param ?jobId=... to filter by a specific job.
 */
const getHiringAnalytics = async_handler(async (req, res) => {
    // 1. Identify Startup
    const userId = req.user.id; 
    const { jobId } = req.query;
    
    const startup = await StartupProfile.findOne({ userId });
    
    if (!startup) {
        return res.status(404).json({ success: false, error: "Startup profile not found" });
    }

    const startupId = startup._id;

    // 2. Identify target Job IDs
    let jobIds = [];
    if (jobId && jobId !== 'all') {
        const targetJob = await Job.findOne({ _id: jobId, startupId });
        if (!targetJob) return res.status(404).json({ success: false, error: "Job not found or unauthorized" });
        jobIds = [targetJob._id];
    } else {
        const jobs = await Job.find({ startupId }).select('_id');
        jobIds = jobs.map(j => j._id);
    }
    
    if (jobIds.length === 0) {
        return res.json({
            success: true,
            data: {
                totalApplications: 0,
                statusDistribution: [],
                applicationsOverTime: [],
                applicationsByJob: [],
                topSkills: [],
                conversionRate: 0,
                experienceDistribution: [],
                educationDistribution: [],
                interviewedCount: 0,
                rejectedCount: 0,
                pendingCount: 0
            }
        });
    }

    // 3. Aggregate Operations

    // A. Status Distribution
    const statusStats = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // B. Applications Over Time (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timeStats = await Application.aggregate([
        { 
            $match: { 
                jobId: { $in: jobIds },
                createdAt: { $gte: thirtyDaysAgo }
            } 
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    // C. Experience Distribution
    const experienceStats = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
            $lookup: {
                from: "studentprofiles",
                localField: "studentId",
                foreignField: "_id",
                as: "student"
            }
        },
        { $unwind: "$student" },
        {
            $project: {
                years: { $size: { $ifNull: ["$student.experience", []] } }
            }
        },
        {
            $bucket: {
                groupBy: "$years",
                boundaries: [0, 1, 2, 4, 10],
                default: "4+",
                output: { count: { $sum: 1 } }
            }
        }
    ]);

    const expMap = { 0: "Fresher", 1: "1 Year", 2: "2-3 Years", 4: "4+ Years" };
    const formattedExperience = experienceStats.map(s => ({
        range: expMap[s._id] || "Senior",
        count: s.count
    }));

    // D. Education Distribution
    const educationStats = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
            $lookup: {
                from: "studentprofiles",
                localField: "studentId",
                foreignField: "_id",
                as: "student"
            }
        },
        { $unwind: "$student" },
        { $unwind: "$student.education" },
        { $group: { _id: "$student.education.degree", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
    ]);

    // E. Top Skills
    const skillsStats = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
            $lookup: {
                from: "studentprofiles",
                localField: "studentId",
                foreignField: "_id",
                as: "student"
            }
        },
        { $unwind: "$student" },
        { $unwind: "$student.skills" },
        { $group: { _id: "$student.skills", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    // F. Total & Conversion
    const totalApplications = await Application.countDocuments({ jobId: { $in: jobIds } });
    const totalSelected = await Application.countDocuments({ 
        jobId: { $in: jobIds }, 
        status: { $in: ["SELECTED", "HIRED"] } 
    });

    const interviewedCount = await Application.countDocuments({
        jobId: { $in: jobIds },
        status: "INTERVIEW_SCHEDULED"
    });

    const rejectedCount = await Application.countDocuments({
        jobId: { $in: jobIds },
        status: "REJECTED"
    });

    const pendingCount = totalApplications - (interviewedCount + rejectedCount + totalSelected);
    
    const conversionRate = totalApplications > 0 ? (totalSelected / totalApplications) * 100 : 0;

    res.json({
        success: true,
        data: {
            totalApplications,
            interviewedCount,
            rejectedCount,
            pendingCount,
            statusDistribution: statusStats.map(s => ({ status: s._id, count: s.count })),
            applicationsOverTime: timeStats.map(t => ({ date: t._id, count: t.count })),
            topSkills: skillsStats.map(s => ({ skill: s._id, count: s.count })),
            conversionRate: Math.round(conversionRate),
            experienceDistribution: formattedExperience,
            educationDistribution: educationStats.map(e => ({ degree: e._id, count: e.count }))
        }
    });

});

/**
 * GET /api/analytics/hiring/advanced
 * Provides deeper statistical metrics for Pro/Enterprise plans.
 */
const getAdvancedHiringAnalytics = async_handler(async (req, res) => {
    const userId = req.user.id;
    const startup = await StartupProfile.findOne({ userId });
    if (!startup) return res.status(404).json({ success: false, error: "Startup not found" });

    const jobs = await Job.find({ startupId: startup._id }).select('_id');
    const jobIds = jobs.map(j => j._id);

    if (jobIds.length === 0) {
        return res.json({ success: true, data: { timeToHire: 0, velocityByStage: [], skillSuccessRates: [] } });
    }

    // 1. Time to Selection (Hiring Velocity)
    const selectionTimes = await Application.aggregate([
        { 
            $match: { 
                jobId: { $in: jobIds }, 
                status: "SELECTED" 
            } 
        },
        {
            $project: {
                timeToSelect: { 
                    $divide: [
                        { $subtract: ["$updatedAt", "$createdAt"] },
                        1000 * 60 * 60 * 24 // Convert to days
                    ]
                }
            }
        },
        {
            $group: {
                _id: null,
                avgDays: { $avg: "$timeToSelect" }
            }
        }
    ]);

    // 2. Yield by Skill (Success rate per skill)
    const skillYield = await Application.aggregate([
        { $match: { jobId: { $in: jobIds } } },
        {
            $lookup: {
                from: "studentprofiles",
                localField: "studentId",
                foreignField: "_id",
                as: "student"
            }
        },
        { $unwind: "$student" },
        { $unwind: "$student.skills" },
        {
            $group: {
                _id: "$student.skills",
                total: { $sum: 1 },
                hired: { 
                    $sum: { 
                        $cond: [{ $eq: ["$status", "SELECTED"] }, 1, 0] 
                    }
                }
            }
        },
        { $sort: { hired: -1, total: -1 } },
        { $limit: 10 }
    ]);

    // 3. Estimated Velocity by Stage (Static progression weights for absence of history)
    // We'll simulate this by looking at distribution ratios
    const totalApps = await Application.countDocuments({ jobId: { $in: jobIds } });
    const shortlistedApps = await Application.countDocuments({ jobId: { $in: jobIds }, status: { $ne: "APPLIED" } });
    const interviewedApps = await Application.countDocuments({ jobId: { $in: jobIds }, status: { $in: ["INTERVIEW_SCHEDULED", "SELECTED"] } });

    const velocity = [
        { phase: "Screening", days: shortlistedApps > 0 ? (totalApps / shortlistedApps).toFixed(1) : 0 },
        { phase: "Interviewing", days: interviewedApps > 0 ? (shortlistedApps / interviewedApps).toFixed(1) : 0 },
        { phase: "Selection", days: selectionTimes[0]?.avgDays?.toFixed(1) || 0 }
    ];

    res.json({
        success: true,
        data: {
            avgTimeToSelect: selectionTimes[0]?.avgDays?.toFixed(1) || 0,
            skillSuccessRates: skillYield.map(s => ({
                skill: s._id,
                rate: s.total > 0 ? Math.round((s.hired / s.total) * 100) : 0,
                count: s.total
            })),
            velocityByStage: velocity
        }
    });
});

module.exports = {
    getHiringAnalytics,
    getAdvancedHiringAnalytics
};
