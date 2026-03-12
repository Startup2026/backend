const mongoose = require('mongoose');

const incubationCodeSchema = new mongoose.Schema(
  {
    incubatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incubator',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sentFromEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    usedByStartupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StartupProfile',
      default: null,
    },
    usedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('IncubationCode', incubationCodeSchema);