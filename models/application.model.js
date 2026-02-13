const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentProfile",
    required: true
  },
  atsScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: [
      "APPLIED",
      "SHORTLISTED",
      "REJECTED",
      "INTERVIEW_SCHEDULED",
      "SELECTED"
    ],
    default: "APPLIED"
  },
  statusVisible: {
    type: Boolean,
    default: false
  },
  notifiedAt: {
    type: Date
  },
  isNotified: {
    type: Boolean,
    default: false
  },
  resumeUrl: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("Application", applicationSchema);
