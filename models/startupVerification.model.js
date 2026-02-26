const mongoose = require('mongoose');

const startupVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Add any other fields you need for verification, e.g., incorporation documents
}, { timestamps: true });

const StartupVerification = mongoose.model('StartupVerification', startupVerificationSchema);

module.exports = StartupVerification;
