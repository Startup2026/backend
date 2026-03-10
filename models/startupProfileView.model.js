const mongoose = require("mongoose");

const startupProfileViewSchema = new mongoose.Schema(
  {
    startupProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StartupProfile",
      required: true,
      index: true,
    },
    viewerIp: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

startupProfileViewSchema.index({ startupProfile: 1, viewerIp: 1 }, { unique: true });

module.exports = mongoose.model("StartupProfileView", startupProfileViewSchema);
