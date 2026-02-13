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

module.exports = mongoose.model("Job", jobSchema);
