const async_handler = require('express-async-handler');
const SaveJob = require('../../../models/saveJob.model');

/**
 * SAVE JOB (POST)
 * Usage: POST /api/save-job/:jobId
 * Body: { "studentId": "..." }
 */
const saveJob = async_handler(async(req, res) => {
    try {
        const { studentId } = req.body;
        const { jobId } = req.params;

        if (!studentId || !jobId) {
            return res.status(400).json({ success: false, error: 'Student ID and Job ID are required' });
        }

        const existingSave = await SaveJob.findOne({ studentId, jobId });
        if (existingSave) {
            return res.status(400).json({ success: false, error: 'Job already saved' });
        }

        const newSave = new SaveJob({ studentId, jobId });
        await newSave.save();
        return res.status(201).json({ success: true, data: newSave });
    } catch (err) {
        console.error("Save Job Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET SAVED JOBS (GET)
 * Usage: GET /api/save-job?studentId=...
 * FIXED: Now checks req.query.studentId because GET requests have no body.
 */
// Example fix for saveJob.controller.js
const getSavedJobs = async_handler(async (req, res) => {
  try {
    // 1. Verify req.user exists (set by jwttoken.middleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, error: "Unauthorized: User not found in request" });
    }

    // 2. Access the ID correctly (usually req.user.id from your middleware)
    const studentUserId = req.user.id;

    // 3. Query your SaveJob model using that ID
    // Assuming your model uses 'studentId' as a field
    const savedJobs = await SaveJob.find({ studentId: studentUserId }).populate('jobId');

    return res.json({ success: true, data: savedJobs });
  } catch (error) {
    console.error("Get Saved Jobs Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * REMOVE SAVED JOB (DELETE)
 * Usage: DELETE /api/delete-job/:jobId
 * Body: { "studentId": "..." }
 */
const removeSavedJob = async_handler(async(req, res) => {
    try {
        const { jobId } = req.params;
        const { studentId } = req.body; // Keeping this in Body as requested

        if (!jobId || !studentId) {
            return res.status(400).json({ success: false, error: 'jobId and studentId are required' });
        }

        const savedJob = await SaveJob.findOneAndDelete({ studentId, jobId });

        if (!savedJob) {
            return res.status(404).json({ success: false, error: 'Saved job not found or already removed' });
        }
        return res.json({ success: true, data: savedJob });
    } catch (err) {
        console.error("Remove Job Error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = { saveJob, getSavedJobs, removeSavedJob };