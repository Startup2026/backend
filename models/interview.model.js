const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true
  },
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StartupProfile",
    required: true
  },
  scheduleDate: Date, // Legacy support if needed
  interviewDate: String, // Storing as string or Date based on controller
  interviewTime: String,
  mode: String,
  interviewLink: String,
  interviewer: String,
  notes: String,
  status: {
    type: String, 
    default: "scheduled"
  }
}, { timestamps: true });

module.exports = mongoose.model("Interview", interviewSchema);
