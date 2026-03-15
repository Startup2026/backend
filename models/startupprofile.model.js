const mongoose = require("mongoose");

const startupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    profilepic: {
      type: String,
      trim: true
    },
    startupName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },

    numberOfEmployees: {
      type: Number,
      min: 1
    },

    tagline: {
      type: String,
      trim: true,
      maxlength: 150
    },

    aboutus: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    productOrService: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    cultureAndValues: {
      type: String,
      trim: true,
      maxlength: 1000
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
    },
    leadershipTeam: [{
      user: {
        type: String,
        trim: true
      },
      role: String
    }],
    updates: [{
      title: String,
      content: String,
      date: Date
    }],
    views: {
      type: Number,
      default: 0
    },
    subscriptionPlan: {
      type: String,
      enum: ["FREE", "SPRINT_3MO", "BUILDER_6MO", "PARTNER_12MO"],
      default: "FREE"
    },
    subscriptionStatus: {
      type: String,
      enum: ["ACTIVE", "TRIAL", "EXPIRED"],
      default: "ACTIVE"
    },
    subscriptionEndDate: {
      type: Date
    },
    verified: {
      type: Boolean,
      default: false
    },

    // Eligibility Fields
    legally_registered: { type: Boolean, default: false },

    registration_type: { type: String, enum: ['Private Limited', 'LLP', 'Sole Proprietorship', 'Partnership', 'Public Limited', 'Other'] },
    cin: {
      type: String,
      trim: true,
      uppercase: true
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    llpin: {
      type: String,
      trim: true,
      uppercase: true
    },
    udyamNumber: {
      type: String,
      trim: true,
      uppercase: true
    },
    startupIndiaId: {
      type: String,
      trim: true
    },
    founderPhone: {
      type: String,
      trim: true
    },
    founderEmail: {
      type: String,
      trim: true,
      lowercase: true
    },

    year_of_incorporation: { type: Number },
    team_size_range: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '500+'] },
    primary_business_model: { type: String, enum: ['SaaS', 'Marketplace', 'AI', 'Mobile App', 'Deep Tech', 'Hardware', 'E-Commerce', 'Other'] },
    owns_proprietary_product: { type: Boolean, default: false },
    product_url: { type: String, trim: true },
    revenue_model: { type: String, enum: ['Subscription', 'Licensing', 'Transaction Fees', 'Client Contracts', 'Hourly Billing', 'Ad-Based', 'Other'] },
    primarily_service_based: { type: Boolean, default: false },
    product_description: { type: String, trim: true },
    eligibility_score: { type: Number, default: 0 },
    eligibility_status: { type: String, enum: ['Eligible Startup', 'Needs Manual Review', 'Not Eligible', 'Pending'], default: 'Pending' },
    approval_status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },

    // Incubation
    incubatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incubator', default: null }, // Actual reference to the model
    incubator: { type: String, trim: true }, // Legacy/string version if manual entry
    incubator_claimed: { type: Boolean, default: false },
    incubator_verified: { type: Boolean, default: false },
    incubator_verified_at: { type: Date },
    incubationCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'IncubationCode', default: null },
    incubationCodeUsedAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Cascade delete jobs, posts, interviews when a StartupProfile is deleted
startupSchema.pre('findOneAndDelete', async function (next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const startupId = docToUpdate._id;

      // Delete Jobs - trigger job middleware if added later
      const Job = mongoose.model('Job');
      const jobs = await Job.find({ startupId });
      for (const job of jobs) {
        await Job.findByIdAndDelete(job._id);
      }

      // Delete Posts - trigger post middleware if added later
      const Post = mongoose.model('post');
      const posts = await Post.find({ startupid: startupId });
      for (const post of posts) {
        await Post.findByIdAndDelete(post._id);
      }

      // Delete Interviews directly
      await mongoose.model('Interview').deleteMany({ startupId });

      // Remove revenue transactions tied to a deleted startup profile.
      // startupId is required on RevenueTransaction, so keeping them would create orphans.
      await mongoose.model('RevenueTransaction').deleteMany({ startupId });

      // Delete Applications? Handled by Job deletion cascade.
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("StartupProfile", startupSchema);
