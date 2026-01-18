const express = require('express');
const router = express.Router();
const job = require('../controller/common/jobController/job.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

router.post('/create-job', token__middleware, job.createJob);
router.get('/get-all-jobs', token__middleware, job.getJobs);
router.get('/get-job/:id', token__middleware, job.getJobById);
router.put('/update-job/:id', token__middleware, job.updateJob);
router.delete('/delete-job/:id', token__middleware, job.deleteJob);

module.exports = router;
