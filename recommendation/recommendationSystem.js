/**
 * Non-ML Recommendation System for Jobs & Social Feed
 * Algorithm: Explainable scoring system based on:
 * - Skill & Interest Matching (40 points)
 * - Engagement Scoring (20 points)
 * - Freshness Scoring (20 points)
 * - Contextual Boost (10 points)
 * - Diversity Penalty (-10 points)
 */

const Job = require('../models/job.model');
const Post = require('../models/post.model');
const StudentProfile = require('../models/studentprofile.model');
const SaveJob = require('../models/saveJob.model');
const SavePost = require('../models/savePost.model');
const Application = require('../models/application.model');
const StartupProfile = require('../models/startupprofile.model');

class RecommendationSystem {
  // ============= STEP 1: TEXT NORMALIZATION =============
  /**
   * Normalize text by lowercasing, removing punctuation, and mapping synonyms
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalizeText(text) {
    if (!text) return '';
    
    // Lowercase and trim
    let normalized = text.toLowerCase().trim();
    
    // Remove punctuation
    normalized = normalized.replace(/[^\w\s]/g, '');
    
    // Map synonyms
    const synonyms = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'cplusplus',
      'cc': 'cplusplus',
      'react': 'reactjs',
      'angular': 'angularjs',
      'vue': 'vuejs',
      'node': 'nodejs',
      'express': 'expressjs',
      'mongo': 'mongodb',
      'sql': 'database',
      'nosql': 'database',
      'ml': 'machinelearning',
      'ai': 'artificialintelligence',
      'dl': 'deeplearning',
      'cv': 'computervision',
      'nlp': 'naturallanguageprocessing'
    };
    
    const words = normalized.split(' ');
    const normalizedWords = words.map(word => synonyms[word] || word);
    
    return normalizedWords.join(' ');
  }

  /**
   * Extract and normalize tags/skills from text
   * @param {string} text - Text containing tags
   * @returns {array} - Array of normalized tags
   */
  extractTags(text) {
    if (!text) return [];
    
    const normalized = this.normalizeText(text);
    // Split by spaces and filter empty strings
    return normalized.split(/\s+/).filter(tag => tag.length > 0);
  }

  // ============= STEP 2: SKILL & INTEREST MATCHING (40 POINTS) =============
  /**
   * Calculate skill/interest match score
   * Score = (Matched Tags / Total Post Tags) × 40
   * @param {array} userSkills - User's skills
   * @param {array} postTags - Post's tags/requirements
   * @returns {object} - {score, matchedTags, totalTags}
   */
  calculateSkillMatchScore(userSkills = [], postTags = []) {
    if (postTags.length === 0) {
      return { score: 0, matchedTags: [], totalTags: 0 };
    }

    const normalizedUserSkills = userSkills.map(skill => 
      this.normalizeText(skill)
    );
    const normalizedPostTags = postTags.map(tag => 
      this.normalizeText(tag)
    );

    // Find matching tags
    const matchedTags = normalizedPostTags.filter(tag =>
      normalizedUserSkills.some(skill =>
        skill.includes(tag) || tag.includes(skill)
      )
    );

    const matchPercentage = matchedTags.length / normalizedPostTags.length;
    const score = matchPercentage * 40;

    return {
      score: Math.round(score * 100) / 100,
      matchedTags,
      totalTags: normalizedPostTags.length
    };
  }

  // ============= STEP 3: ENGAGEMENT SCORING (20 POINTS) =============
  /**
   * Calculate engagement score with capped metrics
   * Views (5 pts), Likes (10 pts), Applies/Saves (5 pts)
   * @param {object} post - Post/Job object with engagement metrics
   * @returns {number} - Engagement score
   */
  calculateEngagementScore(post) {
    let score = 0;

    // Views (capped at 5 points) - assuming views scale logarithmically
    const views = post.views || 0;
    const viewScore = Math.min(5, (Math.log(views + 1) / Math.log(100)) * 5);
    score += viewScore;

    // Likes (capped at 10 points)
    const likes = post.likes || 0;
    const likeScore = Math.min(10, (Math.log(likes + 1) / Math.log(50)) * 10);
    score += likeScore;

    // Applications/Saves (capped at 5 points)
    const applies = post.applications || 0;
    const saves = post.saves || 0;
    const applyScore = Math.min(5, ((applies + saves) / 20) * 5);
    score += applyScore;

    return Math.round(score * 100) / 100;
  }

