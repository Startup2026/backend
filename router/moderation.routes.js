const express = require("express");
const router = express.Router();

const tokenMiddleware = require("../middleware/jwttoken.middleware");
const { isPlatformAdmin } = require("../middleware/adminRole.middleware");
const jobReportController = require("../controller/common/reportController/jobReport.controller");
const adminDashboardController = require("../controller/admin/adminDashboard.controller");

router.post("/reports/jobs/:jobId", tokenMiddleware, jobReportController.createJobReport);
router.get("/reports/jobs/me", tokenMiddleware, jobReportController.getMyJobReports);

router.get("/admin/moderation/jobs", tokenMiddleware, isPlatformAdmin, jobReportController.getReportedJobsForModeration);
router.patch("/admin/moderation/jobs/:reportId", tokenMiddleware, isPlatformAdmin, jobReportController.reviewReportedJob);
router.get("/admin/moderation/stats", tokenMiddleware, isPlatformAdmin, jobReportController.getModerationStats);

router.get("/admin/dashboard/summary", tokenMiddleware, isPlatformAdmin, adminDashboardController.getAdminDashboardSummary);

module.exports = router;
