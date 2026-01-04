const mongoose = require("mongoose");

const startupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    startupName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    tagline: {
      type: String,
      trim: true,
      maxlength: 150
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    industry: {
      type: String,
      trim: true,
      enum: [
        "FinTech",
        "EdTech",
        "HealthTech",
        "AI/ML",
        "SaaS",
        "E-Commerce",
        "Web3",
        "Other"
      ]
    },

    stage: {
      type: String,
      enum: ["Idea", "MVP", "Early Traction", "Growth", "Scaling"],
      default: "Idea"
    },

    website: {
      type: String,
      trim: true,
      lowercase: true
    },

    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String
    },

    foundedYear: {
      type: Number,
      min: 1990,
      max: new Date().getFullYear()
    },

    teamSize: {
      type: Number,
      min: 1,
      default: 1
    },

    location: {
      city: String,
      country: String
    },

    hiring: {
      type: Boolean,
      default: false
    },

    verified: {
      type: Boolean,
      default: false
    },

    verificationDetails: {
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin"
      },
      verifiedAt: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("StartupProfile", startupSchema);
