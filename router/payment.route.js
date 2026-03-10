const express = require('express');
const razorpayController = require('../controller/razorpay/razorpay.controller');
const tokenMiddleware = require('../middleware/jwttoken.middleware');

const router = express.Router();

// Create order
router.post('/create-order', tokenMiddleware, razorpayController.createOrder);

// Verify payment
router.post('/verify-payment', tokenMiddleware, razorpayController.verifyPayment);

// Get payment details
router.get('/payment/:paymentId', tokenMiddleware, razorpayController.getPaymentDetails);

// Refund payment
router.post('/refund', tokenMiddleware, razorpayController.refundPayment);

// Get platform revenue summary (Admin only)
router.get('/admin/revenue-summary', tokenMiddleware, razorpayController.getPlatformRevenueSummary);

module.exports = router;