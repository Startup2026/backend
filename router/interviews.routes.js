const express = require('express');
const router = express.Router();
const interviewController = require('../controller/startups/interviewScheduleController/interviewSchedule.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// Schedule an interview for an application
router.post('/interviews/:applicationId/schedule', token__middleware, interviewController.scheduleInterview);

module.exports = router;
