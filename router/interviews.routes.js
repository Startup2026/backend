const express = require('express');
const router = express.Router();
const interviewController = require('../controller/startups/interviewScheduleController/interviewSchedule.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// Schedule an interview for an application
router.post('/interviews/:applicationId/schedule', token__middleware, interviewController.scheduleInterview);

// Get all interviews for the startup
router.get('/interviews', token__middleware, interviewController.getInterviews);

// Reschedule an interview
router.put('/interviews/:id/reschedule', token__middleware, interviewController.rescheduleInterview);

// Update interview status
router.put('/interviews/:id/status', token__middleware, interviewController.updateInterviewStatus);

module.exports = router;
