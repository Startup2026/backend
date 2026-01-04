const mongoose = require("mongoose");

const selectionSchema = new mongoose.Schema({
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true
  },
  status: {
    type: String,
    enum: ["APPROVED", "REJECTED"],
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Selection", selectionSchema);
