const mongoose = require("mongoose");

const postSaveSchema = new mongoose.Schema({
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "post",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    saved_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

postSaveSchema.index({ post: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("PostSave", postSaveSchema);
