const asyncHandler = require("express-async-handler");
const Post = require("../../../models/post.model");
const mongoose = require("mongoose");

// --- ROBUST ID EXTRACTION HELPER ---
const getUserId = (req) => {
    // 1. Try extracting from Token (if middleware works)
    if (req.user) {
        if (req.user.user && req.user.user._id) return req.user.user._id;
        if (req.user._id) return req.user._id;
    }
    // 2. Fallback: Try extracting from Request Body (Fixed for your Frontend)
    if (req.body) {
        if (req.body.userId) return req.body.userId;
        if (req.body.studentId) return req.body.studentId;
    }
    return null;
};

// Helper to auto-fix corrupted "likes" data
const safeFindPost = async (postId) => {
    try {
        return await Post.findById(postId);
    } catch (error) {
        if (error.message.includes("likes") || error.message.includes("Cast to [ObjectId] failed")) {
            await Post.collection.updateOne(
                { _id: new mongoose.Types.ObjectId(postId) },
                { $set: { likes: [] } }
            );
            return await Post.findById(postId);
        }
        throw error;
    }
};

const likePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = getUserId(req);

  if (!userId) return res.status(401).json({ message: "Unauthorized: User ID missing" });

  const post = await safeFindPost(postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (!Array.isArray(post.likes)) post.likes = [];

  const hasLiked = post.likes.some(id => id.toString() === userId.toString());
  if (!hasLiked) {
      post.likes.push(userId);
      await post.save();
  }

  res.status(200).json({
    message: "Post liked successfully",
    likes: post.likes.length,
    isLiked: true
  });
});

const unlikePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = getUserId(req);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const post = await safeFindPost(postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  if (Array.isArray(post.likes)) {
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
      await post.save();
  }

  res.status(200).json({
    message: "Post unliked successfully",
    likes: post.likes.length,
    isLiked: false
  });
});

const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  const userId = getUserId(req);

  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  if (!text) return res.status(400).json({ message: "Comment text is required" });

  const post = await safeFindPost(postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  post.comments.push({ user: userId, text });
  await post.save();

  // Populate user details immediately so frontend sees name/avatar
  const updatedPost = await Post.findById(postId).populate("comments.user", "name avatar");

  res.status(201).json({
    message: "Comment added successfully",
    comments: updatedPost.comments,
  });
});

const deleteComment = asyncHandler(async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = getUserId(req);
  
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const post = await safeFindPost(postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const comment = post.comments.id(commentId);
  if (!comment) return res.status(404).json({ message: "Comment not found" });

  if (comment.user.toString() !== userId.toString()) {
    return res.status(403).json({ message: "Unauthorized to delete this comment" });
  }

  comment.deleteOne();
  await post.save();

  res.status(200).json({ message: "Comment deleted successfully" });
});

module.exports = { likePost, unlikePost, addComment, deleteComment };