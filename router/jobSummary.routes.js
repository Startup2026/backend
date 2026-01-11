const express = require('express');
const router = express.Router();
const jobSummary = require('../controller/jobPostSpecificSummary/jobPostSpecificSummary');
const token__middleware = require('../middleware/jwttoken.middleware');

router.get('/job-summary/:jobId', token__middleware, jobSummary.getJobPostSpecificSummary);

module.exports = router;
