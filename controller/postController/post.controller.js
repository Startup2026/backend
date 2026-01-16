const Post = require('../../models/post.model');
const StartupModel = require('../../models/startupprofile.model');
const async_handler = require("express-async-handler");

/**
 * CREATE POST
 * ONLY STARTUPS CAN POST
 */
const createPost = async_handler(async (req, res) => {
  try {
    const {
      startupid,
      title,
      description,
      media
    } = req.body;

    if (!startupid) {
      return res.status(400).json({
        success: false,
        error: 'startupid is required'
      });
    }

    // Check if user exists
    const user = await StartupModel.findById(startupid);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'startup not found'
      });
    }

    // // Check role
    // if (user.role !== "STARTUP") {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'Only startups are allowed to create posts'
    //   });
    // }

    const post = new Post({
      startupid,
      title,
      description,
      media
    });
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
      .populate('startupid', 'name email role')
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
      .populate('startupid', 'name email role')
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

/**
 * UPDATE POST
 */
const updatePost = async_handler(async (req, res) => {
  try {
    // Whitelist allowed fields
    const allowed = [
      'title',
      'description',
      'media',
      'likes'
    ];

    const updates = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (allowed.includes(k)) updates[k] = req.body[k];
    });

    const post = await Post.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

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
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost
};
