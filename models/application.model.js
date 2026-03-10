const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job",
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentProfile",
    required: true
  },
  atsScore: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: [
      "APPLIED",
      "SHORTLISTED",
      "REJECTED",
      "INTERVIEW_SCHEDULED",
      "SELECTED"
    ],
    default: "APPLIED"
  },
  statusVisible: {
    type: Boolean,
    default: false
  },
  notifiedAt: {
    type: Date
  },
  isNotified: {
    type: Boolean,
    default: false
  },
  resumeUrl: {
    type: String,
    default: null
  }
}, { timestamps: true });

// Cascade delete related interviews when an Application is deleted
applicationSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
        await mongoose.model('Interview').deleteMany({ applicationId: docToUpdate._id });
        await mongoose.model('Selection').deleteMany({ applicationId: docToUpdate._id });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Application", applicationSchema);
