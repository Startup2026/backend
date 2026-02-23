const Post = require('../../../models/post.model');
const StartupModel = require('../../../models/startupprofile.model');
const async_handler = require("express-async-handler");

/**
 * CREATE POST
 * ONLY STARTUPS CAN POST
 */
const createPost = async_handler(async (req, res) => {
  try {
    const {
      title,
      description,
    } = req.body;

    // Use req.user.id to find the startup profile
    if (!req.user || req.user.role !== 'startup') {
      return res.status(403).json({
        success: false,
        error: 'Only startups are allowed to create posts'
      });
    }

    const startup = await StartupModel.findOne({ userId: req.user.id });
    if (!startup) {
      return res.status(404).json({
        success: false,
        error: 'Startup profile not found for this user'
      });
    }

    const media = {};
    if (req.files) {
      if (req.files['image'] && req.files['image'][0]) {
        media.photo = `/media/${req.files['image'][0].filename}`;
      }
      if (req.files['video'] && req.files['video'][0]) {
        media.video = `/media/${req.files['video'][0].filename}`;
      }
    }

    const post = new Post({
      startupid: startup._id,
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
      .populate({
        path: 'startupid',
        select: 'startupName email role profilepic userId'
      })
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
 * GET STARTUP POSTS (FOR ANALYSIS)
 */
const getStartupPosts = async_handler(async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'startup') {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    const startup = await StartupModel.findOne({ userId: req.user.id });
    if (!startup) {
      return res.status(404).json({ success: false, error: 'Startup profile not found' });
    }

    const posts = await Post.find({ startupid: startup._id })
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
// post.controller.js
const getPostById = async_handler(async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('startupid', 'startupName email role profilepic verified')
      // Ensure 'username' is included in the select string
      .populate('comments.user', 'username name avatar'); 

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    return res.json({ success: true, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
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
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    // Whitelist allowed fields
    const allowed = [
      'title',
      'description',
      'media',
      'likes'
    ];

    // Update allowed fields
    Object.keys(req.body || {}).forEach((k) => {
      if (allowed.includes(k)) post[k] = req.body[k];
    });

    // Handle File Uploads (Merge with existing)
    if (req.files) {
        if (!post.media) post.media = {};
        
        if (req.files['image'] && req.files['image'][0]) {
            post.media.photo = `/media/${req.files['image'][0].filename}`;
        }
        if (req.files['video'] && req.files['video'][0]) {
            post.media.video = `/media/${req.files['video'][0].filename}`;
        }
    }
    
    await post.save();

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
  getStartupPosts,
  getPostById,
  updatePost,
  deletePost
};
