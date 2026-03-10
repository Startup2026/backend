const Job = require("../../../models/job.model");
const StartupProfile = require("../../../models/startupprofile.model");
const Application = require("../../../models/application.model");
const asyncHandler = require("express-async-handler");
const { createAndSendNotification } = require("../../../utils/notificationHelper");

const parseDeadline = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const isPastDeadlineDate = (deadlineDate) => {
  const endOfDay = new Date(deadlineDate);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < new Date();
};

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

  const parsedDeadline = parseDeadline(deadline);
  if (!parsedDeadline) {
    return res.status(400).json({ success: false, error: "Invalid deadline" });
  }

  if (isPastDeadlineDate(parsedDeadline)) {
    return res.status(400).json({ success: false, error: "Deadline cannot be in the past" });
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
    deadline: parsedDeadline.toISOString().split('T')[0],
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

  if ("deadline" in updates) {
    const parsedDeadline = parseDeadline(updates.deadline);
    if (!parsedDeadline) {
      return res.status(400).json({ success: false, error: "Invalid deadline" });
    }
    if (isPastDeadlineDate(parsedDeadline)) {
      return res.status(400).json({ success: false, error: "Deadline cannot be in the past" });
    }
    updates.deadline = parsedDeadline.toISOString().split('T')[0];
  }

  const job = await Job.findByIdAndUpdate(req.params.id, updates, {
    new: true
  });

  res.json({ success: true, data: job });
});

// DELETE JOB
exports.deleteJob = asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const job = await Job.findById(jobId).populate('startupId');
  
  if (!job) return res.status(404).json({ success: false, error: "Job not found" });

  // Notify all applicants before deleting (or after, but we need data)
  const applications = await Application.find({ jobId }).populate({
      path: 'studentId'
  });

  for (const app of applications) {
      if (app.studentId && app.studentId.userId) {
          try {
              await createAndSendNotification(
                  app.studentId.userId,
                  "Job Posting Removed",
                  `The job role "${job.role}" at ${job.startupId?.startupName || 'a startup'} has been removed. Your application is no longer active.`,
                  'warning'
              );
          } catch (err) { console.error(err); }
      }
  }

  // Delete applications one-by-one so Application middleware can cascade
  // into Interview and Selection cleanup.
  const applicationsToDelete = await Application.find({ jobId }).select('_id');
  for (const app of applicationsToDelete) {
    await Application.findByIdAndDelete(app._id);
  }
  await Job.findByIdAndDelete(jobId);

  res.json({ success: true, message: "Job and associated applications deleted" });
});
