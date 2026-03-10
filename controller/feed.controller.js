const Post = require('../models/post.model');
const PostAnalytics = require('../models/postAnalytics.model');
const PostView = require('../models/postView.model');
const PostLike = require('../models/postLike.model');
const PostSave = require('../models/postSave.model');
const StartupProfile = require('../models/startupprofile.model');
const async_handler = require('express-async-handler');
const mongoose = require('mongoose');

const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor || '').split(',')[0];

    const ip = (forwardedIp || req.ip || req.connection?.remoteAddress || '').toString().trim();
    return ip.replace(/^::ffff:/, '');
};

// Helper to update analytics
const updateAnalytics = async (postId) => {
    // Upsert analytics doc
    let analytics = await PostAnalytics.findOne({ post: postId });
    if (!analytics) {
        analytics = new PostAnalytics({ post: postId });
    }

    // Interactive counts
    const likes = await PostLike.countDocuments({ post: postId });
    const saves = await PostSave.countDocuments({ post: postId });
    // For Comments, we check the Post model's array length
    const postDoc = await Post.findById(postId);
    const comments = postDoc?.comments?.length || 0;

    analytics.likes_count = likes;
    analytics.saves_count = saves;
    analytics.comments_count = comments;
    
    // Recalculate engagement
    analytics.calculateEngagement();
    await analytics.save();
    return analytics;
};

