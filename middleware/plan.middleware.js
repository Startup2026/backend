const StartupProfile = require("../models/startupprofile.model");
const { PLAN_FEATURES } = require("../config/planFeatures");
const asyncHandler = require("express-async-handler");

exports.checkPlanAccess = (featureKey, requiredLevel = null) => {
  return asyncHandler(async (req, res, next) => {
    // We assume req.user is populated by jwttoken.middleware
    if (!req.user || req.user.role !== "startup") {
      return res.status(403).json({ success: false, error: "Access denied. Startup account required." });
    }

    const startup = await StartupProfile.findOne({ userId: req.user.id });
    if (!startup) {
      return res.status(403).json({ 
        success: false, 
        error: "Startup profile not found. Please complete your profile first.",
        code: "PROFILE_REQUIRED" 
      });
    }

    // Check if plan has been selected (if we want to force that step)
    if (!startup.subscriptionPlan) {
        startup.subscriptionPlan = "FREE";
        startup.subscriptionStatus = "ACTIVE";
        await startup.save();
    }

    // Check subscription status
    if (startup.subscriptionStatus === "EXPIRED" || (startup.subscriptionEndDate && new Date() > startup.subscriptionEndDate)) {
      if (startup.subscriptionStatus !== "EXPIRED") {
          startup.subscriptionStatus = "EXPIRED";
          startup.subscriptionPlan = "FREE";
          await startup.save();
      }
    }

    const plan = startup.subscriptionPlan || "FREE";
    const features = PLAN_FEATURES[plan];

    req.startupProfile = startup; // Attach for further use
    req.plan = plan;
    req.planFeatures = features;

    if (featureKey && (!features || !features[featureKey])) {
      return res.status(403).json({ 
        success: false, 
        error: `Feature '${featureKey}' not available in your current plan (${plan}).`,
        plan: plan,
        featureKey: featureKey
      });
    }

    // Level check
    if (requiredLevel && features[featureKey] !== "advanced" && features[featureKey] !== "full" && features[featureKey] !== "custom") {
        if (requiredLevel === "Advanced") {
            return res.status(403).json({
                success: false,
                error: `Advanced access for '${featureKey}' requires a higher plan (Pro/Enterprise).`,
                plan: plan
            });
        }
    }

    next();
  });
};

exports.checkUsageLimit = (limitKey) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user || req.user.role !== "startup") {
      return res.status(403).json({ success: false, error: "Access denied. Startup account required." });
    }

    const startup = await StartupProfile.findOne({ userId: req.user.id });
    if (!startup) {
      return res.status(404).json({ success: false, error: "Startup profile not found." });
    }

    const plan = startup.subscriptionPlan || "FREE";
    const limitValue = PLAN_FEATURES[plan][limitKey];

    if (limitKey === "maxActiveJobs") {
        const Job = require("../models/job.model");
        const activeJobsCount = await Job.countDocuments({ startupId: startup._id });
        if (activeJobsCount >= limitValue) {
            return res.status(403).json({ 
                success: false, 
                error: `Active jobs limit reached for ${plan} plan. Limit: ${limitValue}`,
                plan: plan
            });
        }
    }

    if (limitKey === "maxInterviewsPerMonth") {
        const Interview = require("../models/interview.model");
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // We count interviews created this month for this startup
        // Note: Startup profile _id is used to link interviews potentially
        // Let's check interview model to see how it's linked
        const interviewCount = await Interview.countDocuments({ 
            startupId: startup._id,
            createdAt: { $gte: startOfMonth }
        });

        if (interviewCount >= limitValue) {
            return res.status(403).json({
                success: false,
                error: `Monthly interview limit reached for ${plan} plan. Limit: ${limitValue} / month`,
                plan: plan
            });
        }
    }

    req.startupProfile = startup;
    next();
  });
};
