const express = require("express");
// user
const signup=require("../user/user.Controller");
const login=require("../user/auth.Controller")
const startupProfile=require("../user/startupProfile.Controller")
const studentProfile=require("../user/studentProfile.Controller")
// job & post controllers
const job = require("../controller/jobController/job.controller");
const post = require("../controller/postController/post.controller");
const mainSummary=require("../controller/mainSummaryController/mainSummary.controller")
const jobPostSpecificSummary=require("../controller/graphicalJobAnalisis/graphicalJobAnalisis");
const jobSummary = require("../controller/jobPostSpecificSummary/jobPostSpecificSummary");
const selectionsRoutes = require('./selections.routes');


// 
// middleware
const token__middleware=require("../middleware/jwttoken.middleware");
const uploads=require("../middleware/fileuploads.middleware");
// 
const router=express.Router()



// authentication
router.post("/signup", signup.createUser);
router.post("/login", login.loginUser);
router.post("/studentProfile", studentProfile.createProfile);
router.post("/startupProfile", startupProfile.createProfile);
// 


// testing remained
// ================= JOB CRUD APIs =================

// create job (startup only – controller should enforce role)
router.post("/create-job", token__middleware, job.createJob);

// get all jobs (public or authenticated – your choice)
router.get("/get-all-jobs", token__middleware, job.getJobs);

// get single job
router.get("/get-job/:id", token__middleware, job.getJobById);

// update job
router.put("/update-job/:id", token__middleware, job.updateJob);

// delete job
router.delete("/delete-job/:id", token__middleware, job.deleteJob);


// ================= POST CRUD APIs =================

// create post (ONLY STARTUP)
router.post(
  "/create-post",
  token__middleware,
  uploads.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 }
  ]),
  post.createPost
);

// get all posts
router.get("/get-all-posts", token__middleware, post.getPosts);

// get single post
router.get("/get-post/:id", token__middleware, post.getPostById);

// delete post
router.delete("/delete-post/:id", token__middleware, post.deletePost);

// testing remained// main summary API
router.get("/get-main-summary", token__middleware, mainSummary.mainSummary);

// testing remained
// job post specific graphs
router.get(
  "/get-job-post-day-wise-trend",
  token__middleware,
  jobPostSpecificSummary.summary
);

router.get(
  "/get-job-post-education",
  token__middleware,
  jobPostSpecificSummary.educationalDistribution
);

router.get(
  "/get-main-skills",
  token__middleware,
  jobPostSpecificSummary.skillsDistribution
);


// job post specific summary
router.get(
  "/job-summary/:jobId",
  token__middleware,
  jobSummary.getJobPostSpecificSummary
);

// Selections (send selection emails to multiple application IDs)
router.use('/', selectionsRoutes);

module.exports=router;