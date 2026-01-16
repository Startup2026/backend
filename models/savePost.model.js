const mongoose=require("mongoose");

const saveSchema=new mongoose.Schema({
    jobId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"post",
        required:true
    },  
    studentId:{ 
        type:mongoose.Schema.Types.ObjectId,
        ref:"StudentProfile",
        required:true
    }
},{timestamps:true});

module.exports=mongoose.model("SavePost",saveSchema);