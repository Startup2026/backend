const Job = require("../../../models/job.model");
const StartupProfile = require("../../../models/startupprofile.model");
const asyncHandler = require("express-async-handler");

// CREATE JOB
exports.createJob = asyncHandler(async (req, res) => {
  const {
    startupId,
    role,
    aboutRole,
    keyResponsibilities,
    requirements,
    perksAndBenifits,
    stipend,
    salary,
    openings,
    deadline,
    jobType,
    location,
    Tag
  } = req.body;

  if (!startupId || !role || !aboutRole || !deadline || !jobType) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  const startup = await StartupProfile.findById(startupId);
  if (!startup) {
    return res.status(404).json({ success: false, error: "Startup not found" });
  }

  const job = await Job.create({
    startupId,
    role,
    aboutRole,
    keyResponsibilities,
    requirements,
    perksAndBenifits,
    stipend: stipend === true,
    salary: stipend === true ? salary : null,
    openings,
    deadline,
    jobType,
    location,
    Tag: Array.isArray(Tag) ? Tag : []
  });

  res.status(201).json({ success: true, data: job });
});

// GET ALL JOBS
exports.getJobs = asyncHandler(async (req, res) => {
  const jobs = await Job.find()
    .populate("startupId", "startupName industry location")
    .lean();

  res.json({ success: true, data: jobs });
});

// GET JOB BY ID
exports.getJobById = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate("startupId", "startupName industry location")
    .lean();

  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }

  res.json({ success: true, data: job });
});

// UPDATE JOB
exports.updateJob = asyncHandler(async (req, res) => {
  const allowed = [
    "role",
    "aboutRole",
    "keyResponsibilities",
    "requirements",
    "perksAndBenifits",
    "stipend",
    "salary",
    "openings",
    "deadline",
    "jobType",
    "Tag"
  ];

  const updates = {};
  Object.keys(req.body).forEach(key => {
    if (allowed.includes(key)) updates[key] = req.body[key];
  });

  if ("stipend" in updates) {
    updates.stipend = updates.stipend === true;
    updates.salary = updates.stipend ? updates.salary : null;
  }

  if ("Tag" in updates) {
    updates.Tag = Array.isArray(updates.Tag) ? updates.Tag : [];
  }

  const job = await Job.findByIdAndUpdate(req.params.id, updates, {
    new: true
  });

  res.json({ success: true, data: job });
});

// DELETE JOB
exports.deleteJob = asyncHandler(async (req, res) => {
  await Job.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
