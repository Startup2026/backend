const express = require("express");
const router = express.Router();
const jobController = require("../controller/common/jobController/job.controller");
const tokenMiddleware = require("../middleware/jwttoken.middleware");

router.post("/create-job", tokenMiddleware, jobController.createJob);
router.get("/get-all-jobs", tokenMiddleware, jobController.getJobs);
router.get("/get-job/:id", tokenMiddleware, jobController.getJobById);
router.put("/update-job/:id", tokenMiddleware, jobController.updateJob);
router.delete("/delete-job/:id", tokenMiddleware, jobController.deleteJob);

module.exports = router;
