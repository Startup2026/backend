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
                educationDistribution: []
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

    // C. Experience Distribution (Assuming experience is stored in studentProfile)
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
    
    const conversionRate = totalApplications > 0 ? (totalSelected / totalApplications) * 100 : 0;

    res.json({
        success: true,
        data: {
            totalApplications,
            statusDistribution: statusStats.map(s => ({ status: s._id, count: s.count })),
            applicationsOverTime: timeStats.map(t => ({ date: t._id, count: t.count })),
            topSkills: skillsStats.map(s => ({ skill: s._id, count: s.count })),
            conversionRate: Math.round(conversionRate),
            experienceDistribution: formattedExperience,
            educationDistribution: educationStats.map(e => ({ degree: e._id, count: e.count }))
        }
    });

});

module.exports = {
    getHiringAnalytics
};