  // ============= STEP 4: FRESHNESS SCORING (20 POINTS) =============
  /**
   * Calculate freshness score based on post date
   * 0–3 days: 20 pts
   * 4–7 days: 12 pts
   * 8–14 days: 6 pts
   * 15+ days: 0 pts
   * @param {Date} postDate - Date the post was created
   * @returns {number} - Freshness score
   */
  calculateFreshnessScore(postDate) {
    if (!postDate) return 0;

    const now = new Date();
    const ageInDays = (now - new Date(postDate)) / (1000 * 60 * 60 * 24);

    if (ageInDays <= 3) return 20;
    if (ageInDays <= 7) return 12;
    if (ageInDays <= 14) return 6;
    return 0;
  }

  // ============= STEP 5: CONTEXTUAL BOOST (10 POINTS) =============
  /**
   * Calculate contextual boost
   * Location match: +5 pts
   * Academic year relevance: +5 pts
   * @param {object} userProfile - Student profile
   * @param {object} post - Post/Job object
   * @returns {number} - Contextual boost score
   */
  calculateContextualBoost(userProfile, post) {
    let boost = 0;

    // Location match
    if (userProfile.location && post.location) {
      const userLocation = this.normalizeText(userProfile.location);
      const postLocation = this.normalizeText(post.location);
      
      if (userLocation === postLocation || 
          userLocation.includes(postLocation) || 
          postLocation.includes(userLocation)) {
        boost += 5;
      }
    }

    // Academic year relevance (for jobs)
    if (post.targetedAcademicYear && userProfile.education && userProfile.education.length > 0) {
      // Extract current academic year from education
      const currentYear = new Date().getFullYear();
      const educationEndYear = userProfile.education[0].endYear;
      
      if (educationEndYear && parseInt(educationEndYear) === currentYear) {
        boost += 5;
      }
    }

    return boost;
  }

  // ============= STEP 6: DIVERSITY PENALTY (-10 POINTS) =============
  /**
   * Apply penalty if the same company appears repeatedly
   * @param {string} postStartupId - ID of the startup posting
   * @param {array} recentPosts - Recent posts in user's feed
   * @returns {number} - Diversity penalty (negative value)
   */
  calculateDiversityPenalty(postStartupId, recentPosts = []) {
    if (!recentPosts || recentPosts.length === 0) return 0;

    // Count how many recent posts are from the same startup
    const sameStartupCount = recentPosts.filter(
      post => post.startupId?.toString() === postStartupId?.toString()
    ).length;

    // Apply penalty: -10 for each additional post from same startup (max -10)
    if (sameStartupCount > 0) {
      return Math.min(-10, sameStartupCount * -2);
    }

    return 0;
  }

  // ============= FINAL SCORE CALCULATION =============
  /**
   * Calculate final recommendation score
   * Final Score = Skill Match + Engagement + Freshness + Context Boost - Diversity Penalty
   * @param {object} scoringComponents - Object with all score components
   * @returns {number} - Final score
   */
  calculateFinalScore(scoringComponents) {
    const {
      skillMatch = 0,
      engagement = 0,
      freshness = 0,
      contextualBoost = 0,
      diversityPenalty = 0
    } = scoringComponents;

    return Math.round(
      (skillMatch + engagement + freshness + contextualBoost + diversityPenalty) * 100
    ) / 100;
  }

