const async_handler = require("express-async-handler");
const createrazorpayInstance = require("../../config/razorpay.config");
// Import PLAN_FEATURES and use destructuring because it's exported as { PLAN_FEATURES }
const { PLAN_FEATURES } = require("../../config/planFeatures"); 
const Payment = require("../../models/payment.model");
const StartupProfile = require("../../models/startupprofile.model");
const crypto = require("crypto");

// Initialize Razorpay instance
const razorpayInstance = createrazorpayInstance();

const createOrder = async_handler(async (req, res) => {
    // Expect planType in body
    const { planType } = req.body;
    
    // User ID from authenticated request (assuming middleware sets req.user)
    const userId = req.user ? (req.user._id || req.user.id) : null; 

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    if (!planType || !PLAN_FEATURES[planType]) {
        return res.status(400).json({ message: "Invalid plan type" });
    }

    const planDetails = PLAN_FEATURES[planType];
    const amount = planDetails.amount;

    if (amount === 0) {
        // Free plan logic might not need payment gateway, handle accordingly
        // For now, return error or handle free upgrade directly
         return res.status(400).json({ message: "Cannot create payment order for free plan" });
    }

    const options = {
        amount: amount * 100, // Amount in paise
        currency: "INR",
        receipt: `receipt_order_${Date.now()}`,
        notes: {
            planType: planType,
            userId: userId.toString()
        }
    };

    try {
        const order = await razorpayInstance.orders.create(options);

        // Save initial payment record with status 'created'
        const payment = new Payment({
            userId,
            planType,
            amount: amount,
            razorpayOrderId: order.id,
            status: 'created'
        });
        await payment.save();

        res.status(200).json(order);
    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        res.status(500).json({ message: "Something went wrong", error: error.message });
    }
});

const verifyPayment = async_handler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
        .createHmac("sha256", process.env.test_secret_key)
        .update(body.toString())
        .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
        // 1. Find the payment record
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        
        if (!payment) {
             return res.status(404).json({ message: "Payment record not found for this order" });
        }

        // 2. Update Payment Status
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = 'success';
        await payment.save();

        // 3. Activate Plan for User/Startup
        // Assuming the user is a Startup. You might need to check user role.
        const startupProfile = await StartupProfile.findOne({ userId: payment.userId });

        if (startupProfile) {
            startupProfile.subscriptionPlan = payment.planType;
            startupProfile.subscriptionStatus = 'ACTIVE';
            
            // Set subscription end date (e.g., 30 days from now)
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
            startupProfile.subscriptionEndDate = endDate;
            
            await startupProfile.save();
        }

        res.status(200).json({
            message: "Payment verified successfully",
            paymentId: razorpay_payment_id,
            planType: payment.planType
        });
    } else {
        // Signature mismatch - update payment to failed if found
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (payment) {
            payment.status = 'failed';
            await payment.save();
        }
        
        res.status(400).json({
            message: "Payment verification failed",
            success: false
        });
    }
});

const getPaymentDetails = async_handler(async(req,res)=>{
    const { paymentId } = req.params;
    const payment = await Payment.findOne({ razorpayPaymentId: paymentId });
    if(!payment){
        return res.status(404).json({message: "Payment not found"});
    }
    res.json(payment);
});

const refundPayment = async_handler(async(req,res)=>{
    // Implement refund logic here using razorpayInstance.payments.refund(paymentId)
    res.status(501).json({message: "Refund not implemented yet"});
});

module.exports = {
    createOrder,
    verifyPayment,
    getPaymentDetails,
    refundPayment
};