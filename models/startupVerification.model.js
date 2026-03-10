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
  brandName: String,
  companyType: String,
  registeredCity: String,
  registeredState: String,
  cin: String,
  llpin: String,
  gstNumber: String,
  udyamNumber: String,
  startupIndiaId: String,
  founderName: String,
  founderLinkedIn: String,
  founderPhone: String,
  founderEmail: String,
  status: {
    type: String,
    enum: ['unverified', 'pending', 'verified', 'rejected'],
    default: 'unverified'
  },
  // Add any other fields you need for verification, e.g., incorporation documents
}, { timestamps: true });

const StartupVerification = mongoose.model('StartupVerification', startupVerificationSchema);

module.exports = StartupVerification;
