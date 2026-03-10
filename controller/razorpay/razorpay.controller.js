const async_handler = require("express-async-handler");
const createrazorpayInstance = require("../../config/razorpay.config");
const { PLAN_FEATURES, normalizePlanName } = require("../../config/planFeatures"); 
const Payment = require("../../models/payment.model");
const StartupProfile = require("../../models/startupprofile.model");
const Incubator = require("../../models/incubator.model");
const User = require("../../models/user.model"); // Added User model
const RevenueTransaction = require("../../models/revenueTransaction.model");
const { createAndSendNotification } = require("../../utils/notificationHelper"); // Added Helper
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

    const normalizedPlanType = normalizePlanName(planType);

    if (!normalizedPlanType) {
        return res.status(400).json({ message: "Invalid plan type" });
    }

    const planDetails = PLAN_FEATURES[normalizedPlanType];
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
            planType: normalizedPlanType,
            userId: userId.toString()
        }
    };

    try {
        const order = await razorpayInstance.orders.create(options);

        // Save initial payment record with status 'created'
        const payment = new Payment({
            userId,
            planType: normalizedPlanType,
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

    // Use environment variable secret key
    const secret = process.env.test_secret_key || process.env.RAZORPAY_SECRET;

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body.toString())
        .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
        console.log(`>>> [Payment Verification] Signature match for Order: ${razorpay_order_id}`);
        // 1. Find the payment record
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        
        if (!payment) {
             console.error(`>>> [Payment Verification] Payment record not found for Order: ${razorpay_order_id}`);
             return res.status(404).json({ message: "Payment record not found for this order" });
        }

        // 2. Update Payment Status
        payment.razorpayPaymentId = razorpay_payment_id;
        payment.razorpaySignature = razorpay_signature;
        payment.status = 'success';
        await payment.save();

        // 3. Activate Plan for User/Startup
        const startupProfile = await StartupProfile.findOne({ userId: payment.userId });

        if (startupProfile) {
            const normalizedPlan = normalizePlanName(payment.planType) || "FREE";
            console.log(`>>> [Payment Activation] Activating ${normalizedPlan} for Startup: ${startupProfile.startupName}`);
            
            const planConfig = PLAN_FEATURES[normalizedPlan] || {};

            startupProfile.subscriptionPlan = normalizedPlan;
            startupProfile.subscriptionStatus = 'ACTIVE';
            
            const durationMonths = planConfig.durationMonths;
            if (durationMonths) {
                const endDate = new Date();
                endDate.setMonth(endDate.getMonth() + durationMonths);
                startupProfile.subscriptionEndDate = endDate;
            } else {
                startupProfile.subscriptionEndDate = null;
            }
            
            await startupProfile.save();

            // 4. Handle Revenue Transaction and Incubator share
            try {
                // Ensure amount is treated as a number
                const totalAmount = Number(payment.amount);
                const gatewayFee = totalAmount * 0.02; // 2% gateway fee
                const netAmount = totalAmount - gatewayFee; // Amount to split (100% - 2%)

                let incubator_share = 0;
                let usedIncubatorId = null;

                // Share incubator margin only for incubator-approved affiliations.
                const targetIncubatorId = startupProfile.incubator_verified ? startupProfile.incubatorId : null;

                if (targetIncubatorId) {
                    const incubator = await Incubator.findById(targetIncubatorId);
                    if (incubator) {
                        usedIncubatorId = incubator._id;
                        // Incubator gets 10% of the Net Amount
                        incubator_share = netAmount * 0.10;
                        console.log(`>>> [Revenue Logic] Found Incubator: ${incubator.name || usedIncubatorId}. Share: ${incubator_share}`);
                    } else {
                        console.warn(`>>> [Revenue Logic] targetIncubatorId ${targetIncubatorId} provided but no document found in Incubator model.`);
                    }
                } else {
                    console.log(`>>> [Revenue Logic] No incubator-approved affiliation for startup "${startupProfile.startupName}"`);
                }

                // Wostup gets the remaining (Net - Incubator Share)
                const platform_share = netAmount - incubator_share;

                const revenueTx = await RevenueTransaction.create({
                    startupId: startupProfile._id,
                    incubatorId: usedIncubatorId,
                    paymentId: payment._id,
                    total_amount_paid: totalAmount,
                    net_amount: netAmount,
                    gateway_fee: gatewayFee,
                    platform_share: platform_share,
                    incubator_share: incubator_share,
                    transaction_type: 'Subscription'
                });
                console.log(`>>> [Revenue Logic] RevenueTransaction created: ${revenueTx._id} (Shared with Incubator: ${!!usedIncubatorId})`);

                // Notify Incubator Admin if applicable
                if (usedIncubatorId) {
                    try {
                        const admins = await User.find({ incubatorId: usedIncubatorId, role: 'incubator_admin' });
                        console.log(`>>> [Revenue Logic] Notifying ${admins.length} incubator admins for ID: ${usedIncubatorId}`);
                        for (const admin of admins) {
                            await createAndSendNotification(
                                admin._id,
                                "New Revenue Generated",
                                `Affiliated startup "${startupProfile.startupName}" purchased the ${normalizedPlan} plan. Your share: ₹${incubator_share.toFixed(2)}.`,
                                'success'
                            );
                        }
                    } catch (incNotifErr) {
                        console.error("Error notifying incubator admin:", incNotifErr);
                    }
                }
            } catch (err) {
                console.error("Error creating RevenueTransaction or notifying incubator:", err);
            }
        } else {
            console.warn(`>>> [Payment Activation] No StartupProfile found for User: ${payment.userId}`);
        }

        res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            paymentId: razorpay_payment_id,
            planType: normalizePlanName(payment.planType) || payment.planType
        });
    } else {
        console.error(`>>> [Payment Verification] signature mismatch for Order: ${razorpay_order_id}`);
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

const getPlatformRevenueSummary = async_handler(async(req, res) => {
    try {
        // Admin only check
        if (!['admin', 'platform_admin'].includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Access denied: Platform Admin privileges required.' });
        }

        const stats = await RevenueTransaction.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$total_amount_paid" },
                    netRevenue: { $sum: "$net_amount" }, // This is platform + incubator
                    platformShare: { $sum: "$platform_share" },
                    incubatorShare: { $sum: "$incubator_share" },
                    gatewayFees: { $sum: "$gateway_fee" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = stats.length > 0 ? stats[0] : {
            totalRevenue: 0,
            netRevenue: 0,
            platformShare: 0,
            incubatorShare: 0,
            gatewayFees: 0,
            count: 0
        };

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error fetching platform revenue summary:", error);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
});

module.exports = {
    createOrder,
    verifyPayment,
    getPaymentDetails,
    refundPayment,
    getPlatformRevenueSummary
};