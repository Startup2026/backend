const mongoose = require("mongoose");

const post = new mongoose.Schema({
    startupid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StartupProfile",
        required: true,
    },
    media: {
        video: {
            type: String,
        },
        photo: {
            type: String
        }
    },
    title: {
        type: String
    },
    description: {
        type: String
    },
    likes: {
        type: Number,
        default: 0,
        required: false
    },
    comments: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true
            },
            text: {
                type: String,
                required: true,
                trim: true
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]

}, { timestamps: true });

module.exports = mongoose.model("post", post);