const express = require("express");
const async_handler = require("express-async-handler");
const mongoose = require('mongoose');
const Application = require("../../../models/application.model");
const StudentProfile = require("../../../models/studentprofile.model");
const StartupProfile = require("../../../models/startupprofile.model");
const Job = require("../../../models/job.model");

/**
 * Application day-wise trend (last N days)
 */
const summary = async_handler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const startup = await StartupProfile.findOne({ userId });
  if (!startup) return res.status(404).json({ success: false, error: "Startup not found" });

  const jobs = await Job.find({ startupId: startup._id }).select("_id");
  const jobIds = jobs.map(j => j._id);

  const N = 7;
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - (N - 1));
  startDate.setHours(0, 0, 0, 0);

  const result = await Application.aggregate([
    { $match: { jobId: { $in: jobIds }, createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.day": 1 } }
  ]);

  const formatted = result.map(r => ({ day: r._id.day, count: r.count }));
  return res.json({ success: true, data: formatted });
});

/**
 * Educational distribution for applicants of a given job (or all jobs if jobId omitted)
 * Query params:
 *  - jobId (optional)
 *  - by (optional): 'degree' | 'college' | 'graduationYear' (default 'degree')
 */
const educationalDistribution = async_handler(async (req, res) => {
  const jobId = req.params.jobId || req.query.jobId;
  const by = req.query.by || 'degree';
  const allowed = ['degree', 'college', 'graduationYear'];
  if (!allowed.includes(by)) return res.status(400).json({ success: false, error: "Invalid 'by' parameter" });

  const match = {};
  if (jobId) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, error: "Invalid jobId" });
    }
    match.jobId = mongoose.Types.ObjectId(jobId);
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'studentprofiles',
        localField: 'studentId',
        foreignField: '_id',
        as: 'student'
      }
    },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
    { $project: { field: { $ifNull: [`$student.education.${by}`, 'Unknown'] } } },
    { $group: { _id: '$field', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { key: '$_id', count: 1, _id: 0 } }
  ];

  const result = await Application.aggregate(pipeline);
  return res.json({ success: true, distribution: result });
});

/**
 * Skills distribution for applicants (from Application.skills string)
 * - jobId optional
 * - counts unique students per skill (case-insensitive)
 */
const skillsDistribution = async_handler(async (req, res) => {
  const jobId = req.params.jobId || req.query.jobId;
  const match = {};
  if (jobId) {
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, error: "Invalid jobId" });
    }
    match.jobId = mongoose.Types.ObjectId(jobId);
  }

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        skillsArray: {
          $cond: [
            { $or: [{ $eq: ["$skills", null] }, { $eq: ["$skills", ""] }] },
            [],
            {
              $map: {
                input: { $split: ["$skills", ","] },
                as: "s",
                in: { $trim: { input: "$$s" } }
              }
            }
          ]
        }
      }
    },
    { $unwind: "$skillsArray" },
    { $match: { skillsArray: { $ne: "" } } },
    { $project: { skill: { $toLower: "$skillsArray" }, studentId: 1 } },
    { $group: { _id: { skill: "$skill", student: "$studentId" } } },
    { $group: { _id: "$_id.skill", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { key: '$_id', count: 1, _id: 0 } }
  ];

  const result = await Application.aggregate(pipeline);
  return res.json({ success: true, distribution: result });
});

module.exports = { summary, educationalDistribution, skillsDistribution };