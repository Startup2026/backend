const mongoose = require('mongoose');

const revenueTransactionSchema = new mongoose.Schema({
  startupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StartupProfile',
    required: true
  },
  incubatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incubator',
    default: null
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment', // The original payment record that spawned this
  },
  total_amount_paid: {
    type: Number,
    required: true,
    description: "Total amount paid by startup (including gateway fees)"
  },
  net_amount: {
    type: Number,
    required: true,
    description: "Amount after 2% gateway fee deduction"
  },
  gateway_fee: {
    type: Number,
    default: 0
  },
  platform_share: {
    type: Number,
    required: true,
    description: "Amount for Wostup (Net - Incubator Share)"
  },
  incubator_share: {
    type: Number,
    default: 0,
    description: "10% of Net Amount"
  },
  transaction_type: {
    type: String,
    enum: ['Subscription', 'Feature Add-on', 'Other'],
    default: 'Subscription'
  }
}, { timestamps: true });

module.exports = mongoose.model('RevenueTransaction', revenueTransactionSchema);