  // ============= MAIN RECOMMENDATION METHODS =============
  /**
   * Get job recommendations for a student
   * @param {string} studentId - Student ID
   * @param {number} limit - Number of recommendations (default: 10)
   * @returns {array} - Recommended jobs with scores
   */
  async getJobRecommendations(studentId, limit = 10) {
    try {
      // Fetch student profile
      const studentProfile = await StudentProfile.findOne({ userId: studentId });
      if (!studentProfile) {
        throw new Error('Student profile not found');
      }

      // Fetch all jobs
      let jobs = await Job.find()
        .populate('startupId', 'startupName industry location')
        .lean();

      // Fetch student's recent interactions (for diversity penalty)
      const applications = await Application.find({ studentId })
        .select('jobId')
        .lean();
      
      const recentApplications = applications.map(app => ({
        startupId: app.jobId
      }));

      // Score each job
      const scoredJobs = jobs.map(job => {
        // Extract tags from job requirements
        const jobTags = this.extractTags(job.requirements || '');
        
        // Step 2: Skill & Interest Matching
        const skillMatch = this.calculateSkillMatchScore(
          studentProfile.skills || [],
          [...jobTags, job.role]
        );

        // Step 3: Engagement Scoring
        const engagement = this.calculateEngagementScore(job);

        // Step 4: Freshness Scoring
        const freshness = this.calculateFreshnessScore(job.createdAt);

        // Step 5: Contextual Boost
        const contextualBoost = this.calculateContextualBoost(
          studentProfile,
          job
        );

        // Step 6: Diversity Penalty
        const diversityPenalty = this.calculateDiversityPenalty(
          job.startupId?._id,
          recentApplications
        );

        // Calculate final score
        const finalScore = this.calculateFinalScore({
          skillMatch: skillMatch.score,
          engagement,
          freshness,
          contextualBoost,
          diversityPenalty
        });

        return {
          jobId: job._id,
          role: job.role,
          startupName: job.startupId?.startupName,
          startupId: job.startupId?._id,
          salary: job.salary,
          stipend: job.stipend,
          deadline: job.deadline,
          createdAt: job.createdAt,
          scores: {
            skillMatch: skillMatch.score,
            engagement: Math.round(engagement * 100) / 100,
            freshness,
            contextualBoost,
            diversityPenalty,
            final: finalScore
          },
          scoreBreakdown: {
            matchedSkills: skillMatch.matchedTags,
            totalSkillsRequired: skillMatch.totalTags
          }
        };
      });

      // Sort by final score (descending)
      scoredJobs.sort((a, b) => b.scores.final - a.scores.final);

      // Return top N recommendations
      return scoredJobs.slice(0, limit);
    } catch (error) {
      console.error('Error getting job recommendations:', error);
      throw error;
    }
  }

  /**
   * Get social feed recommendations for a student
   * @param {string} studentId - Student ID
   * @param {number} limit - Number of recommendations (default: 10)
   * @returns {array} - Recommended posts with scores
   */
  async getPostRecommendations(studentId, limit = 10) {
    try {
      // Fetch student profile
      const studentProfile = await StudentProfile.findOne({ userId: studentId });
      if (!studentProfile) {
        throw new Error('Student profile not found');
      }

      // Fetch all posts
      let posts = await Post.find()
        .populate('startupid', 'startupName industry location')
        .lean();

      // Fetch student's recent interactions (for diversity penalty)
      const savedPosts = await SavePost.find({ studentId })
        .select('jobId')
        .lean();
      
      const recentPosts = savedPosts.map(post => ({
        startupId: post.jobId
      }));

      // Score each post
      const scoredPosts = posts.map(post => {
        // Extract tags from post description
        const postTags = this.extractTags(post.description || post.title || '');
        
        // Step 2: Skill & Interest Matching
        const skillMatch = this.calculateSkillMatchScore(
          studentProfile.interests || [],
          postTags
        );

        // Step 3: Engagement Scoring
        const engagement = this.calculateEngagementScore(post);

        // Step 4: Freshness Scoring
        const freshness = this.calculateFreshnessScore(post.createdAt);

        // Step 5: Contextual Boost
        const contextualBoost = this.calculateContextualBoost(
          studentProfile,
          post
        );

        // Step 6: Diversity Penalty
        const diversityPenalty = this.calculateDiversityPenalty(
          post.startupid?._id,
          recentPosts
        );

        // Calculate final score
        const finalScore = this.calculateFinalScore({
          skillMatch: skillMatch.score,
          engagement,
          freshness,
          contextualBoost,
          diversityPenalty
        });

        return {
          postId: post._id,
          title: post.title,
          startupName: post.startupid?.startupName,
          startupId: post.startupid?._id,
          createdAt: post.createdAt,
          likes: post.likes,
          commentsCount: post.comments?.length || 0,
          scores: {
            skillMatch: skillMatch.score,
            engagement: Math.round(engagement * 100) / 100,
            freshness,
            contextualBoost,
            diversityPenalty,
            final: finalScore
          },
          scoreBreakdown: {
            matchedInterests: skillMatch.matchedTags,
            totalTagsInPost: skillMatch.totalTags
          }
        };
      });

      // Sort by final score (descending)
      scoredPosts.sort((a, b) => b.scores.final - a.scores.final);

      // Return top N recommendations
      return scoredPosts.slice(0, limit);
    } catch (error) {
      console.error('Error getting post recommendations:', error);
      throw error;
    }
  }

