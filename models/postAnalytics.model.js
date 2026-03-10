const mongoose = require("mongoose");

const postAnalyticsSchema = new mongoose.Schema({
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post",
        required: true,
        unique: true
    },
    views_count: {
        type: Number,
        default: 0
    },
    unique_views_count: {
        type: Number,
        default: 0
    },
    likes_count: {
        type: Number,
        default: 0
    },
    comments_count: {
        type: Number,
        default: 0
    },
    saves_count: {
        type: Number,
        default: 0
    },
    shares_count: {
        type: Number,
        default: 0
    },
    engagement_rate: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Ensure calculating engagement rate before saving isn't strictly necessary here if we do it in controller,
// but adding a method is good practice.
postAnalyticsSchema.methods.calculateEngagement = function() {
    const interactions = this.likes_count + this.comments_count + this.saves_count;
    const views = Math.max(this.views_count, 1);
    this.engagement_rate = (interactions / views) * 100;
};

module.exports = mongoose.model("PostAnalytics", postAnalyticsSchema);
