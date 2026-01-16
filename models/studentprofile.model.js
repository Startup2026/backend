// studentprofile.model.js
const mongoose = require("mongoose");


const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Changed 'role' to 'title' to match frontend
  company: { type: String, required: true },
  duration: { type: String } // Matches frontend mapping
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String },
  location: { type: String },
  bio: { type: String, maxlength: 300 },
  
  profilepic: {
      type: String,
      trim: true
    },
  // Update Education to be an Array and match frontend keys
  education: [{
    institution: { type: String, required: true },
    degree: { type: String },
    field: { type: String },
    startYear: { type: String },
    endYear: { type: String }
  }],

  // Add missing fields sent by frontend
  skills: [String],
  interests: [String],
  githubUrl: { type: String },
  linkedinUrl: { type: String },
  portfolioUrl: { type: String },
  resumeUrl: { type: String },

  experience: {
    type: [experienceSchema],
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model("StudentProfile", studentProfileSchema);