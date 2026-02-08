const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String, // 'info', 'success', 'warning', 'error', 'application_update', etc.
    default: 'info'
  },
  read: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId, // Optional: Link to a job, application, etc.
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
