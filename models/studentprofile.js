const mongoose = require("mongoose");

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  education: String,
  experience: {
    type: Number, // in years
    default: 0
  },
  skills: [String],
  resumeUrl: String
}, { timestamps: true });

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
