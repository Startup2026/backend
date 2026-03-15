const asyncHandler = require("express-async-handler");
const Job = require("../../../models/job.model");
const JobReport = require("../../../models/jobReport.model");

exports.createJobReport = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { reason, details } = req.body;

  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (req.user.role !== "student") {
    return res.status(403).json({ success: false, error: "Only students can report jobs." });
  }

  if (!reason) {
    return res.status(400).json({ success: false, error: "reason is required" });
  }

  const job = await Job.findById(jobId).select("_id role startupId");
  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }

  const existingOpenReport = await JobReport.findOne({
    jobId,
    reporterId: req.user.id,
    status: "open",
  });

  if (existingOpenReport) {
    return res.status(409).json({ success: false, error: "You already reported this job." });
  }

  const report = await JobReport.create({
    jobId,
    reporterId: req.user.id,
    reason,
    details: typeof details === "string" ? details : "",
  });

  return res.status(201).json({ success: true, data: report });
});

exports.getMyJobReports = asyncHandler(async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const reports = await JobReport.find({ reporterId: req.user.id })
    .sort({ createdAt: -1 })
    .populate({
      path: "jobId",
      select: "role startupId location jobType salary stipend",
      populate: {
        path: "startupId",
        select: "startupName",
      },
    })
    .lean();

  return res.json({ success: true, data: reports });
});

exports.getReportedJobsForModeration = asyncHandler(async (req, res) => {
  const status = req.query.status || "open";

  const query = status === "all" ? {} : { status };

  const reports = await JobReport.find(query)
    .sort({ createdAt: -1 })
    .populate({
      path: "jobId",
      select: "role startupId location jobType salary stipend createdAt",
      populate: {
        path: "startupId",
        select: "startupName",
      },
    })
    .populate("reporterId", "username email")
    .populate("reviewedBy", "username email")
    .lean();

  return res.json({ success: true, data: reports });
});

exports.reviewReportedJob = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { action, adminNote } = req.body;

  if (!["keep", "remove"].includes(action)) {
    return res.status(400).json({ success: false, error: "action must be keep or remove" });
  }

  const report = await JobReport.findById(reportId);
  if (!report) {
    return res.status(404).json({ success: false, error: "Report not found" });
  }

  if (report.status !== "open") {
    return res.status(400).json({ success: false, error: "Report already reviewed" });
  }

  const reviewedStatus = action === "keep" ? "kept" : "removed";
  const now = new Date();

  await JobReport.updateMany(
    { jobId: report.jobId, status: "open" },
    {
      $set: {
        status: reviewedStatus,
        reviewedBy: req.user?.id || null,
        reviewedAt: now,
        adminNote: typeof adminNote === "string" ? adminNote : "",
      },
    }
  );

  if (action === "remove") {
    await Job.findByIdAndDelete(report.jobId);
  }

  return res.json({ success: true, message: `Report marked as ${reviewedStatus}` });
});

exports.getModerationStats = asyncHandler(async (_req, res) => {
  const [openReports, keptReports, removedReports, totalReports] = await Promise.all([
    JobReport.countDocuments({ status: "open" }),
    JobReport.countDocuments({ status: "kept" }),
    JobReport.countDocuments({ status: "removed" }),
    JobReport.countDocuments({}),
  ]);

  return res.json({
    success: true,
    data: {
      openReports,
      keptReports,
      removedReports,
      totalReports,
    },
  });
});
