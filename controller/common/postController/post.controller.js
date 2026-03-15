const Post = require('../../../models/post.model');
const StartupModel = require('../../../models/startupprofile.model');
const Incubator = require('../../../models/incubator.model');
const User = require('../../../models/user.model');
const async_handler = require("express-async-handler");
const { getUploadedFileUrl } = require("../../../utils/uploadUrl");

/**
 * CREATE POST
 * Only Startups OR Incubators can post
 */
const createPost = async_handler(async (req, res) => {
  try {
    const {
      title,
      description,
    } = req.body;
    
    let posterId = null;
    let posterType = 'StartupProfile';

    // 1. Identify Poster
    if (req.user.role === 'startup') {
        const startup = await StartupModel.findOne({ userId: req.user.id });
        if (!startup) {
            return res.status(404).json({ success: false, error: 'Startup profile not found' });
        }
        posterId = startup._id;
        posterType = 'StartupProfile';
    } else if (req.user.role === 'incubator_admin') {
        // Incubator Admin posts as the Incubator
        // req.user.incubatorId might be present from middleware, or check DB
        let incId = req.user.incubatorId;
        if (!incId) {
            // Fallback lookup
            const u = await User.findById(req.user.id);
            incId = u.incubatorId;
        } 
        
        if (!incId) {
             return res.status(403).json({ success: false, error: "No associated incubator found for this admin." });
        }
        
        posterId = incId;
        posterType = 'Incubator';
    } else {
        return res.status(403).json({ success: false, error: 'Only startups and incubators can post.' });
    }

    // 2. Handle Media Files from Multer
    // If using S3 or Disk, fileuploads middleware attaches req.files
    let videoUrl = "";
    let photoUrl = "";


    const media = {};
    if (req.files) {
      if (req.files['image'] && req.files['image'][0]) {
        media.photo = getUploadedFileUrl(req.files['image'][0]);
      }
      if (req.files['video'] && req.files['video'][0]) {
        media.video = getUploadedFileUrl(req.files['video'][0]);
      }
    }

    const postData = {
      title,
      description,
      media,
      // Dynamic assignment based on type
    };

    if (posterType === 'Incubator') {
        postData.incubatorId = posterId;
        postData.posterModel = 'Incubator';
        // Post schema expects 'startupid' or 'incubatorId'.
        // If 'incubatorId' provided, 'startupid' is optional.
    } else {
        postData.startupid = posterId;
        postData.posterModel = 'StartupProfile';
    }

    const post = new Post(postData);
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
        post.media.photo = getUploadedFileUrl(req.files['image'][0]);
        }
        if (req.files['video'] && req.files['video'][0]) {
        post.media.video = getUploadedFileUrl(req.files['video'][0]);
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
