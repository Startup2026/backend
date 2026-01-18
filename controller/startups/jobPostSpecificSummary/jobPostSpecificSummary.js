const async_handler = require("express-async-handler");

const Job = require("../../../models/job.model");
const Application = require("../../../models/application.model");
const StudentProfile = require("../../../models/studentprofile.model");

/**
 * JOB SPECIFIC SUMMARY
 * GET /job-summary/:jobId
 */
const getJobPostSpecificSummary = async_handler(async (req, res) => {
  const { jobId } = req.params;

  // 1. Check job exists
  const job = await Job.findById(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Job not found"
    });
  }

  // 2. Fetch applications for the job
  const applications = await Application.find({ jobId });

  const totalApplications = applications.length;

  // If no applications
  if (totalApplications === 0) {
    return res.json({
      success: true,
      data: {
        totalApplications: 0,
        percentageMeetingCriteria: 0,
        averageATS: 0,
        medianExperience: 0
      }
    });
  }

  // 3. Average ATS
  const totalATS = applications.reduce(
    (sum, app) => sum + (app.atsScore || 0),
    0
  );
  const averageATS = (totalATS / totalApplications).toFixed(2);

  // 4. Experience + criteria calculation
  let experienceList = [];
  let studentsMeetingCriteria = 0;

  for (const application of applications) {
    const profile = await StudentProfile.findById(application.studentId);
    if (!profile || !profile.experience) continue;

    let totalMonths = 0;

    profile.experience.forEach(exp => {
      const start = new Date(exp.startDate);
      const end =
        exp.endDate === "Present"
          ? new Date()
          : new Date(exp.endDate);

      const months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

      totalMonths += months;
    });

    const experienceYears = totalMonths / 12;
    experienceList.push(experienceYears);

    if (experienceYears >= (job.experienceRequired || 0)) {
      studentsMeetingCriteria++;
    }
  }

  // 5. Median Experience
  experienceList.sort((a, b) => a - b);

  const mid = Math.floor(experienceList.length / 2);
  const medianExperience =
    experienceList.length % 2 !== 0
      ? experienceList[mid]
      : (experienceList[mid - 1] + experienceList[mid]) / 2;

  // 6. Percentage meeting criteria
  const percentageMeetingCriteria = (
    (studentsMeetingCriteria / totalApplications) *
    100
  ).toFixed(2);

  return res.json({
    success: true,
    data: {
      totalApplications,
      percentageMeetingCriteria,
      averageATS,
      medianExperience: Number(medianExperience.toFixed(2))
    }
  });
});

module.exports = {
  getJobPostSpecificSummary
};
