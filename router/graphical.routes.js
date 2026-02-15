const express = require('express');
const router = require('express').Router();
const jobPostSpecific = require('../controller/startups/graphicalJobAnalisis/graphicalJobAnalisis');
const token__middleware = require('../middleware/jwttoken.middleware');
const { checkPlanAccess } = require('../middleware/plan.middleware');

router.get('/get-job-post-day-wise-trend', token__middleware, checkPlanAccess('analytics'), jobPostSpecific.summary);
router.get('/get-job-post-education', token__middleware, checkPlanAccess('analytics'), jobPostSpecific.educationalDistribution);
router.get('/get-main-skills', token__middleware, checkPlanAccess('analytics'), jobPostSpecific.skillsDistribution);

module.exports = router;
