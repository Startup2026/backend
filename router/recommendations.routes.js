/**
 * Recommendation Routes
 * Endpoints for job and social feed recommendations
 */

const express = require('express');
const router = express.Router();
const recommendationController = require('../controller/recommendationController/recommendation.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// ============= Job Recommendations =============
/**
 * GET /recommendations/jobs/:studentId?limit=10&random=true
 * Get personalized job recommendations for a student
 */
router.get('/jobs/:studentId', token__middleware, recommendationController.getJobRecommendations);

// ============= Post Recommendations =============
/**
 * GET /recommendations/posts/:studentId?limit=10&random=true
 * Get personalized social feed recommendations for a student
 */
router.get('/posts/:studentId', token__middleware, recommendationController.getPostRecommendations);

// ============= Combined Feed =============
/**
 * GET /recommendations/feed/:studentId?limit=10&jobLimit=5&random=true
 * Get personalized feed with both jobs and posts
 */
router.get('/feed/:studentId', recommendationController.getPersonalizedFeed);

// ============= Cold Start (No Auth Required) =============
/**
 * GET /recommendations/cold-start?type=jobs&limit=10
 * Get random recommendations for new users (no personalization)
 * Type: 'jobs' or 'posts'
 */
router.get('/cold-start', recommendationController.getColdStartRecommendations);

/**
 * GET /recommendations/cold-start/jobs?limit=10
 * Get random job recommendations for new users
 */
router.get('/cold-start/jobs', recommendationController.getColdStartJobRecommendations);


// get request for cold start startups
router.get('/cold-start/startups', recommendationController.getColdStartStartUpRecommendations);

// get startups recommendations
router.get('/startups/:studentId', token__middleware, recommendationController.getStartupRecommendations);

/**
 * GET /recommendations/cold-start/posts?limit=10
 * Get random post recommendations for new users
 */
router.get('/cold-start/posts', recommendationController.getColdStartPostRecommendations);

// ============= Score Explanation =============
/**
 * GET /recommendations/explain/:userId/:contentId?type=job
 * Get detailed explanation of how a score was calculated
 * Useful for debugging and transparency
 */
router.get('/explain/:userId/:contentId', token__middleware, recommendationController.getScoreExplanation);

// ============= Insights & Analytics =============
/**
 * GET /recommendations/insights/:studentId
 * Get analytics and insights about recommendations
 */
router.get('/insights/:studentId', token__middleware, recommendationController.getInsights);

// Trending Job routes
router.get('/trending/jobs',token__middleware,recommendationController.getTrendingJobs);

module.exports = router;
