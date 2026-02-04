const express = require("express");
const router = express.Router();
const token__middleware = require("../middleware/jwttoken.middleware");
const analytics = require("../controller/analytics/postAnalytics.controller");

router.get("/analytics/post/:postId", token__middleware, analytics.postAnalytics);
router.get("/analytics/post/:postId/timeline", token__middleware, analytics.postTimeline);
router.get("/analytics/startup/:startupid/summary", token__middleware, analytics.startupSummary);
router.get("/analytics/content-performance", token__middleware, analytics.contentPerformance);

module.exports = router;
