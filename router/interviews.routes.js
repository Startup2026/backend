const express = require('express');
const router = express.Router();
const interviewController = require('../controller/startups/interviewScheduleController/interviewSchedule.controller');
const token__middleware = require('../middleware/jwttoken.middleware');
const { checkPlanAccess, checkUsageLimit } = require('../middleware/plan.middleware');

// Schedule an interview for an application
router.post('/interviews/:applicationId/schedule', token__middleware, checkUsageLimit('maxInterviewsPerMonth'), interviewController.scheduleInterview);

// Get all interviews for the startup
router.get('/interviews', token__middleware, checkPlanAccess('interviewCalendar'), interviewController.getInterviews);

// Reschedule an interview
router.put('/interviews/:id/reschedule', token__middleware, checkPlanAccess('interviewCalendar'), interviewController.rescheduleInterview);

// Update interview status
router.put('/interviews/:id/status', token__middleware, checkPlanAccess('interviewCalendar'), interviewController.updateInterviewStatus);

// Student Responds to interview
router.put('/interviews/:id/respond', token__middleware, interviewController.respondToInterview);

module.exports = router;
