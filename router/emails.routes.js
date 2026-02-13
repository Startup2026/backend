const express = require("express");
const router = express.Router();
const bulkEmailController = require("../controller/startups/bulkEmailController/bulkEmail.controller");
const token_middleware = require("../middleware/jwttoken.middleware");

// POST /emails/bulk
router.post("/emails/bulk", token_middleware, bulkEmailController.sendBulkEmail);

module.exports = router;
