const express = require('express');
const router = express.Router();
const startupController = require('../user/startupProfile.Controller');
const protect = require('../middleware/jwttoken.middleware');

router.put('/toggle-dashboard', protect, startupController.toggleDashboard);

module.exports = router;