const express = require('express');
const router = express.Router();
const jobSummary = require('../controller/startups/jobPostSpecificSummary/jobPostSpecificSummary');
const token__middleware = require('../middleware/jwttoken.middleware');
const { checkPlanAccess } = require("../middleware/plan.middleware");

router.get('/job-summary/:jobId', token__middleware, checkPlanAccess("jobAnalysis"), jobSummary.getJobPostSpecificSummary);

module.exports = router;
