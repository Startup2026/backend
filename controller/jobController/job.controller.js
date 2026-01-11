const Job = require('../../models/job.model');
const StartupProfile = require('../../models/startupprofile.model');
const async_handler = require("express-async-handler");

/**
 * CREATE JOB
 */
const createJob = async_handler(async (req, res) => {
  try {
    const { startupId, title } = req.body;

    // Ensure startup exists
    const startup = await StartupProfile.findById(startupId);
    if (!startup) {
      return res.status(404).json({ success: false, error: 'Startup not found' });
    }

    const job = new Job(req.body);
    await job.save();

    return res.status(201).json({
      success: true,
      data: job
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET ALL JOBS
 */
const getJobs = async_handler(async (req, res) => {
  try {
    const jobs = await Job.find().populate('startupId', 'startupName industry');
    return res.json({
      success: true,
      data: jobs
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET JOB BY ID
 */
const getJobById = async_handler(async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      'startupId',
      'startupName industry'
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * UPDATE JOB
 */
const updateJob = async_handler(async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * DELETE JOB
 */
const deleteJob = async_handler(async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob
};









