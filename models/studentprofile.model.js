// studentprofile.model.js
const mongoose = require("mongoose");


const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true }, // Changed 'role' to 'title' to match frontend
  company: { type: String, required: true },
  duration: { type: String } // Matches frontend mapping
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String },
  location: { type: String },
  bio: { type: String, maxlength: 300 },
  
  profilepic: {
      type: String,
      trim: true
    },
  // Update Education to be an Array and match frontend keys
  education: [{
    institution: { type: String, required: true },
    degree: { type: String },
    field: { type: String },
    startYear: { type: String },
    endYear: { type: String }
  }],

  // Add missing fields sent by frontend
  skills: [String],
  interests: [String],
  githubUrl: { type: String },
  linkedinUrl: { type: String },
  portfolioUrl: { type: String },
  resumeUrl: { type: String },

  experience: {
    type: [experienceSchema],
    default: []
  }
}, { timestamps: true });

// Cascade delete applications and saved jobs when a StudentProfile is deleted
studentProfileSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const studentId = docToUpdate._id;
      // Delete applications one-by-one so Application middleware can cascade
      // into Interview and Selection cleanup.
      const Application = mongoose.model('Application');
      const applications = await Application.find({ studentId });
      for (const app of applications) {
        await Application.findByIdAndDelete(app._id);
      }
      await mongoose.model('SaveJob').deleteMany({ studentId });
      try {
        await mongoose.model('SavePost').deleteMany({ studentId });
      } catch(e) {}
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("StudentProfile", studentProfileSchema);