// ---------------- START SERVER ----------------

const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/config");
const userModel = require("./models/user.model");
const routers=require("./router/router.js")
const cookieParser = require("cookie-parser");

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
app.use("/api",routers);
app.use("/api/auth",routers);

const isProduction = process.env.NODE_ENV === "production";



const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
