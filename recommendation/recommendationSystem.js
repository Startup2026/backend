/**
 * Non-ML Recommendation System for Jobs, Posts, and Startups
 */

const Job = require('../models/job.model');
const Post = require('../models/post.model');
const StudentProfile = require('../models/studentprofile.model');
const Application = require('../models/application.model');
const SavePost = require('../models/savePost.model');
const StartupProfile = require('../models/startupprofile.model'); // Added for Startup Discovery

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

  // ===================== JOB RECOMMENDATIONS =====================
  async getJobRecommendations(studentId, limit = 10) {
    const profile = await StudentProfile.findOne({ userId: studentId });
    // If no profile, return cold start jobs to prevent crash
    if (!profile) return this.getColdStartJobRecommendations(limit);

    const jobs = await Job.find()
      .populate("startupId", "startupName industry location")
      .lean();

    const applications = await Application.find({ studentId })
      .select("jobId")
      .lean();

    const appliedJobIds = applications.map(a => a.jobId?.toString());

    const scoredJobs = jobs.map(job => {
      const extractedTags = this.extractTags(
        `${job.requirements || ""} ${job.role || ""}`
      );

      const skillMatch = this.calculateSkillMatchScore(
        profile.skills || [],
        extractedTags
      );

      const engagement = this.calculateEngagementScore(job);
      const freshness = this.calculateFreshnessScore(job.createdAt);
      const diversityPenalty = appliedJobIds.includes(job._id.toString()) ? -5 : 0;

      const finalScore = this.calculateFinalScore({
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
          skillMatch: skillMatch.score
        }
      };
    });

    scoredJobs.sort((a, b) => b.scores.final - a.scores.final);
    return scoredJobs.slice(0, limit);
  }

  // ===================== TRENDING JOBS (NEW) =====================
  async getTrendingJobs(studentId, limit = 10) {
    // Trending focuses on high engagement (applications/likes) and urgency (deadline)
    const jobs = await Job.find()
      .populate("startupId", "startupName industry location")
      .lean();

    let appliedJobIds = [];
    if (studentId) {
      const applications = await Application.find({ studentId }).select("jobId").lean();
      appliedJobIds = applications.map(a => a.jobId?.toString());
    }

    const trendingJobs = jobs.map(job => {
      const engagement = this.calculateEngagementScore(job); // Based on apps/likes
      const freshness = this.calculateFreshnessScore(job.createdAt);
      
      // Urgency Score: Boost jobs with deadlines approaching in the next 7 days
      let urgency = 0;
      if (job.deadline) {
        const daysToDeadline = (new Date(job.deadline) - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysToDeadline > 0 && daysToDeadline <= 7) urgency = 15;
      }

      const finalScore = this.calculateFinalScore({
        engagement: engagement * 2.5, // Heavy weight on current activity
        freshness,
        urgency
      });

      return {
        _id: job._id,
        role: job.role,
        location: job.location || "",
        jobType: job.jobType,
        stipend: job.stipend === true,
        salary: job.stipend === true ? job.salary : null,
        deadline: job.deadline,
        hasApplied: appliedJobIds.includes(job._id.toString()),
        startup: {
          _id: job.startupId?._id,
          startupName: job.startupId?.startupName || "Startup",
          industry: job.startupId?.industry || "Tech"
        },
        scores: { final: Math.round(finalScore * 100) / 100 }
      };
    });

    trendingJobs.sort((a, b) => b.scores.final - a.scores.final);
    return trendingJobs.slice(0, limit);
  }

  // ===================== POST RECOMMENDATIONS =====================
  async getPostRecommendations(studentId, limit = 10) {

    // 1. Fetch IDs of posts user has saved
    let savedPostIds = new Set();
    if (studentId) {
      const savedDocs = await SavePost.find({ studentId }).select('jobId').lean();
      savedDocs.forEach(doc => {
        if (doc.jobId) savedPostIds.add(doc.jobId.toString());
      });
    }

    // 2. Fetch posts and populate comments
const posts = await Post.find()
    .populate("startupid", "startupName industry profilepic verified")
    .populate({
      path: "comments.user",
      select: "username name avatar" // Explicitly add username here
    })
    .lean();

    const scoredPosts = posts.map(post => {
      const freshness = this.calculateFreshnessScore(post.createdAt);
      const engagement = this.calculateEngagementScore(post);
      const finalScore = this.calculateFinalScore({
        freshness: freshness * 1.5,
        engagement
      });

      const likesCount = Array.isArray(post.likes) ? post.likes.length : (post.likes || 0);

      // Check if current user liked it
      let isLiked = false;
      if (studentId && Array.isArray(post.likes)) {
        isLiked = post.likes.some(id => id.toString() === studentId.toString());
      }

      // Check if user saved it
      const isSaved = savedPostIds.has(post._id.toString());

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
          verified: post.startupid?.verified
        },
        scores: { final: Math.round(finalScore * 100) / 100 }
      };
    });

    scoredPosts.sort((a, b) => b.scores.final - a.scores.final);
    return scoredPosts.slice(0, limit);
  }

  // ===================== STARTUP RECOMMENDATIONS (NEW) =====================
  async getStartupRecommendations(studentId, limit = 10) {
    const profile = await StudentProfile.findOne({ userId: studentId });
    if (!profile) return this.getColdStartStartupRecommendations(limit);

    const startups = await StartupProfile.find().lean();

    const scoredStartups = startups.map(startup => {
      let score = 0;
      const normalizedIndustry = this.normalizeText(startup.industry || "");
      const studentSkills = profile.skills || [];
      const studentInterests = profile.interests || []; // Assuming interests array exists

      // 1. Industry/Skill Match Score (Max 30)
      // Check if startup industry matches any student skill or interest
      const matchesSkill = studentSkills.some(skill => this.normalizeText(skill).includes(normalizedIndustry));
      const matchesInterest = studentInterests.some(interest => this.normalizeText(interest).includes(normalizedIndustry));

      if (matchesInterest) score += 30;
      else if (matchesSkill) score += 20;

      // 2. Verification Bonus (Max 20)
      if (startup.verified) score += 20;

      // 3. Location Match (Max 10)
      if (profile.location && startup.location &&
        this.normalizeText(profile.location) === this.normalizeText(startup.location)) {
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
    return scoredStartups.slice(0, limit);
  }

  // ===================== COLD START =====================

  async getColdStartJobRecommendations(limit = 10) {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .populate("startupId", "startupName industry location")
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

  async getColdStartPostRecommendations(limit = 10) {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("startupid", "startupName industry profilepic verified")
      .populate({
        path: "comments.user",
        select: "name avatar"
      })
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
  async getColdStartStartupRecommendations(limit = 10) {
    const startups = await StartupProfile.find()
      .sort({ verified: -1, createdAt: -1 }) // Prioritize verified, then newest
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
  async getColdStartRecommendations(type, limit = 10) {
    if (type === 'posts') {
      return this.getColdStartPostRecommendations(limit);
    } else if (type === 'startups') {
      return this.getColdStartStartupRecommendations(limit);
    } else if (type === 'trending-jobs') {
      return this.getTrendingJobs(null, limit);
    }
    return this.getColdStartJobRecommendations(limit);
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