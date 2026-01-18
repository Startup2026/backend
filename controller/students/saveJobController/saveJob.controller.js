const async_handler=require('express-async-handler');
const SaveJob=require('../../../models/saveJob.model');

const saveJob=async_handler(async(req,res)=>{
    try{
        const {studentId,jobId}=req.body;
        const existingSave=await SaveJob.findOne({studentId,jobId});
        if(existingSave){
            return res.status(400).json({success:false,error:'Job already saved'});
        }
        const saveJob=new SaveJob({studentId,jobId});
        await saveJob.save();
        return res.status(201).json({success:true,data:saveJob});
    }catch(err){
        console.error(err);
        return res.status(400).json({success:false,error:err.message});
    }  
});

/**
 * GET SAVED JOBS
 */
const getSavedJobs = async_handler(async(req,res)=>{
    try{
        const {studentId} = req.body;
        if(!studentId){
            return res.status(400).json({success:false,error:'studentId is required'});
        }
        const savedJobs = await SaveJob.find({studentId}).populate('jobId');
        return res.json({success:true,data:savedJobs});
    }catch(err){
        console.error(err);
        return res.status(500).json({success:false,error:err.message});
    }
});

/**
 * REMOVE SAVED JOB
 */
const removeSavedJob = async_handler(async(req,res)=>{
    try{
        const {jobId} = req.params;
        const {studentId} = req.body;
        if(!jobId || !studentId){
            return res.status(400).json({success:false,error:'jobId and studentId are required'});
        }
        const savedJob = await SaveJob.findOneAndDelete({studentId,jobId});
        if(!savedJob){
            return res.status(404).json({success:false,error:'Saved job not found'});
        }
        return res.json({success:true,data:savedJob});
    }catch(err){
        console.error(err);
        return res.status(500).json({success:false,error:err.message});
    }
});

module.exports={saveJob,getSavedJobs,removeSavedJob};