  /**
   * Cold start handling for new users
   * Show fresh + popular posts
   * @param {number} limit - Number of recommendations (default: 10)
   * @returns {array} - Fresh and popular jobs/posts
   */
  async getColdStartRecommendations(contentType = 'jobs', limit = 10) {
    try {
      let content;

      if (contentType === 'jobs') {
        content = await Job.find()
          .populate('startupId', 'startupName industry')
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();

        return content.map(job => ({
          jobId: job._id,
          role: job.role,
          startupName: job.startupId?.startupName,
          salary: job.salary,
          freshnessBased: true,
          reason: 'New and trending job posting'
        }));
      } else {
        content = await Post.find()
          .populate('startupid', 'startupName')
          .sort({ likes: -1, createdAt: -1 })
          .limit(limit)
          .lean();

        return content.map(post => ({
          postId: post._id,
          title: post.title,
          startupName: post.startupid?.startupName,
          likes: post.likes,
          popularityBased: true,
          reason: 'Popular and trending post'
        }));
      }
    } catch (error) {
      console.error('Error getting cold start recommendations:', error);
      throw error;
    }
  }

  /**
   * Get detailed scoring explanation for debugging
   * @param {string} userId - Student/User ID
   * @param {string} contentId - Job or Post ID
   * @param {string} contentType - 'job' or 'post'
   * @returns {object} - Detailed scoring breakdown
   */
  async getScoreExplanation(userId, contentId, contentType = 'job') {
    try {
      const studentProfile = await StudentProfile.findOne({ userId });
      if (!studentProfile) {
        throw new Error('Student profile not found');
      }

      let content;
      if (contentType === 'job') {
        content = await Job.findById(contentId).populate('startupId').lean();
      } else {
        content = await Post.findById(contentId).populate('startupid').lean();
      }

      if (!content) {
        throw new Error(`${contentType} not found`);
      }

      // Calculate all components
      const jobTags = this.extractTags(content.requirements || content.description || '');
      const skillMatch = this.calculateSkillMatchScore(
        contentType === 'job' ? studentProfile.skills : studentProfile.interests,
        jobTags
      );
      const engagement = this.calculateEngagementScore(content);
      const freshness = this.calculateFreshnessScore(content.createdAt);
      const contextualBoost = this.calculateContextualBoost(studentProfile, content);

      return {
        userId,
        contentId,
        contentType,
        studentProfile: {
          skills: studentProfile.skills,
          interests: studentProfile.interests,
          location: studentProfile.location
        },
        content: {
          title: content.role || content.title,
          startup: content.startupId?.startupName || content.startupid?.startupName,
          createdAt: content.createdAt
        },
        scoreBreakdown: {
          skillMatch: {
            score: skillMatch.score,
            maxPoints: 40,
            explanation: `${skillMatch.matchedTags.length} out of ${skillMatch.totalTags} required skills matched`,
            matchedTags: skillMatch.matchedTags
          },
          engagement: {
            score: Math.round(engagement * 100) / 100,
            maxPoints: 20,
            explanation: `Views: ${Math.round((Math.log(content.views + 1) / Math.log(100)) * 5)}, Likes: ${Math.round((Math.log(content.likes + 1) / Math.log(50)) * 10)}, Applies/Saves: ${Math.round(((content.applications + content.saves) / 20) * 5)}`
          },
          freshness: {
            score: freshness,
            maxPoints: 20,
            explanation: this.getFreshnessExplanation(content.createdAt)
          },
          contextualBoost: {
            score: contextualBoost,
            maxPoints: 10,
            explanation: contextualBoost > 0 ? 'Location or academic year matched' : 'No contextual match'
          }
        },
        finalScore: skillMatch.score + engagement + freshness + contextualBoost
      };
    } catch (error) {
      console.error('Error getting score explanation:', error);
      throw error;
    }
  }

  /**
   * Helper method to explain freshness scoring
   */
  getFreshnessExplanation(postDate) {
    const ageInDays = (new Date() - new Date(postDate)) / (1000 * 60 * 60 * 24);
    
    if (ageInDays <= 3) return `Posted ${Math.floor(ageInDays)} days ago - Very Fresh (20 pts)`;
    if (ageInDays <= 7) return `Posted ${Math.floor(ageInDays)} days ago - Recent (12 pts)`;
    if (ageInDays <= 14) return `Posted ${Math.floor(ageInDays)} days ago - Somewhat old (6 pts)`;
    return `Posted ${Math.floor(ageInDays)} days ago - Old (0 pts)`;
  }
}

module.exports = new RecommendationSystem();
