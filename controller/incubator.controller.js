const StartupProfile = require('../models/startupprofile.model');
const Incubator = require('../models/incubator.model');
const User = require('../models/user.model'); // Added User model
const RevenueTransaction = require('../models/revenueTransaction.model');
const Job = require('../models/job.model');
const PostView = require('../models/postView.model');
const PostAnalytics = require('../models/postAnalytics.model');
const async_handler = require("express-async-handler");
const mongoose = require("mongoose");

const resolveIncubatorId = async (req) => {
    let incubatorId = req.user.incubatorId;
    if (!incubatorId) {
        const user = await User.findById(req.user.id || req.user._id);
        incubatorId = user?.incubatorId;
    }
    return incubatorId;
};

const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor || '').split(',')[0];

    const ip = (forwardedIp || req.ip || req.connection?.remoteAddress || '').toString().trim();
    return ip.replace(/^::ffff:/, '');
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

const getIncubatorDashboardStats = async_handler(async (req, res) => {
    let incubatorId = await resolveIncubatorId(req);

    if (!incubatorId) {
        return res.status(403).json({ success: false, error: 'Access denied: No associated incubator found.' });
    }

    // DEBUG: Log the incubator ID being used for stats
    console.log(`>>> [Incubator Stats] Fetching stats for incubatorId: ${incubatorId}`);
    const totalStartups = await StartupProfile.countDocuments({ incubatorId });
    const verifiedStartups = await StartupProfile.countDocuments({ incubatorId, incubator_verified: true });
    const claimedStartups = await StartupProfile.countDocuments({ incubatorId, incubator_claimed: true, incubator_verified: false });
    console.log(await StartupProfile.countDocuments({ incubatorId }));
    
    
    // Find startups active hiring
    const startups = await StartupProfile.find({ incubatorId }).select('_id');
    const startupIds = startups.map(s => s._id);

    const activeJobs = await Job.distinct('startupId', {
        startupId: { $in: startupIds },
        status: 'open'
    });
    
    // Calculate revenues
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const revenueResult = await RevenueTransaction.aggregate([
        { $match: { incubatorId: new mongoose.Types.ObjectId(incubatorId) } },
        { 
            $group: {
                _id: null,
                totalRevenueGenerated: { $sum: '$net_amount' },
                totalIncubatorShare: { $sum: '$incubator_share' }
            }
        }
    ]);

    const revenueThisMonthResult = await RevenueTransaction.aggregate([
        { $match: { 
            incubatorId: new mongoose.Types.ObjectId(incubatorId),
            createdAt: { $gte: currentMonth }
        } },
        { 
            $group: {
                _id: null,
                monthRevenue: { $sum: '$incubator_share' }
            }
        }
    ]);

    const stats = {
        totalStartups,
        verifiedStartups,
        claimedStartups,
        activeHiringStartups: activeJobs.length,
        totalRevenueGenerated: Number(revenueResult[0]?.totalRevenueGenerated || 0).toFixed(2),
        totalIncubatorShare: Number(revenueResult[0]?.totalIncubatorShare || 0).toFixed(2),
        revenueThisMonth: Number(revenueThisMonthResult[0]?.monthRevenue || 0).toFixed(2)
    };

    console.log(`>>> [Incubator Stats] Returning stats for ID: ${incubatorId}`, stats);

    res.json({ success: true, data: stats });
});

const getIncubatorStartups = async_handler(async (req, res) => {
    let incubatorId = await resolveIncubatorId(req);

    if (!incubatorId) {
        return res.json({ success: true, data: [] });
    }

    const startups = await StartupProfile.find({ incubatorId })
        .select('startupName industry stage eligibility_status incubator_verified hiring verificationDetails subscriptionPlan approval_status updates');

    res.json({ success: true, data: startups });
});

const getIncubatorRevenue = async_handler(async (req, res) => {
    let incubatorId = await resolveIncubatorId(req);

    const transactions = await RevenueTransaction.find({ incubatorId })
        .populate('startupId', 'startupName')
        .sort({ createdAt: -1 });

    const totalTransactionCount = transactions.length;

    res.json({ 
        success: true, 
        data: {
            totalCount: totalTransactionCount,
            transactions
        } 
    });
});

