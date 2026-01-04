const mongoose = require("mongoose");


const experienceSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: String, // Date OR "Present"
    default: "Present"
  }
}, { _id: false });

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String
  },
  location: {
    type: String
  },
  bio: {
    type: String,
    maxlength: 300
  },
  // 🎓 Education
  education: {
    college: {
      type: String,
      required: true
    },
    degree: {
      type: String,
      required: true
    },
    graduationYear: {
      type: Number,
      required: true
    }
  },
  // 💼 Experience
  experience: {
    type: [experienceSchema],
    default: []
  }
},
  { timestamps: true }

);

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
