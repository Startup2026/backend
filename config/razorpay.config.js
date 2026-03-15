const razorpay=require("razorpay")
const dotenv=require("dotenv")

dotenv.config()
const razorpayInstance = ()=>{
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || process.env.test_api_key;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || process.env.test_secret_key;

    if (!keyId || !keySecret) {
        throw new Error("Razorpay key configuration is missing. Set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (or compatible fallbacks).");
    }

    return new razorpay({
    key_id:keyId,
    key_secret:keySecret
    });
}

module.exports = razorpayInstance;
