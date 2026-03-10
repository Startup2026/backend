const mongoose = require("mongoose");

const postViewSchema = new mongoose.Schema({
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post",
        required: true
    },
    viewerIp: {
        type: String,
        required: true,
        trim: true
    },
    viewed_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

postViewSchema.index({ post: 1, viewerIp: 1 }, { unique: true });

module.exports = mongoose.model("PostView", postViewSchema);
