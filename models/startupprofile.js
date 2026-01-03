const mongoose = require("mongoose");

const startupProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  startupName: {
    type: String,
    required: true
  },
  industry: String,
  website: String,
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model("StartupProfile", startupProfileSchema);
