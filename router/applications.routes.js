const express = require('express');
const router = express.Router();
const applicationController = require('../controller/applicationController/applications.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// Create application (jobId and studentId in params)
// POST /applications/:jobId/:studentId
router.post('/applications/:jobId/:studentId', token__middleware, applicationController.createApplication);

// Get all applications
router.get('/applications', token__middleware, applicationController.getAllApplications);

// Get application by jobId & studentId (controller expects these params)
router.get('/applications/:jobId/:studentId', token__middleware, applicationController.getApplication);

// Update application
router.put('/applications/:applicationid', token__middleware, applicationController.updateApplication);

// Delete application
router.delete('/applications/:applicationId', token__middleware, applicationController.deleteApplication);

module.exports = router;
