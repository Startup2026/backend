const express = require('express');
const router = express.Router();
const jobPostSpecific = require('../controller/startups/graphicalJobAnalisis/graphicalJobAnalisis');
const token__middleware = require('../middleware/jwttoken.middleware');

router.get('/get-job-post-day-wise-trend', token__middleware, jobPostSpecific.summary);
router.get('/get-job-post-education', token__middleware, jobPostSpecific.educationalDistribution);
router.get('/get-main-skills', token__middleware, jobPostSpecific.skillsDistribution);

module.exports = router;
