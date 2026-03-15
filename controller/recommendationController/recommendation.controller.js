/**
 * Recommendation Controller
 * Handles API endpoints for job, social feed, and trending recommendations
 */

const recommendationSystem = require('../../recommendation/recommendationSystem');
const PostView = require('../../models/postView.model');
const PostAnalytics = require('../../models/postAnalytics.model');

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || '').split(',')[0];

  const ip = (forwardedIp || req.ip || req.connection?.remoteAddress || '').toString().trim();
  return ip.replace(/^::ffff:/, '');
};

const extractPostId = (item) => item?._id || item?.postId || item?.contentId;

const trackUniquePostViewsByIp = async (recommendations, req) => {
  const viewerIp = getClientIp(req);
  if (!viewerIp || !Array.isArray(recommendations) || recommendations.length === 0) {
    return;
  }

  for (const recommendation of recommendations) {
    const postId = extractPostId(recommendation);
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

const prioritizeUnviewedPosts = async (recommendations, req) => {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return recommendations;
  }

  const viewerIp = getClientIp(req);
  if (!viewerIp) {
    return recommendations;
  }

  const postIds = recommendations
    .map((item) => extractPostId(item))
    .filter(Boolean);

  if (postIds.length === 0) {
    return recommendations;
  }

  const viewedDocs = await PostView.find({
    viewerIp,
    post: { $in: postIds }
  }).select('post').lean();

  const viewedSet = new Set(viewedDocs.map((doc) => doc.post.toString()));
  const unseen = [];
  const seen = [];

  for (const item of recommendations) {
    const postId = extractPostId(item);
    if (!postId) {
      unseen.push(item);
      continue;
    }

    if (viewedSet.has(postId.toString())) {
      seen.push(item);
    } else {
      unseen.push(item);
    }
  }

  return [...unseen, ...seen];
};

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {array} array - Array to shuffle
 * @returns {array} - Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

class RecommendationController {
  /**
   * Get job recommendations for a student
   * GET /recommendations/jobs/:studentId?limit=10&random=true
   */
  async getJobRecommendations(req, res) {
    try {
      const { studentId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
      const randomize = req.query.random === 'true' || req.query.random === '1';

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      let recommendations = await recommendationSystem.getJobRecommendations(
        studentId,
        page,
        limit
      );

      // Apply randomization if requested
      if (randomize && recommendations.length > 0) {
        recommendations = shuffleArray(recommendations);
      }

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        randomized: randomize,
        message: `Found ${recommendations.length} job recommendations`
      });
    } catch (error) {
      console.error('Job recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching job recommendations',
        error: error.message
      });
    }
  }

  /**
   * Get Trending Jobs
   * GET /recommendations/trending-jobs/:studentId?limit=10
   */
  async getTrendingJobs(req, res) {
    try {
      const { studentId } = req.params; // legacy path param, optional
      const userIdFromQuery = req.query.userId;
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;

      const resolvedUserId = userIdFromQuery || studentId;

      const recommendations = await recommendationSystem.getTrendingJobs(
        resolvedUserId === 'guest' ? null : resolvedUserId,
        page,
        limit
      );

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        message: `Found ${recommendations.length} trending jobs`
      });
    } catch (error) {
      console.error('Trending jobs error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching trending jobs',
        error: error.message
      });
    }
  }

  /**
   * Get social feed recommendations for a student
   * GET /recommendations/posts/:studentId?limit=10&random=true
   */
  async getPostRecommendations(req, res) {
    try {
      const { studentId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
      const randomize = req.query.random === 'true' || req.query.random === '1';

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      let recommendations = await recommendationSystem.getPostRecommendations(
        studentId,
        1,
        Math.max(limit * 10, 100)
      );

      // Keep unseen posts at the top for this viewer.
      recommendations = await prioritizeUnviewedPosts(recommendations, req);

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      recommendations = recommendations.slice(startIndex, endIndex);

      // Scroll-based feed view tracking: record one unique view per post per viewer IP.
      await trackUniquePostViewsByIp(recommendations, req);

      // Apply randomization if requested
      if (randomize && recommendations.length > 0) {
        recommendations = shuffleArray(recommendations);
      }

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        randomized: randomize,
        message: `Found ${recommendations.length} post recommendations`
      });
    } catch (error) {
      console.error('Post recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching post recommendations',
        error: error.message
      });
    }
  }

  /**
   * Get personalized feed (jobs + posts combined)
   * GET /recommendations/feed/:studentId?limit=5&jobLimit=3&random=true
   */
  async getPersonalizedFeed(req, res) {
    try {
      const { studentId } = req.params;
      const totalLimit = parseInt(req.query.limit) || 10;
      const jobLimit = parseInt(req.query.jobLimit) || Math.ceil(totalLimit / 2);
      const postLimit = totalLimit - jobLimit;
      const randomize = req.query.random === 'true' || req.query.random === '1';

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const [jobRecommendations, postRecommendations] = await Promise.all([
        recommendationSystem.getJobRecommendations(studentId, jobLimit),
        recommendationSystem.getPostRecommendations(studentId, postLimit)
      ]);

      await trackUniquePostViewsByIp(postRecommendations, req);

      // Apply randomization if requested
      let jobs = randomize ? shuffleArray(jobRecommendations) : jobRecommendations;
      let posts = randomize ? shuffleArray(postRecommendations) : postRecommendations;

      // Combine and interleave recommendations
      const feed = [];
      const maxLength = Math.max(jobs.length, posts.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i < jobs.length) {
          feed.push({
            type: 'job',
            ...jobs[i]
          });
        }
        if (i < posts.length) {
          feed.push({
            type: 'post',
            ...posts[i]
          });
        }
      }

      // Sort by score (unless randomized) and limit
      if (!randomize) {
        feed.sort((a, b) => b.scores.final - a.scores.final);
      }
      feed.splice(totalLimit);

      res.status(200).json({
        success: true,
        data: feed,
        count: feed.length,
        randomized: randomize,
        statistics: {
          jobs: jobs.length,
          posts: posts.length
        },
        message: `Found ${feed.length} personalized feed items`
      });
    } catch (error) {
      console.error('Personalized feed error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching personalized feed',
        error: error.message
      });
    }
  }

  /**
   * Cold start recommendations for new users - JOBS
   * GET /recommendations/cold-start/jobs?limit=10&page=1
   */
  async getColdStartJobRecommendations(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      const recommendations = await recommendationSystem.getColdStartJobRecommendations(page, limit);

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        type: 'jobs',
        coldStartMethod: 'random',
        message: `Found ${recommendations.length} random job recommendations for new users`
      });
    } catch (error) {
      console.error('Cold start job recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching cold start job recommendations',
        error: error.message
      });
    }
  }

  /**
   * Cold start recommendations for new users - POSTS
   * GET /recommendations/cold-start/posts?limit=10&page=1
   */
  async getColdStartPostRecommendations(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      const recommendations = await recommendationSystem.getColdStartPostRecommendations(1, Math.max(limit * 10, 100));

      const prioritizedRecommendations = await prioritizeUnviewedPosts(recommendations, req);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const pagedRecommendations = prioritizedRecommendations.slice(startIndex, endIndex);

      // Scroll-based feed view tracking: record one unique view per post per viewer IP.
      await trackUniquePostViewsByIp(pagedRecommendations, req);

      res.status(200).json({
        success: true,
        data: pagedRecommendations,
        count: pagedRecommendations.length,
        type: 'posts',
        coldStartMethod: 'random',
        message: `Found ${pagedRecommendations.length} random post recommendations for new users`
      });
    } catch (error) {
      console.error('Cold start post recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching cold start post recommendations',
        error: error.message
      });
    }
  }

  /**
   * Cold start recommendations for new users (combined)
   * GET /recommendations/cold-start?type=jobs&limit=10
   * Type: 'jobs', 'posts', or 'trending-jobs'
   */
  async getColdStartRecommendations(req, res) {
    try {
      const contentType = req.query.type || 'jobs';
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;

      const validTypes = ['jobs', 'posts', 'startups', 'trending-jobs'];
      if (!validTypes.includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: `Type must be one of: ${validTypes.join(', ')}`
        });
      }

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      const recommendations = await recommendationSystem.getColdStartRecommendations(
        contentType,
        page,
        limit
      );

      if (contentType === 'posts') {
        const prioritizedRecommendations = await prioritizeUnviewedPosts(recommendations, req);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const pagedRecommendations = prioritizedRecommendations.slice(startIndex, endIndex);
        await trackUniquePostViewsByIp(pagedRecommendations, req);

        return res.status(200).json({
          success: true,
          data: pagedRecommendations,
          count: pagedRecommendations.length,
          type: contentType,
          coldStartMethod: 'algorithm',
          message: `Found ${pagedRecommendations.length} ${contentType} recommendations`
        });
      }

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        type: contentType,
        coldStartMethod: 'algorithm',
        message: `Found ${recommendations.length} ${contentType} recommendations`
      });
    } catch (error) {
      console.error('Cold start recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching cold start recommendations',
        error: error.message
      });
    }
  }

  /**
   * Get detailed score explanation for a specific job or post
   * GET /recommendations/explain/:userId/:contentId?type=job
   */
  async getScoreExplanation(req, res) {
    try {
      const { userId, contentId } = req.params;
      const contentType = req.query.type || 'job';

      if (!userId || !contentId) {
        return res.status(400).json({
          success: false,
          message: 'User ID and Content ID are required'
        });
      }

      if (!['job', 'post'].includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be either "job" or "post"'
        });
      }

      const explanation = await recommendationSystem.getScoreExplanation(
        userId,
        contentId,
        contentType
      );

      res.status(200).json({
        success: true,
        data: explanation,
        message: 'Score explanation generated'
      });
    } catch (error) {
      console.error('Score explanation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating score explanation',
        error: error.message
      });
    }
  }

  /**
   * Get recommendation statistics and insights
   * GET /recommendations/insights/:studentId
   */
  async getInsights(req, res) {
    try {
      const { studentId } = req.params;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const [jobs, posts] = await Promise.all([
        recommendationSystem.getJobRecommendations(studentId, 100),
        recommendationSystem.getPostRecommendations(studentId, 100)
      ]);

      // Calculate insights
      const jobInsights = {
        totalRecommendations: jobs.length,
        averageScore: jobs.length > 0 
          ? (jobs.reduce((sum, j) => sum + j.scores.final, 0) / jobs.length).toFixed(2)
          : 0,
        topScore: jobs.length > 0 ? jobs[0].scores.final : 0,
        skillMatchAverage: jobs.length > 0
          ? (jobs.reduce((sum, j) => sum + j.scores.skillMatch, 0) / jobs.length).toFixed(2)
          : 0,
        topStartups: [...new Set(jobs.map(j => j.startup?.startupName))].slice(0, 5)
      };

      const postInsights = {
        totalRecommendations: posts.length,
        averageScore: posts.length > 0
          ? (posts.reduce((sum, p) => sum + p.scores.final, 0) / posts.length).toFixed(2)
          : 0,
        topScore: posts.length > 0 ? posts[0].scores.final : 0,
        interestMatchAverage: posts.length > 0
          ? (posts.reduce((sum, p) => sum + p.scores.final, 0) / posts.length).toFixed(2) // Fallback as interestMatch not direct field
          : 0,
        topStartups: [...new Set(posts.map(p => p.startupid?.startupName))].slice(0, 5)
      };

      res.status(200).json({
        success: true,
        data: {
          jobs: jobInsights,
          posts: postInsights,
          recommendations: {
            topJobRecommendation: jobs[0] || null,
            topPostRecommendation: posts[0] || null
          }
        },
        message: 'Insights generated successfully'
      });
    } catch (error) {
      console.error('Insights error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating insights',
        error: error.message
      });
    }
  }

  /**
   * Cold start for startup discovery feed
   */
  async getColdStartStartUpRecommendations(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
      }

      const recommendations = await recommendationSystem.getColdStartStartupRecommendations(page, limit);

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        type: 'startups',
        coldStartMethod: 'random',
        message: `Found ${recommendations.length} startup recommendations for new users`
      });
    } catch (error) {
      console.error('Cold start startups recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching cold start startups recommendations',
        error: error.message
      });
    }
  }

  /**
   * Startup recommendation controller
   */
  async getStartupRecommendations(req, res) {
    try {
      const { studentId } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const page = parseInt(req.query.page) || 1;
      const randomize = req.query.random === 'true' || req.query.random === '1';

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      let recommendations = await recommendationSystem.getStartupRecommendations(
        studentId,
        page,
        limit
      );

      // Apply randomization if requested
      if (randomize && recommendations.length > 0) {
        recommendations = shuffleArray(recommendations);
      }

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        randomized: randomize,
        message: `Found ${recommendations.length} Startup recommendations`
      });
    } catch (error) {
      console.error('Startup recommendations error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching Startup recommendations',
        error: error.message
      });
    }
  }
}

module.exports = new RecommendationController();