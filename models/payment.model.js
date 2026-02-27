const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    planType: {
        type: String, // Ensure these match your planTypes in config
        enum: ['FREE', 'GROWTH', 'PRO', 'ENTERPRISE'], 
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'INR'
    },
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    status: {
        type: String,
        enum: ['created', 'success', 'failed'],
        default: 'created'
    }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