const trackUniquePostViewsByIp = async (posts, req) => {
    const viewerIp = getClientIp(req);
    if (!viewerIp || !Array.isArray(posts) || posts.length === 0) {
        return;
    }

    for (const post of posts) {
        const postId = post?._id;
        if (!postId) continue;

        const existingView = await PostView.findOne({ post: postId, viewerIp });
        if (existingView) continue;

        await PostView.create({ post: postId, viewerIp });

        const analytics = await PostAnalytics.findOneAndUpdate(
            { post: postId },
            { $inc: { views_count: 1, unique_views_count: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        analytics.calculateEngagement();
        await analytics.save();
    }
};


// 1. GET /feed
// - All active posts
// - Ordered strictly by created_at DESC
// - Pagination support
const getFeed = async_handler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('startupid', 'startupName profilepic industry') // Populate basic startup info
        .populate('incubatorId', 'name') // Populate basic incubator info
        .lean();

    // Scroll-based tracking: each post is counted once per viewer IP.
    await trackUniquePostViewsByIp(posts, req);

    const total = await Post.countDocuments();

    // Attach user-specific interaction state (liked/saved by ME?)
    // And attach analytics summary (views/likes primarily for display if needed, though usually feed just shows counts)
    
    // We can fetch analytics for these posts in parallel
    const postIds = posts.map(p => p._id);
    
    // Check if user liked/saved these
    let myLikes = [];
    let mySaves = [];
    if (req.user) {
        myLikes = await PostLike.find({ user: req.user.id, post: { $in: postIds } }).select('post');
        mySaves = await PostSave.find({ user: req.user.id, post: { $in: postIds } }).select('post');
    }
    const likedSet = new Set(myLikes.map(l => l.post.toString()));
    const savedSet = new Set(mySaves.map(s => s.post.toString()));

    const analyticsData = await PostAnalytics.find({ post: { $in: postIds } }).lean();
    const analyticsMap = {};
    analyticsData.forEach(a => { analyticsMap[a.post.toString()] = a; });

    const feed = posts.map(p => {
        const stats = analyticsMap[p._id.toString()] || { 
            views_count: 0, likes_count: 0, comments_count: 0, 
            saves_count: 0, shares_count: 0, engagement_rate: 0 
        };
        
        return {
            ...p,
            analytics: stats,
            isLiked: likedSet.has(p._id.toString()),
            isSaved: savedSet.has(p._id.toString())
        };
    });

    res.json({
        success: true,
        data: feed,
        meta: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});


// 2. GET /my-posts
// - Posts created by current user
// - Include full analytics
// - Sorting: Latest, Most Viewed, Most Engaged
const getMyPosts = async_handler(async (req, res) => {
    // 1. Identify valid profile (Startup OR Incubator)
    let query = {};

    if (req.user.role === 'startup') {
        const startup = await StartupProfile.findOne({ userId: req.user.id });
        if (!startup) {
            return res.status(404).json({ success: false, error: "Startup profile not found" });
        }
        query = { startupid: startup._id };

    } else if (req.user.role === 'incubator_admin') {
        const User = require('../models/user.model');
        // Check session or fetch from DB to be safe
        let incId = req.user.incubatorId;
        if (!incId) {
             const u = await User.findById(req.user.id);
             incId = u.incubatorId;
        }
        if (!incId) {
             return res.status(404).json({ success: false, error: "Incubator profile not found" });
        }
        query = { incubatorId: incId };
        
    } else {
         return res.status(403).json({ success: false, error: "Only startups and incubators have 'My Posts'" });
    }

    const { sort } = req.query; // 'latest', 'views', 'most_engaged'

    // Fetch all posts for this profile
    let posts = await Post.find(query).lean();
    const postIds = posts.map(p => p._id);

    // Fetch analytics objects
    const analyticsDocs = await PostAnalytics.find({ post: { $in: postIds } }).lean();
    const analyticsMap = {};
    analyticsDocs.forEach(a => { analyticsMap[a.post.toString()] = a; });

    // Merge and Sort
    const result = posts.map(p => {
        // Ensure every post has an analytics object structure
        const stats = analyticsMap[p._id.toString()] || { 
            views_count: 0, unique_views_count: 0, 
            likes_count: 0, comments_count: 0, 
            saves_count: 0, shares_count: 0, 
            engagement_rate: 0 
        };
        return { ...p, analytics: stats };
    });

    // Client-side sort because analytics are in separate collection (unless using aggression pipeline lookup which is complex for now)
    // Since "My Posts" count is finite (usually < 1000), in-memory sort is acceptable for MVP.
    // If scaling, needed aggregation $lookup -> $sort.
    
    if (sort === 'most_viewed') {
        result.sort((a, b) => b.analytics.views_count - a.analytics.views_count);
    } else if (sort === 'most_engaged') {
        result.sort((a, b) => b.analytics.engagement_rate - a.analytics.engagement_rate);
    } else {
        // Default: Latest
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    res.json({ success: true, count: result.length, data: result });
});


// 3. Track VIEW
// POST /feed/view/:id
const trackView = async_handler(async (req, res) => {
    const { id } = req.params;
    const viewerIp = getClientIp(req);

    if (!viewerIp) {
        return res.status(400).json({ success: false, error: 'Unable to determine viewer IP.' });
    }

    // Upsert View Record
    // Check if view exists to determine unique view increment by IP.
    const existingView = await PostView.findOne({ post: id, viewerIp });
    
    let analytics;
    if (!existingView) {
        await PostView.create({ post: id, viewerIp });

        analytics = await PostAnalytics.findOneAndUpdate(
            { post: id },
            {
                $inc: {
                    views_count: 1,
                    unique_views_count: 1
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } else {
        // Unique-only mode: do not increment counts for repeat IP views.
        analytics = await PostAnalytics.findOne({ post: id });
        if (!analytics) {
            analytics = await PostAnalytics.create({ post: id });
        }
    }
    
    // Update engagement rate (views may have changed).
    analytics.calculateEngagement();
    await analytics.save();

    res.json({ success: true, analytics });
});


// 4. Toggle LIKE
// POST /feed/like/:id
const toggleLike = async_handler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await PostLike.findOne({ post: id, user: userId });

    if (existing) {
        await PostLike.deleteOne({ _id: existing._id });
    } else {
        await PostLike.create({ post: id, user: userId });
    }

    // Update Counts & Engagement
    const stats = await updateAnalytics(id);
    
    res.json({ success: true, liked: !existing, stats });
});


// 5. Toggle SAVE
// POST /feed/save/:id
const toggleSave = async_handler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await PostSave.findOne({ post: id, user: userId });

    if (existing) {
        await PostSave.deleteOne({ _id: existing._id });
    } else {
        await PostSave.create({ post: id, user: userId });
    }

    // Update Counts
    const stats = await updateAnalytics(id);

    res.json({ success: true, saved: !existing, stats });
});

module.exports = {
    getFeed,
    getMyPosts,
    trackView,
    toggleLike,
    toggleSave
};
