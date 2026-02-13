const express = require("express");
const router = express.Router();
const token__middleware = require("../middleware/jwttoken.middleware");
const analytics = require("../controller/analytics/postAnalytics.controller");
const hiringAnalytics = require("../controller/analytics/hiringAnalytics.controller");

router.get("/post/:postId", token__middleware, analytics.postAnalytics);
router.get("/post/:postId/timeline", token__middleware, analytics.postTimeline);
router.get("/startup/:startupid/summary", token__middleware, analytics.startupSummary);
router.get("/content-performance", token__middleware, analytics.contentPerformance);
router.get("/hiring/summary", token__middleware, hiringAnalytics.getHiringAnalytics);

module.exports = router;
