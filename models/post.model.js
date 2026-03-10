const mongoose = require("mongoose");

const post = new mongoose.Schema({
    startupid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StartupProfile", 
        required: function() { return !this.incubatorId; } // Only required if incubatorId is missing
    },
    incubatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Incubator",
        required: function() { return !this.startupid; } // Only required if startupid is missing
    },
    posterModel: {
        type: String,
        enum: ['StartupProfile', 'Incubator'],
        default: 'StartupProfile'
    },
    media: {
        video: { type: String },
        photo: { type: String }
    },
    title: { type: String },
    description: { type: String },
    
    // The strict Schema that was causing issues with old data.
    // The new controller logic will fix the data to match this.
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],

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

// Cascade delete related post data when a Post is deleted
post.pre('findOneAndDelete', async function(next) {
  try {
    const docToUpdate = await this.model.findOne(this.getQuery());
    if (docToUpdate) {
      const postId = docToUpdate._id;
      // Using model names as defined in their files
      try { await mongoose.model('PostLike').deleteMany({ post: postId }); } catch(err) {}
      try { await mongoose.model('PostSave').deleteMany({ post: postId }); } catch(err) {}
      try { await mongoose.model('PostView').deleteMany({ post: postId }); } catch(err) {}
      try { await mongoose.model('PostAnalytics').deleteMany({ post: postId }); } catch(err) {}
      
      // Also delete SavePost which strangely references 'post' via 'jobId'
      try { await mongoose.model('SavePost').deleteMany({ jobId: postId }); } catch(err) {}
      
      // Delete child Comments? Comments are embedded in Post, so they go with it.
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("post", post);