const express = require('express');
const router = express.Router();
const tokenMiddleware = require('../middleware/jwttoken.middleware');
const { isIncubatorAdmin } = require('../middleware/adminRole.middleware');
const incubatorController = require('../controller/incubator.controller');
const incubatorPublicController = require('../controller/incubatorPublic.controller');

// Public / Shared roles
router.get('/list', incubatorPublicController.listIncubators); //testing
router.post('/create-profile', tokenMiddleware, incubatorPublicController.createIncubatorProfile);

// All routes here require the user to be an authenticated Incubator Admin
router.use(tokenMiddleware, isIncubatorAdmin);

router.get('/dashboard', incubatorController.getIncubatorDashboardStats);
router.get('/startups', incubatorController.getIncubatorStartups);
router.get('/analytics', incubatorController.getIncubatorRevenue);
router.get('/invitation-codes', incubatorController.listIncubationCodes);
router.get('/feed', incubatorController.getIncubatorFeed);
router.get('/payout-details', incubatorController.getIncubatorPayoutDetails);
router.post('/invitation-codes', incubatorController.createIncubationCode);
router.put('/payout-details', incubatorController.saveIncubatorPayoutDetails);
router.put('/startup/:startupId/verify', incubatorController.verifyStartupIncubator);
router.put('/startup/:startupId/reject', incubatorController.rejectStartupIncubator);

module.exports = router;
