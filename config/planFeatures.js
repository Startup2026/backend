const PLAN_FEATURES = {
  FREE: {
    amount: 0,
    durationMonths: null,
    displayName: "Community Free",
    maxActiveJobs: 2,
    analytics: "basic",
    bulkEmail: true,
    jobAnalysis: "basic",
    socialRecruiter: false,
    interviewCalendar: true,
  },
  SPRINT_3MO: {
    amount: 999,
    durationMonths: 3,
    displayName: "Sprint · 3 Months",
    maxActiveJobs: 9999,
    analytics: "full",
    bulkEmail: true,
    jobAnalysis: "advanced",
    socialRecruiter: true,
    interviewCalendar: true,
    prioritySupport: true,
  },
  BUILDER_6MO: {
    amount: 1999,
    durationMonths: 6,
    displayName: "Builder · 6 Months",
    maxActiveJobs: 9999,
    analytics: "full",
    bulkEmail: true,
    jobAnalysis: "advanced",
    socialRecruiter: true,
    interviewCalendar: true,
    prioritySupport: true,
  },
  PARTNER_12MO: {
    amount: 2999,
    durationMonths: 12,
    displayName: "Partner · 12 Months",
    maxActiveJobs: 9999,
    analytics: "full",
    bulkEmail: true,
    jobAnalysis: "advanced",
    socialRecruiter: true,
    interviewCalendar: true,
    prioritySupport: true,
  },
};

const LEGACY_PLAN_ALIASES = {
  GROWTH: "SPRINT_3MO",
  PRO: "BUILDER_6MO",
  ENTERPRISE: "PARTNER_12MO",
};

const normalizePlanName = (plan) => {
  if (!plan) return "FREE";
  const upperPlan = plan.toString().toUpperCase();
  if (PLAN_FEATURES[upperPlan]) return upperPlan;
  if (LEGACY_PLAN_ALIASES[upperPlan]) {
    return LEGACY_PLAN_ALIASES[upperPlan];
  }
  return null;
};

module.exports = { PLAN_FEATURES, LEGACY_PLAN_ALIASES, normalizePlanName };
