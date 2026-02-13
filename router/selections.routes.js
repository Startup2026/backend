const express = require('express');
const router = express.Router();
const selectionController = require('../controller/startups/selectionController/selection.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// POST /selections/notify
// Body: { subject, message, applicationIdList: ["id1","id2", ...] }
router.post('/selections/notify', token__middleware, selectionController.sendSelectionNotification);

// POST /shortlists/notify
router.post('/shortlists/notify', token__middleware, selectionController.sendShortlistNotification);

// POST /rejections/notify
router.post('/rejections/notify', token__middleware, selectionController.sendRejectionNotification);

module.exports = router;
