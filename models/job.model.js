const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StartupProfile",
    required: true
  },
  role:{
    type:String,
    required:true
  },
  aboutRole: {
    type: String,
    required: true
  },
  keyResponsibilities:{type: String},
  requirements: {type:String},
  perksAndBenifits:{type:String},
  stipend:{
    type:Boolean,
    default:false
  },
  salary:{
    type:Number
  },
  openings:{
    type:Number,
  },
  deadline:{
    type:String,
    required:true
  },
  jobType:{
    type:String,
    enum:["Remote","Hybrid","Offline", "Full-Time", "Internship", "Contract"],
    required:true
  },
  location: {
    type: String,
    default: "Remote"
  },
  Tag:{
    type:[String],
    required:true
  }
}, { timestamps: true });

// Cascade delete related applications and saved jobs when a Job is deleted
jobSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const jobId = docToUpdate._id;
      // Delete Applications one by one to trigger Application middleware
      const Application = mongoose.model('Application');
      const apps = await Application.find({ jobId });
      for (const app of apps) {
        await Application.findByIdAndDelete(app._id);
      }
      
      await mongoose.model('SaveJob').deleteMany({ jobId });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Job", jobSchema);
