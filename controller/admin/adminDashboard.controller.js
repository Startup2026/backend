const asyncHandler = require("express-async-handler");
const User = require("../../models/user.model");
const Job = require("../../models/job.model");
const StartupProfile = require("../../models/startupprofile.model");
const StartupVerification = require("../../models/startupVerification.model");
const JobReport = require("../../models/jobReport.model");

const toActivity = (items, mapper) => items.map(mapper).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

exports.getAdminDashboardSummary = asyncHandler(async (_req, res) => {
  const [
    totalUsers,
    totalStudents,
    totalStartups,
    totalJobs,
    openReports,
    pendingVerificationsCount,
    latestUsers,
    latestJobs,
    latestReports,
    pendingVerifications,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: "student" }),
    StartupProfile.countDocuments({}),
    Job.countDocuments({}),
    JobReport.countDocuments({ status: "open" }),
    StartupVerification.countDocuments({ status: { $in: ["pending", "unverified"] } }),
    User.find({}).sort({ createdAt: -1 }).limit(5).select("username role createdAt").lean(),
    Job.find({}).sort({ createdAt: -1 }).limit(5).select("role createdAt startupId").populate("startupId", "startupName").lean(),
    JobReport.find({}).sort({ createdAt: -1 }).limit(5).select("reason status createdAt jobId").populate("jobId", "role").lean(),
    StartupVerification.find({ status: { $in: ["pending", "unverified"] } })
      .sort({ createdAt: -1 })
      .limit(8)
      .select("companyName companyType status createdAt")
      .lean(),
  ]);

  const userActivities = toActivity(latestUsers, (u) => ({
    type: "user",
    action: "New user registered",
    entity: `${u.username} (${u.role})`,
    createdAt: u.createdAt,
  }));

  const jobActivities = toActivity(latestJobs, (j) => ({
    type: "job",
    action: "New job posted",
    entity: `${j.role} at ${j.startupId?.startupName || "Startup"}`,
    createdAt: j.createdAt,
  }));

  const moderationActivities = toActivity(latestReports, (r) => ({
    type: "moderation",
    action: "Job reported",
    entity: `${r.jobId?.role || "Job"} (${r.reason})`,
    createdAt: r.createdAt,
    status: r.status,
  }));

  const recentActivity = [...userActivities, ...jobActivities, ...moderationActivities]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12);

  return res.json({
    success: true,
    data: {
      totals: {
        totalUsers,
        totalStudents,
        totalStartups,
        totalJobs,
        openReports,
        pendingVerificationsCount,
      },
      recentActivity,
      pendingVerifications,
    },
  });
});