const verifyStartupIncubator = async_handler(async (req, res) => {
    const { startupId } = req.params;
    let incubatorId = await resolveIncubatorId(req);

    const startup = await StartupProfile.findOne({ _id: startupId, incubatorId });

    if (!startup) {
        return res.status(404).json({ success: false, error: 'Startup not found or not affiliated with your incubator.' });
    }

    startup.incubator_verified = true;
    startup.incubator_verified_at = new Date();
    startup.incubator_claimed = true;
    await startup.save();

    // If the startup made subscription payments before incubator approval,
    // allocate the pending incentive to this incubator now.
    const pendingRevenueTxs = await RevenueTransaction.find({
        startupId: startup._id,
        transaction_type: 'Subscription',
        incubatorId: null,
        incubator_share: 0
    });

    for (const tx of pendingRevenueTxs) {
        const recalculatedShare = Number(tx.net_amount || 0) * 0.10;
        tx.incubatorId = incubatorId;
        tx.incubator_share = recalculatedShare;
        tx.platform_share = Number(tx.net_amount || 0) - recalculatedShare;
        await tx.save();
    }

    console.log(`[INCUBATOR VERIFICATION] Incubator Admin verified startup ${startupId}`);

    res.json({ success: true, data: startup, creditedTransactions: pendingRevenueTxs.length });
});

const rejectStartupIncubator = async_handler(async (req, res) => {
    const { startupId } = req.params;
    let incubatorId = await resolveIncubatorId(req);

    const startup = await StartupProfile.findOne({ _id: startupId, incubatorId });

    if (!startup) {
        return res.status(404).json({ success: false, error: 'Startup not found or not affiliated with your incubator.' });
    }

    const previousIncubatorId = startup.incubatorId;

    // Remove historical incentive credits generated from this startup for this incubator.
    // The transaction remains for audit, but incubator share is reversed and detached.
    const revenueTxs = await RevenueTransaction.find({
        startupId: startup._id,
        incubatorId: previousIncubatorId,
        incubator_share: { $gt: 0 }
    });

    for (const tx of revenueTxs) {
        tx.platform_share = tx.net_amount;
        tx.incubator_share = 0;
        tx.incubatorId = null;
        await tx.save();
    }

    // Keep startup on the platform, but remove incubator affiliation when rejected.
    startup.incubator_verified = false;
    startup.incubator_verified_at = null;
    startup.incubator_claimed = false;
    startup.incubatorId = null;
    startup.incubator = undefined;
    await startup.save();

    console.log(`[INCUBATOR REJECTION] Incubator Admin rejected affiliation for startup ${startupId}`);

    res.json({
        success: true,
        message: 'Startup rejected from incubator affiliation, incubator incentive removed, and startup removed from your incubator list.',
        reversedTransactions: revenueTxs.length,
        data: startup
    });
});

const getIncubatorFeed = async_handler(async (req, res) => {
    let incubatorId = await resolveIncubatorId(req);

    if (!incubatorId) {
        return res.json({ success: true, data: [] });
    }

    // Find all startups for this incubator
    const startups = await StartupProfile.find({ incubatorId }).select('_id startupName profilepic');
    const startupIds = startups.map(s => s._id);

    // Find all posts from these startups
    const Post = require('../models/post.model'); // Ensure imported
    const posts = await Post.find({ startupid: { $in: startupIds } })
        .populate('startupid', 'startupName profilepic')
        .sort({ createdAt: -1 })
        .limit(20);

    // Count each incubator feed impression as a unique post view by viewer IP.
    await trackUniquePostViewsByIp(posts, req);

    const postIds = posts.map((post) => post._id);
    const analyticsDocs = postIds.length
        ? await PostAnalytics.find({ post: { $in: postIds } }).lean()
        : [];
    const analyticsMap = {};
    analyticsDocs.forEach((doc) => {
        analyticsMap[doc.post.toString()] = doc;
    });

    // Map posts to update format for frontend consistency
    const updates = posts.map((post) => {
        const stats = analyticsMap[post._id.toString()] || {
            views_count: 0,
            unique_views_count: 0,
            likes_count: 0,
            comments_count: 0,
            saves_count: 0,
            shares_count: 0,
            engagement_rate: 0
        };

        return {
        _id: post._id,
        startupId: post.startupid?._id,
        startupName: post.startupid?.startupName || 'Unknown Startup',
        title: post.title || 'New Post',
        content: post.description || '',
        date: post.createdAt,
        type: 'post',
        analytics: stats
        };
    });

    // Find profile updates (milestones) as well
    const profileUpdates = [];
    const startupsWithUpdates = await StartupProfile.find({ 
        incubatorId, 
        'updates.0': { $exists: true } 
    }).select('startupName updates');
    
    startupsWithUpdates.forEach(s => {
        if (s.updates && s.updates.length > 0) {
            s.updates.forEach(u => {
                profileUpdates.push({
                    _id: u._id || new mongoose.Types.ObjectId(), // Ensure ID
                    startupId: s._id,
                    startupName: s.startupName,
                    title: u.title,
                    content: u.content,
                    date: u.date,
                    type: 'milestone'
                });
            });
        }
    });

    // Combine and sort
    const allUpdates = [...updates, ...profileUpdates]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 20);

    res.json({ success: true, data: allUpdates });
});

