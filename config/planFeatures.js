const PLAN_FEATURES = {
  FREE: {
    amount:0,
    maxActiveJobs: 2,
    maxInterviewsPerMonth: 5,
    analytics: "basic",
    bulkEmail: false,
    jobAnalysis: "basic",
    socialRecruiter: false,
    interviewCalendar: true, // Allow access to calendar, usage limit handles the rest
  },
  GROWTH: {
    amount:5000,
    maxActiveJobs: 10,
    maxInterviewsPerMonth: 50,
    analytics: "advanced",
    bulkEmail: true,
    jobAnalysis: "basic",
    socialRecruiter: false,
    interviewCalendar: true,
  },
  PRO: {
    amount:8000,
    maxActiveJobs: 25,
    maxInterviewsPerMonth: 200,
    analytics: "full",
    bulkEmail: true,
    jobAnalysis: "advanced",
    socialRecruiter: true,
    interviewCalendar: true,
  },
  // ENTERPRISE: {
  //   maxActiveJobs: Infinity,
  //   maxInterviewsPerMonth: Infinity,
  //   analytics: "custom",
  //   bulkEmail: true,
  //   jobAnalysis: "advanced",
  //   socialRecruiter: true,
  //   interviewCalendar: true,
  //   prioritySupport: true,
  // }
};

module.exports = { PLAN_FEATURES };
