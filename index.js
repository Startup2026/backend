// ---------------- START SERVER ----------------

const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/config");
const userModel = require("./models/user.model");
const cookieParser = require("cookie-parser");
const applicationRouter=require("./router/applications.routes.js");
const startupProfileRouter=require("./router/startupProfile.routes.js");
const userRouter=require("./router/users.routes.js");
const graphicalRouter=require("./router/graphical.routes.js");
const interviewsRouter=require("./router/interviews.routes.js");
const jobsRouter=require("./router/jobs.routes.js");
const jobSummaryRouter=require("./router/jobSummary.routes.js");
const mainSummaryRouter=require("./router/mainSummary.routes.js");
const myJobApplicationsRouter=require("./router/myJobApplications.routes.js");
const postsRouter=require("./router/posts.routes.js");
const selectionsRouter=require("./router/selections.routes.js");
const saveJobRouter=require("./router/saveJob.routes.js");
const savPostRouter=require("./router/savePost.routes.js");

dotenv.config();
connectDB();

const app = express();

// Allow requests from your React frontend with credentials (cookies)
const allowedOrigins = (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.split(',')) || ['http://localhost:8080'];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true, // allow cookies/tokens
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept']
}));
app.use(express.json());
app.use(cookieParser());

// app.use((req, res, next) => {
//   console.log("Incoming cookies:", req.headers.cookie);
//   console.log("Parsed cookies:", req.cookies);
//   next();
// });

app.use(express.urlencoded({ extended: true }));
app.use("/media", express.static(path.join(__dirname, "media")));
// Mount all routers under /api so individual route paths defined in each router file map to `/api/<route>`
app.use("/api", userRouter);
app.use("/api", applicationRouter);
app.use("/api", graphicalRouter);
app.use("/api", interviewsRouter);
app.use("/api", jobsRouter);
app.use("/api", jobSummaryRouter);
app.use("/api", mainSummaryRouter);
app.use("/api", myJobApplicationsRouter);
app.use("/api", postsRouter);
app.use("/api", selectionsRouter);
app.use("/api", startupProfileRouter);
app.use("/api", saveJobRouter);
app.use("/api", savPostRouter);

const isProduction = process.env.NODE_ENV === "production";



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
