/**
 * Recommendation Controller
 * Handles API endpoints for job and social feed recommendations
 */

const recommendationSystem = require('../recommendation/recommendationSystem');

class RecommendationController {
  /**
   * Get job recommendations for a student
   * GET /recommendations/jobs/:studentId?limit=10
   */
  async getJobRecommendations(req, res) {
    try {
      const { studentId } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const recommendations = await recommendationSystem.getJobRecommendations(
        studentId,
        limit
      );

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
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
   * Get social feed recommendations for a student
   * GET /recommendations/posts/:studentId?limit=10
   */
  async getPostRecommendations(req, res) {
    try {
      const { studentId } = req.params;
      const limit = parseInt(req.query.limit) || 10;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required'
        });
      }

      const recommendations = await recommendationSystem.getPostRecommendations(
        studentId,
        limit
      );

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
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
   * GET /recommendations/feed/:studentId?limit=5&jobLimit=3
   */
  async getPersonalizedFeed(req, res) {
    try {
      const { studentId } = req.params;
      const totalLimit = parseInt(req.query.limit) || 10;
      const jobLimit = parseInt(req.query.jobLimit) || Math.ceil(totalLimit / 2);
      const postLimit = totalLimit - jobLimit;

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

      // Combine and interleave recommendations
      const feed = [];
      const maxLength = Math.max(jobRecommendations.length, postRecommendations.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i < jobRecommendations.length) {
          feed.push({
            type: 'job',
            ...jobRecommendations[i]
          });
        }
        if (i < postRecommendations.length) {
          feed.push({
            type: 'post',
            ...postRecommendations[i]
          });
        }
      }

      // Sort by score and limit
      feed.sort((a, b) => b.scores.final - a.scores.final);
      feed.splice(totalLimit);

      res.status(200).json({
        success: true,
        data: feed,
        count: feed.length,
        statistics: {
          jobs: jobRecommendations.length,
          posts: postRecommendations.length
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
   * Cold start recommendations for new users
   * GET /recommendations/cold-start?type=jobs&limit=10
   */
  async getColdStartRecommendations(req, res) {
    try {
      const contentType = req.query.type || 'jobs';
      const limit = parseInt(req.query.limit) || 10;

      if (!['jobs', 'posts'].includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Type must be either "jobs" or "posts"'
        });
      }

      const recommendations = await recommendationSystem.getColdStartRecommendations(
        contentType,
        limit
      );

      res.status(200).json({
        success: true,
        data: recommendations,
        count: recommendations.length,
        type: contentType,
        message: `Found ${recommendations.length} trending ${contentType} for new users`
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
        topStartups: [...new Set(jobs.map(j => j.startupName))].slice(0, 5)
      };

      const postInsights = {
        totalRecommendations: posts.length,
        averageScore: posts.length > 0
          ? (posts.reduce((sum, p) => sum + p.scores.final, 0) / posts.length).toFixed(2)
          : 0,
        topScore: posts.length > 0 ? posts[0].scores.final : 0,
        interestMatchAverage: posts.length > 0
          ? (posts.reduce((sum, p) => sum + p.scores.skillMatch, 0) / posts.length).toFixed(2)
          : 0,
        topStartups: [...new Set(posts.map(p => p.startupName))].slice(0, 5)
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
}

module.exports = new RecommendationController();
