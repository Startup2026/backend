/**
 * Non-ML Recommendation System for Jobs, Posts, and Startups
 */

const Job = require('../models/job.model');
const Post = require('../models/post.model');
const StudentProfile = require('../models/studentprofile.model');
const Application = require('../models/application.model');
const SavePost = require('../models/savePost.model');
const StartupProfile = require('../models/startupprofile.model'); // Added for Startup Discovery
const User = require('../models/user.model');
const Incubator = require('../models/incubator.model');

class RecommendationSystem {

  normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  }

  extractTags(text) {
    if (!text) return [];
    return this.normalizeText(text).split(/\s+/);
  }

  calculateSkillMatchScore(userSkills = [], jobTags = []) {
    if (!jobTags.length) return { score: 0, matchedTags: [], totalTags: 0 };

    const matchedTags = jobTags.filter(tag =>
      userSkills.some(skill =>
        this.normalizeText(skill).includes(tag)
      )
    );

    const score = (matchedTags.length / jobTags.length) * 40;

    return {
      score: Math.round(score * 100) / 100,
      matchedTags,
      totalTags: jobTags.length
    };
  }

  calculateEngagementScore(item) {
    let score = 0;
    // Cap likes score at 10
    const likesCount = Array.isArray(item.likes) ? item.likes.length : (item.likes || 0);
    score += Math.min(10, likesCount / 10);

    // Check if it's a job (uses applications) or post (uses comments)
    if (item.applications !== undefined) {
      score += Math.min(10, (item.applications || 0) / 5);
    } else if (item.comments !== undefined) {
      score += Math.min(10, (item.comments.length || 0) / 5);
    }

    return score;
  }

  calculateFreshnessScore(createdAt) {
    const daysOld = (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    if (daysOld <= 3) return 20;
    if (daysOld <= 7) return 12;
    if (daysOld <= 14) return 6;
    return 0;
  }

  calculateFinalScore(parts) {
    return Object.values(parts).reduce((a, b) => a + b, 0);
  }

  normalizeLocationTokens(location) {
    if (!location) return [];
    if (typeof location === 'string') {
      return this.extractTags(location);
    }
    if (typeof location === 'object') {
      return this.extractTags(`${location.city || ''} ${location.country || ''}`);
    }
    return [];
  }

  uniqueTokens(tokens = []) {
    return Array.from(new Set(tokens.filter(Boolean).map((token) => this.normalizeText(token)).filter(Boolean)));
  }

  calculateNicheMatchScore(nicheTokens = [], contentTokens = [], maxScore = 30) {
    if (!nicheTokens.length || !contentTokens.length) return { score: 0, matchedTokens: [] };

    const nicheSet = new Set(this.uniqueTokens(nicheTokens));
    const contentSet = this.uniqueTokens(contentTokens);
    const matchedTokens = contentSet.filter((token) => nicheSet.has(token));

    const ratio = matchedTokens.length / Math.max(contentSet.length, 1);
    const score = Math.min(maxScore, Math.round(ratio * maxScore * 100) / 100);

    return { score, matchedTokens };
  }

  async getUserNicheContext(userId) {
    if (!userId) {
      return {
        role: 'guest',
        nicheTokens: [],
        locationTokens: [],
        studentProfileId: null,
        studentSkills: []
      };
    }

    const [user, studentProfile, startupProfile] = await Promise.all([
      User.findById(userId).select('role incubatorId').lean(),
      StudentProfile.findOne({ userId }).lean(),
      StartupProfile.findOne({ userId }).lean(),
    ]);

    if (studentProfile) {
      const skills = Array.isArray(studentProfile.skills) ? studentProfile.skills : [];
      const interests = Array.isArray(studentProfile.interests) ? studentProfile.interests : [];

      return {
        role: 'student',
        nicheTokens: this.uniqueTokens([...skills, ...interests]),
        locationTokens: this.normalizeLocationTokens(studentProfile.location),
        studentProfileId: studentProfile._id?.toString() || null,
        studentSkills: skills,
      };
    }

    if (startupProfile) {
      const startupText = [
        startupProfile.industry,
        startupProfile.tagline,
        startupProfile.aboutus,
        startupProfile.productOrService,
        startupProfile.primary_business_model,
      ].join(' ');

      return {
        role: 'startup',
        nicheTokens: this.uniqueTokens(this.extractTags(startupText)),
        locationTokens: this.normalizeLocationTokens(startupProfile.location),
        studentProfileId: null,
        studentSkills: [],
      };
    }

    if (user?.incubatorId || user?.role === 'incubator_admin') {
      const [incubator, incubatorStartups] = await Promise.all([
        user?.incubatorId ? Incubator.findById(user.incubatorId).lean() : Promise.resolve(null),
        user?.incubatorId ? StartupProfile.find({ incubatorId: user.incubatorId }).select('industry tagline').lean() : Promise.resolve([]),
      ]);

      const incubatorIndustryTokens = incubatorStartups.flatMap((startup) => this.extractTags(`${startup.industry || ''} ${startup.tagline || ''}`));
      const incubatorNameTokens = incubator ? this.extractTags(`${incubator.name || ''}`) : [];

      return {
        role: 'incubator_admin',
        nicheTokens: this.uniqueTokens([...incubatorIndustryTokens, ...incubatorNameTokens]),
        locationTokens: [],
        studentProfileId: null,
        studentSkills: [],
      };
    }

    return {
      role: user?.role || 'guest',
      nicheTokens: [],
      locationTokens: [],
      studentProfileId: null,
      studentSkills: [],
    };
  }

  // ===================== JOB RECOMMENDATIONS =====================
  async getJobRecommendations(studentId, page = 1, limit = 10) {
    // Handling case where limit was passed as second arg in older calls
    if (typeof page === 'number' && typeof limit === 'undefined' && page > 10) {
        // This is likely the old signature (limit)
        limit = page;
        page = 1;
    }

    const userContext = await this.getUserNicheContext(studentId);
    if (!userContext.nicheTokens.length && userContext.role === 'guest') {
      return this.getColdStartJobRecommendations(page, limit);
    }

    const jobs = await Job.find()
      .populate("startupId", "startupName industry location")
      .lean();

    let appliedJobIds = [];
    if (userContext.studentProfileId) {
      const applications = await Application.find({ studentId: userContext.studentProfileId })
        .select("jobId")
        .lean();
      appliedJobIds = applications.map(a => a.jobId?.toString());
    }

    const scoredJobs = jobs.map(job => {
      const extractedTags = this.extractTags(
        `${job.requirements || ""} ${job.role || ""} ${job.jobType || ""} ${job.startupId?.industry || ""} ${job.location || ""}`
      );

      const skillMatch = this.calculateSkillMatchScore(
        userContext.studentSkills || [],
        extractedTags
      );
      const nicheMatch = this.calculateNicheMatchScore(userContext.nicheTokens, extractedTags, 35);

      const engagement = this.calculateEngagementScore(job);
      const freshness = this.calculateFreshnessScore(job.createdAt);
      const diversityPenalty = appliedJobIds.includes(job._id.toString()) ? -5 : 0;

      const finalScore = this.calculateFinalScore({
        nicheMatch: nicheMatch.score,
        skillMatch: skillMatch.score,
        engagement,
        freshness,
        diversityPenalty
      });

      return {
        _id: job._id,
        role: job.role,
        aboutRole: job.aboutRole || "",
        requirements: job.requirements || "",
        location: job.location || "",
        openings: job.openings || 0,
        jobType: job.jobType,
        tags: Array.isArray(job.tags) ? job.tags : [],
        stipend: job.stipend === true,
        salary: job.stipend === true ? job.salary : null,
        deadline: job.deadline,
        createdAt: job.createdAt,
        startup: {
          _id: job.startupId?._id,
          startupName: job.startupId?.startupName || "Startup",
          industry: job.startupId?.industry || "Tech",
          location: job.startupId?.location || ""
        },
        scores: {
          final: Math.round(finalScore * 100) / 100,
          skillMatch: skillMatch.score,
          nicheMatch: nicheMatch.score
        }
      };
    });

    scoredJobs.sort((a, b) => {
      const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (b.scores.final !== a.scores.final) return b.scores.final - a.scores.final;
      return b._id.toString().localeCompare(a._id.toString());
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return scoredJobs.slice(startIndex, endIndex);
  }

  // ===================== TRENDING JOBS (NEW) =====================
  async getTrendingJobs(studentId, page = 1, limit = 10) {
    // Handling signature mismatch
    if (typeof page === 'number' && typeof limit === 'undefined' && page > 10) {
        limit = page;
        page = 1;
    }

    // Trending focuses on high engagement (applications/likes) and urgency (deadline)
    const jobs = await Job.find()
      .populate("startupId", "startupName industry location")
      .lean();

    const userContext = await this.getUserNicheContext(studentId);

    let appliedJobIds = [];
    if (userContext.studentProfileId) {
      const applications = await Application.find({ studentId: userContext.studentProfileId }).select("jobId").lean();
      appliedJobIds = applications.map(a => a.jobId?.toString());
    }

    const trendingJobs = jobs.map(job => {
      const engagement = this.calculateEngagementScore(job); // Based on apps/likes
      const freshness = this.calculateFreshnessScore(job.createdAt);
      const jobTags = this.extractTags(`${job.role || ''} ${job.requirements || ''} ${job.jobType || ''} ${job.location || ''} ${job.startupId?.industry || ''}`);
      const nicheMatch = this.calculateNicheMatchScore(userContext.nicheTokens, jobTags, 20);
      
      // Urgency Score: Boost jobs with deadlines approaching in the next 7 days
      let urgency = 0;
      if (job.deadline) {
        const daysToDeadline = (new Date(job.deadline) - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysToDeadline > 0 && daysToDeadline <= 7) urgency = 15;
      }

      const finalScore = this.calculateFinalScore({
        engagement: engagement * 2.5, // Heavy weight on current activity
        freshness,
        urgency,
        nicheMatch: nicheMatch.score
      });

      return {
        _id: job._id,
        role: job.role,
        location: job.location || "",
        jobType: job.jobType,
        stipend: job.stipend === true,
        salary: job.stipend === true ? job.salary : null,
        deadline: job.deadline,
        createdAt: job.createdAt,
        hasApplied: appliedJobIds.includes(job._id.toString()),
        startup: {
          _id: job.startupId?._id,
          startupName: job.startupId?.startupName || "Startup",
          industry: job.startupId?.industry || "Tech"
        },
        scores: { final: Math.round(finalScore * 100) / 100 }
      };
    });

    trendingJobs.sort((a, b) => {
      const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (b.scores.final !== a.scores.final) return b.scores.final - a.scores.final;
      return b._id.toString().localeCompare(a._id.toString());
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return trendingJobs.slice(startIndex, endIndex);
  }

  // ===================== POST RECOMMENDATIONS =====================
  async getPostRecommendations(studentId, page = 1, limit = 10) {
    // Handle old signature
    if (typeof page === 'number' && typeof limit === 'undefined' && page > 10) {
        limit = page;
        page = 1;
    }

    const userContext = await this.getUserNicheContext(studentId);

    // 1. Fetch IDs of posts user has saved
    let savedPostIds = new Set();
    if (userContext.role === 'student' && studentId) {
      const savedDocs = await SavePost.find({ studentId }).select('jobId').lean();
      savedDocs.forEach(doc => {
        if (doc.jobId) savedPostIds.add(doc.jobId.toString());
      });
    }


    // 2. Fetch posts and populate comments
    const posts = await Post.find()
      .populate("startupid", "startupName industry profilepic verified userId")
      .populate({
        path: "comments.user",
        select: "username name avatar" // Explicitly add username here
      })
      .lean();

    const scoredPosts = posts.map(post => {
      const freshness = this.calculateFreshnessScore(post.createdAt);
      const engagement = this.calculateEngagementScore(post);
      const postTags = this.extractTags(`${post.title || ''} ${post.description || ''} ${post.startupid?.industry || ''}`);
      const nicheMatch = this.calculateNicheMatchScore(userContext.nicheTokens, postTags, 30);
      const finalScore = this.calculateFinalScore({
        freshness: freshness * 1.5,
        engagement,
        nicheMatch: nicheMatch.score
      });

      const likesCount = Array.isArray(post.likes) ? post.likes.length : (post.likes || 0);

      // Check if current user liked it
      let isLiked = false;
      if (studentId && Array.isArray(post.likes)) {
        isLiked = post.likes.some(id => id.toString() === studentId.toString());
      }
      
      const isSaved = userContext.role === 'student' ? savedPostIds.has(post._id.toString()) : false;

      return {
        _id: post._id,
        title: post.title,
        description: post.description,
        media: post.media,
        likes: likesCount,
        isLiked: isLiked,
        isSaved: isSaved,
        comments: post.comments || [],
        createdAt: post.createdAt,
        type: "post",
        startupid: {
          _id: post.startupid?._id,
          startupName: post.startupid?.startupName || "Startup",
          profilepic: post.startupid?.profilepic,
          verified: post.startupid?.verified,
          userId: post.startupid?.userId
        },
        scores: { final: Math.round(finalScore * 100) / 100 }
      };
    });

    scoredPosts.sort((a, b) => {
      const dateDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (dateDiff !== 0) return dateDiff;
      if (b.scores.final !== a.scores.final) return b.scores.final - a.scores.final;
      return b._id.toString().localeCompare(a._id.toString());
    });
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return scoredPosts.slice(startIndex, endIndex);
  }

  // ===================== STARTUP RECOMMENDATIONS (NEW) =====================
  async getStartupRecommendations(studentId, page = 1, limit = 10) {
    // Handle old signature
    if (typeof page === 'number' && typeof limit === 'undefined' && page > 10) {
        limit = page;
        page = 1;
    }

    const userContext = await this.getUserNicheContext(studentId);
    if (!userContext.nicheTokens.length && userContext.role === 'guest') {
      return this.getColdStartStartupRecommendations(page, limit);
    }

    const startups = await StartupProfile.find().lean();

    const scoredStartups = startups.map(startup => {
      const startupTags = this.extractTags(`${startup.industry || ''} ${startup.tagline || ''} ${startup.aboutus || ''}`);
      const nicheMatch = this.calculateNicheMatchScore(userContext.nicheTokens, startupTags, 30);
      let score = nicheMatch.score;

      // 2. Verification Bonus (Max 20)
      if (startup.verified) score += 20;

      // 3. Location Match (Max 10)
      const startupLocationTokens = this.normalizeLocationTokens(startup.location);
      const locationMatch = userContext.locationTokens.some((token) => startupLocationTokens.includes(token));
      if (locationMatch) {
        score += 10;
      }

      // 4. Profile Completeness / Freshness (Max 10)
      // Simple heuristic: newer startups might need visibility
      score += this.calculateFreshnessScore(startup.createdAt || new Date());

      return {
        _id: startup._id,
        startupName: startup.startupName,
        tagline: startup.tagline,
        industry: startup.industry,
        location: startup.location,
        profilepic: startup.profilepic,
        coverimg: startup.coverimg, // If applicable
        verified: startup.verified,
        about: startup.aboutus || "",
        website: startup.website,
        createdAt: startup.createdAt,
        teamSize: startup.teamSize,
        type: "startup",
        scores: { final: score }
      };
    });

    scoredStartups.sort((a, b) => b.scores.final - a.scores.final);
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return scoredStartups.slice(startIndex, endIndex);
  }

  // ===================== COLD START =====================

  async getColdStartJobRecommendations(page = 1, limit = 10) {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .populate("startupId", "startupName industry location")
      .skip((page - 1) * limit) // Native skip
      .limit(limit)
      .lean();

    return jobs.map(job => ({
      _id: job._id,
      role: job.role,
      aboutRole: job.aboutRole || "",
      // Remove job.location as it keeps being undefined
      jobType: job.jobType,
      tags: Array.isArray(job.tags) ? job.tags : [],
      stipend: job.stipend === true,
      salary: job.stipend === true ? job.salary : null,
      startup: {
        startupName: job.startupId?.startupName || "Startup",
        industry: job.startupId?.industry || "Tech",
        location: job.startupId?.location || ""
      },
      coldStart: true,
      scores: { final: 0 }
    }));
  }

  async getColdStartPostRecommendations(page=1, limit = 10) {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("startupid", "startupName industry profilepic verified")
      .populate({
        path: "comments.user",
        select: "name avatar"
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return posts.map(post => ({
      _id: post._id,
      title: post.title,
      description: post.description,
      media: post.media,
      likes: Array.isArray(post.likes) ? post.likes.length : (post.likes || 0),
      isLiked: false,
      isSaved: false,
      comments: post.comments || [],
      createdAt: post.createdAt,
      type: "post",
      startupid: {
        startupName: post.startupid?.startupName || "Startup",
        profilepic: post.startupid?.profilepic,
        verified: post.startupid?.verified
      },
      coldStart: true,
      scores: { final: 0 }
    }));
  }

  // New: Cold Start for Startups
  async getColdStartStartupRecommendations(page=1, limit = 10) {
    const startups = await StartupProfile.find()
      .sort({ verified: -1, createdAt: -1 }) // Prioritize verified, then newest
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return startups.map(startup => ({
      _id: startup._id,
      startupName: startup.startupName,
      tagline: startup.tagline,
      industry: startup.industry,
      location: startup.location,
      profilepic: startup.profilepic,
      verified: startup.verified,
      about: startup.aboutus || "",
      type: "startup",
      coldStart: true,
      teamSize: startup.teamSize,
      scores: { final: 0 }
    }));
  }

  // Wrapper for "Get Cold Start"
  async getColdStartRecommendations(type, page = 1, limit = 10) {
    // Handle old signature
    if (typeof page === 'number' && typeof limit === 'undefined' && page > 10) {
        limit = page;
        page = 1;
    }

    if (type === 'posts') {
      return this.getColdStartPostRecommendations(page, limit);
    } else if (type === 'startups') {
      return this.getColdStartStartupRecommendations(page, limit);
    } else if (type === 'trending-jobs') {
      return this.getTrendingJobs(null, page, limit);
    }
    return this.getColdStartJobRecommendations(page, limit);
  }

  async getScoreExplanation(userId, contentId, type) {
    return {
      message: "Explanation feature requires detailed tracking implemented in future versions.",
      userId,
      contentId,
      type
    };
  }
}

module.exports = new RecommendationSystem();