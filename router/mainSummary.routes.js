const express = require('express');
const router = express.Router();
const mainSummary = require('../controller/mainSummaryController/mainSummary.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

router.get('/get-main-summary', token__middleware, mainSummary.mainSummary);

module.exports = router;