const getIncubatorPayoutDetails = async_handler(async (req, res) => {
    const incubatorId = await resolveIncubatorId(req);

    if (!incubatorId) {
        return res.status(403).json({ success: false, error: 'Access denied: No associated incubator found.' });
    }

    const incubator = await Incubator.findById(incubatorId).select('payoutDetails');
    if (!incubator) {
        return res.status(404).json({ success: false, error: 'Incubator not found.' });
    }

    res.json({ success: true, data: incubator.payoutDetails || null });
});

const saveIncubatorPayoutDetails = async_handler(async (req, res) => {
    const incubatorId = await resolveIncubatorId(req);

    if (!incubatorId) {
        return res.status(403).json({ success: false, error: 'Access denied: No associated incubator found.' });
    }

    const {
        method,
        upiId,
        bankAccountHolderName,
        bankAccountNumber,
        bankName,
        ifscCode,
        branchName
    } = req.body;

    if (!['upi', 'bank'].includes(method)) {
        return res.status(400).json({ success: false, error: 'Payout method must be either upi or bank.' });
    }

    if (method === 'upi' && !String(upiId || '').trim()) {
        return res.status(400).json({ success: false, error: 'UPI ID is required for UPI payout method.' });
    }

    if (method === 'bank') {
        if (!String(bankAccountHolderName || '').trim()) {
            return res.status(400).json({ success: false, error: 'Account holder name is required for bank payout method.' });
        }
        if (!String(bankAccountNumber || '').trim()) {
            return res.status(400).json({ success: false, error: 'Account number is required for bank payout method.' });
        }
        if (!String(bankName || '').trim()) {
            return res.status(400).json({ success: false, error: 'Bank name is required for bank payout method.' });
        }
        if (!String(ifscCode || '').trim()) {
            return res.status(400).json({ success: false, error: 'IFSC code is required for bank payout method.' });
        }
    }

    const incubator = await Incubator.findById(incubatorId);
    if (!incubator) {
        return res.status(404).json({ success: false, error: 'Incubator not found.' });
    }

    incubator.payoutDetails = {
        method,
        upiId: method === 'upi' ? String(upiId || '').trim() : '',
        bankAccountHolderName: method === 'bank' ? String(bankAccountHolderName || '').trim() : '',
        bankAccountNumber: method === 'bank' ? String(bankAccountNumber || '').trim() : '',
        bankName: method === 'bank' ? String(bankName || '').trim() : '',
        ifscCode: method === 'bank' ? String(ifscCode || '').trim().toUpperCase() : '',
        branchName: method === 'bank' ? String(branchName || '').trim() : '',
        updatedAt: new Date()
    };

    await incubator.save();
    res.json({ success: true, data: incubator.payoutDetails });
});

module.exports = {
    getIncubatorDashboardStats,
    getIncubatorStartups,
    getIncubatorRevenue,
    verifyStartupIncubator,
    rejectStartupIncubator,
    getIncubatorFeed,
    getIncubatorPayoutDetails,
    saveIncubatorPayoutDetails
};
