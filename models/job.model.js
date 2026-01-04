const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StartupProfile",
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  experienceRequired: Number,
  educationRequired: String,
  skillsRequired: [String]
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);
