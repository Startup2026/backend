const express = require('express');
const router = express.Router();
const savJobController = require('../controller/students/saveJobController/saveJob.controller');
const token__middleware = require('../middleware/jwttoken.middleware'); 
// POST /sav-jobs/:jobId
router.post('/sav-jobs/:jobId', token__middleware, savJobController.saveJob);
// GET /sav-jobs
router.get('/sav-jobs', token__middleware, savJobController.getSavedJobs);
// DELETE /sav-jobs/:jobId
router.delete('/sav-jobs/:jobId', token__middleware, savJobController.removeSavedJob);
module.exports = router;