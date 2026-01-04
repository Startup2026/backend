const Post = require('../../models/post.model');
const User = require('../../models/user.model');
const async_handler = require("express-async-handler");

/**
 * CREATE POST
 * ONLY STARTUPS CAN POST
 */
const createPost = async_handler(async (req, res) => {
  try {
    const { createdBy } = req.body;

    // Check if user exists
    const user = await User.findById(createdBy);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check role
    if (user.role !== "STARTUP") {
      return res.status(403).json({
        success: false,
        error: 'Only startups are allowed to create posts'
      });
    }

    const post = new Post(req.body);
    await post.save();

    return res.status(201).json({
      success: true,
      data: post
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET ALL POSTS
 */
const getPosts = async_handler(async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      data: posts
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET POST BY ID
 */
const getPostById = async_handler(async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('comments.user', 'name');

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    return res.json({
      success: true,
      data: post
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * DELETE POST
 */
const deletePost = async_handler(async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    return res.json({
      success: true,
      data: post
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = {
  createPost,
  getPosts,
  getPostById,
  deletePost
};
