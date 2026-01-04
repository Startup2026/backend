const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true
  },
  scheduleDate: Date,
}, { timestamps: true });

module.exports = mongoose.model("Interview", interviewSchema);
