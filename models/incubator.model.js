const mongoose = require('mongoose');

const incubatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  revenue_share_percentage: {
    type: Number,
    default: 10, // Example 10%
    min: 0,
    max: 100
  },
  payoutDetails: {
    method: {
      type: String,
      enum: ['upi', 'bank'],
      default: 'upi'
    },
    upiId: {
      type: String,
      trim: true,
      default: ''
    },
    bankAccountHolderName: {
      type: String,
      trim: true,
      default: ''
    },
    bankAccountNumber: {
      type: String,
      trim: true,
      default: ''
    },
    bankName: {
      type: String,
      trim: true,
      default: ''
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    branchName: {
      type: String,
      trim: true,
      default: ''
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

incubatorSchema.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const incubatorId = docToUpdate._id;
      
      // Delete Posts by this incubator
      const Post = mongoose.model('post');
      const posts = await Post.find({ incubatorId: incubatorId });
      for (const post of posts) {
        await Post.findByIdAndDelete(post._id);
      }

      // Unlink Startups (don't delete them)
      await mongoose.model('StartupProfile').updateMany(
        { incubatorId: incubatorId }, 
        {
          $set: {
            incubatorId: null,
            incubator_verified: false,
            incubator_verified_at: null,
            incubator_claimed: false
          },
          $unset: {
            incubator: 1
          }
        }
      );

      // Detach historical revenue records from this incubator.
      const RevenueTransaction = mongoose.model('RevenueTransaction');
      const linkedRevenueTxs = await RevenueTransaction.find({ incubatorId: incubatorId }).select('_id net_amount');
      const linkedRevenueTxIds = linkedRevenueTxs.map((tx) => tx._id);
      if (linkedRevenueTxIds.length > 0) {
        await RevenueTransaction.updateMany(
          { _id: { $in: linkedRevenueTxIds } },
          { $set: { incubatorId: null, incubator_share: 0 } }
        );

        await RevenueTransaction.updateMany(
          { _id: { $in: linkedRevenueTxIds } },
          [{ $set: { platform_share: '$net_amount' } }]
        );
      }

      // Unlink Users
      await mongoose.model('User').updateMany(
        { incubatorId: incubatorId },
        { $set: { incubatorId: null } }
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Incubator', incubatorSchema);
