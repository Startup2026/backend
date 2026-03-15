const PLAN_FEATURES = {
  FREE: {
    amount: 0,
    paymentTemporarilyDisabled: false,
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
    originalAmount: 1999,
    discountLabel: "Launching Discount",
    paymentTemporarilyDisabled: false,
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
    originalAmount: 2999,
    discountLabel: "Launching Discount",
    paymentTemporarilyDisabled: false,
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
    amount: 3999,
    originalAmount: 4999,
    discountLabel: "Launching Discount",
    paymentTemporarilyDisabled: false,
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
