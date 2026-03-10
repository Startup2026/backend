const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["student", "startup", "admin", "platform_admin", "incubator_admin", "startup_admin"],
    required: true
  },
  incubatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incubator',
    default: null
  },
  isVerified: {
    type: Boolean,
    default: true // Users in this collection are now verified by default
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Cascade delete related data when a User is deleted
userSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      // Delete profiles linked to this user
      
      // Trigger StudentProfile middleware (cascades to Applications)
      const StudentProfile = mongoose.model('StudentProfile');
      const students = await StudentProfile.find({ userId: docToUpdate._id });
      for (const student of students) {
         await StudentProfile.findByIdAndDelete(student._id);
      }

      const StartupProfile = mongoose.model('StartupProfile');
      
      // We need to trigger StartupProfile's middleware too, so we find and delete them individually
      const startups = await StartupProfile.find({ userId: docToUpdate._id });
      for (const startup of startups) {
        await StartupProfile.findByIdAndDelete(startup._id);
      }

      await mongoose.model('StartupVerification').deleteMany({ userId: docToUpdate._id });
      
      // Delete user interactions
      // Using try-catch for these in case models aren't registered yet or other issues
      try { await mongoose.model('PostLike').deleteMany({ user: docToUpdate._id }); } catch(e) {}
      try { await mongoose.model('PostSave').deleteMany({ user: docToUpdate._id }); } catch(e) {}
      try { await mongoose.model('PostView').deleteMany({ user: docToUpdate._id }); } catch(e) {}
      try { await mongoose.model('Notification').deleteMany({ recipient: docToUpdate._id }); } catch(e) {}
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", userSchema);
