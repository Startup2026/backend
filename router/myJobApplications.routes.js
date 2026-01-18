const express = require('express');
const router = express.Router();
const myJobApplications = require('../controller/students/myJobApplicationsController/myJobApplications.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// Summary for a given student
router.get('/my-applications/summary/:studentId', token__middleware, myJobApplications.summary);

module.exports = router;
