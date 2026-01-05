const express = require("express");
// user
const signup=require("../user/user.Controller");
const login=require("../user/auth.Controller")
const startupProfile=require("../user/startupProfile.Controller")
const studentProfile=require("../user/studentProfile.Controller")
// job & post controllers
const job = require("../controller/jobController/job.controller");
const post = require("../controller/postController/post.controller");



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





// // pitch crud api
// router.post("/create-pitch",token__middleware,uploads.fields([{name:"image",maxCount:1},{name:"pitchDeck",maxCount:1}]),pitch.pitch_reg);
// router.put("/update-pitch/:id", token__middleware, uploads.fields([{name:"image",maxCount:1},{name:"pitchDeck",maxCount:1}]), pitch.updatepitch);
// router.get("/get-all-pitches",token__middleware,pitch.get_all_pitches);
// // allow public access to view a pitch if it's marked public; controller will enforce privacy
// router.get("/get-pitch/:id", token__middleware,pitch.get_only_pitch)
// router.delete("/delete-pitch/:id", token__middleware,pitch.delete_only_pitch)
// // 

// // post crud api
// router.post("/create-post",token__middleware,uploads.fields([{name:"image",maxCount:1},{name:"video",maxCount:1}]),post.createPost);
// router.get("/get-all-posts",token__middleware,post.getallPosts);
// router.get("/get-post/:id",token__middleware,post.getonlyPost);
// router.put("/update-post/:id",token__middleware,post.updatepost);
// router.delete("/delete-post/:id",token__middleware,post.deletePost);
// // 

// // poll crud api
// router.post("create-poll",token__middleware,polls.createpoll);
// router.put("update-poll",token__middleware,polls.updatepoll);
// router.post("get-all-polls",token__middleware,polls.getallpolls);
// router.post("get-poll",token__middleware,polls.getpoll);
// router.delete("delete-poll",token__middleware,polls.deletepoll);

// //like,comment apis
// router.post("like/:pitch_post_id",review.like)
// router.post("unlike/:pitch_post_id",review.unlike)
// router.post("comment/:pitch_post_id",review.comments)
// router.delete("delete-comment/:pitch_post_id/:comment_id",review.deletecomment)
// //

// // Events endpoints
// router.post("/events", token__middleware, eventsController.createEvent);
// router.get("/events", eventsController.getEvents);
// router.get("/events/:id", eventsController.getEvent);
// router.put("/events/:id", token__middleware, eventsController.updateEvent);
// router.delete("/events/:id", token__middleware, eventsController.deleteEvent);
// router.post("/hiring",token__middleware,hiring.create_hiring)


module.exports=router;