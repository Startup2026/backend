const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    planType: {
        type: String,
        enum: ['FREE', 'SPRINT_3MO', 'BUILDER_6MO', 'PARTNER_12MO'],
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

// Cascade delete revenue rows generated from this payment.
paymentSchema.pre('findOneAndDelete', async function(next) {
    try {
        const docToUpdate = await this.model.findOne(this.getQuery());
        if (docToUpdate) {
            await mongoose.model('RevenueTransaction').deleteMany({ paymentId: docToUpdate._id });
        }
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Payment', paymentSchema);
