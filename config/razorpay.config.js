const razorpay=require("razorpay")
const dotenv=require("dotenv")

dotenv.config()
const razorpayInstance = ()=>{
    return new razorpay({
    key_id:process.env.test_api_key,
    key_secret:process.env.test_secret_key
    });
}

module.exports = razorpayInstance;
