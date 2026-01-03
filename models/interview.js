const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true
  },
  meetingLink: String,
  scheduleDate: Date,
  message: String
}, { timestamps: true });

module.exports = mongoose.model("Interview", interviewSchema);
