const express = require("express");
const router = express.Router();
const token__middleware = require("../middleware/jwttoken.middleware");
const { checkPlanAccess } = require("../middleware/plan.middleware");
const analytics = require("../controller/analytics/postAnalytics.controller");
const hiringAnalytics = require("../controller/analytics/hiringAnalytics.controller");

router.get("/post/:postId", token__middleware, checkPlanAccess("analytics"), analytics.postAnalytics);
router.get("/post/:postId/timeline", token__middleware, checkPlanAccess("analytics"), analytics.postTimeline);
router.get("/startup/:startupid/summary", token__middleware, checkPlanAccess("analytics"), analytics.startupSummary);
router.get("/content-performance", token__middleware, checkPlanAccess("analytics"), analytics.contentPerformance);
router.get("/hiring/summary", token__middleware, checkPlanAccess("analytics"), hiringAnalytics.getHiringAnalytics);
router.get("/hiring/advanced", token__middleware, checkPlanAccess("jobAnalysis", "Advanced"), hiringAnalytics.getAdvancedHiringAnalytics);

module.exports = router;
