const express = require("express");
const router = express.Router();
const {
  setRecruiterPlan,
  setDashboardType,
} = require("../user/startupProfile.Controller");
const token_middleware = require("../middleware/jwttoken.middleware");

// @route   PUT /api/startup-profile/recruiter-plan
// @desc    Update the recruiter plan for the logged-in startup
// @access  Private (Startup)
router.put("/recruiter-plan", token_middleware, setRecruiterPlan);

// @route   PUT /api/startup-profile/dashboard-type
// @desc    Update the dashboard type for the logged-in startup
// @access  Private (Startup)
router.put("/dashboard-type", token_middleware, setDashboardType);

module.exports = router;
