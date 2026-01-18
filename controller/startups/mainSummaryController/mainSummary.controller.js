const express=require("express");
const async_handler=require("express-async-handler");
const applications = require("../../../models/application.model");

const mainSummary=async_handler(async(req,res)=>{
    
    const totalApplications = applications.countDocuments();
    const totalShortlisted = applications.countDocuments({status:"SHORTLISTED"});
    const totalRejected = applications.countDocuments({status:"REJECTED"});
    const now= new Date();
    const sevendaysago=new Date(now.getTime()-7*24*60*1000);

    const lastsevendays = applications.countDocuments({getTimestamp:{
        $gte:sevendaysago.getTime(),
        $lte:now.getTime()
    }
    });

    const result = applications.aggregate([{
        $group:{
            averageats:{
                $avg:"atsScore"
            },

        }
    }
    ]);

    const avgATS=result[0]?.averageats||0;
    
    return res.status(200).json({
        "mainSummary" : {totalApplications,totalShortlisted,totalRejected,lastsevendays,avgATS}
    })


});

module.exports={
    mainSummary
}