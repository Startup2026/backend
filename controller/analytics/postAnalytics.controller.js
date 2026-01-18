const async_handler = require("express-async-handler");
const mongoose = require("mongoose");
const Post = require("../../models/post.model");

/**
 * Helper: detect media type
 */
const getMediaType = (post) => {
  if (post.media?.video) return "video";
  if (post.media?.photo) return "photo";
  return "text";
};

/**
 * GET /api/analytics/post/:postId
 */
const postAnalytics = async_handler(async (req, res) => {
  const { postId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ success: false, error: "Invalid postId" });
  }

  const post = await Post.findById(postId);
  if (!post) {
    return res.status(404).json({ success: false, error: "Post not found" });
  }

  const likes = post.likes || 0;
  const comments = post.comments?.length || 0;
  const engagementRate = likes + comments; // no views yet
  const mediaType = getMediaType(post);

  res.json({
    success: true,
    data: { likes, comments, engagementRate, mediaType }
  });
});

/**
 * GET /api/analytics/post/:postId/timeline?range=7d
 */
const postTimeline = async_handler(async (req, res) => {
  const { postId } = req.params;
  const range = req.query.range || "7d";
  const days = parseInt(range.replace("d", "")) || 7;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);

  const result = await Post.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(postId) } },
    { $unwind: { path: "$comments", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$comments.createdAt", "$createdAt"] }
            }
          }
        },
        commentsCount: { $sum: { $cond: [{ $ifNull: ["$comments", false] }, 1, 0] } },
        likesCount: { $first: "$likes" }
      }
    },
    { $sort: { "_id.day": 1 } }
  ]);

  const formatted = result.map(r => ({
    date: r._id.day,
    commentsCount: r.commentsCount,
    likesCount: r.likesCount || 0
  }));

  res.json({ success: true, data: formatted });
});

/**
 * GET /api/analytics/startup/:startupid/summary
 */
const startupSummary = async_handler(async (req, res) => {
  const { startupid } = req.params;

  const posts = await Post.find({ startupid });
  const totalPosts = posts.length;

  let totalLikes = 0;
  let totalComments = 0;

  const withEngagement = posts.map(p => {
    const likes = p.likes || 0;
    const comments = p.comments?.length || 0;
    totalLikes += likes;
    totalComments += comments;
    return {
      _id: p._id,
      title: p.title,
      engagement: likes + comments
    };
  });

  const sorted = [...withEngagement].sort((a, b) => b.engagement - a.engagement);

  res.json({
    success: true,
    data: {
      totalPosts,
      totalLikes,
      totalComments,
      bestPost: sorted[0] || null,
      worstPost: sorted[sorted.length - 1] || null
    }
  });
});

/**
 * GET /api/analytics/content-performance?startupid=...
 */
const contentPerformance = async_handler(async (req, res) => {
  const { startupid } = req.query;
  if (!startupid) {
    return res.status(400).json({ success: false, error: "startupid required" });
  }

  const posts = await Post.find({ startupid });

  const map = {
    video: { likes: 0, comments: 0, count: 0 },
    photo: { likes: 0, comments: 0, count: 0 },
    text: { likes: 0, comments: 0, count: 0 }
  };

  posts.forEach(p => {
    const type = getMediaType(p);
    map[type].likes += p.likes || 0;
    map[type].comments += p.comments?.length || 0;
    map[type].count += 1;
  });

  const result = Object.keys(map).map(type => ({
    type,
    avgLikes: map[type].count ? map[type].likes / map[type].count : 0,
    avgComments: map[type].count ? map[type].comments / map[type].count : 0
  }));

  res.json({ success: true, data: result });
});

module.exports = {
  postAnalytics,
  postTimeline,
  startupSummary,
  contentPerformance
};
