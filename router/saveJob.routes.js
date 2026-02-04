const express = require('express');
const router = express.Router();
const savJobController = require('../controller/students/saveJobController/saveJob.controller');
const token__middleware = require('../middleware/jwttoken.middleware'); 
// POST /sav-jobs/:jobId
router.post('/save-job/:jobId', token__middleware, savJobController.saveJob);
// GET /sav-jobs
router.get('/save-job', token__middleware, savJobController.getSavedJobs);
// DELETE /sav-jobs/:jobId
router.delete('/delete-saved-job/:jobId', token__middleware, savJobController.removeSavedJob);
module.exports = router;