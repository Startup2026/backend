const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { User } = require("../models/user.model");
const { StartupProfile } = require("../models/startupprofile.model");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order endpoint
router.post("/create-order", async (req, res) => {
  try {
    const { plan } = req.body;
    // Set amount based on plan
    const amount = plan === "PREMIUM" ? 10000 : 0; // 100.00 INR
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
    });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
});

// Payment verification endpoint
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;
    // 1. Verify signature
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }
    // 2. Update user plan in DB (assume user is authenticated, e.g., req.user.id)
    await User.findByIdAndUpdate(req.user.id, {
      plan: plan || "PREMIUM",
      planActive: true,
      planActivatedAt: new Date(),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Verification failed" });
  }
});

module.exports = router;
