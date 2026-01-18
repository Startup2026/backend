/**
 * INTEGRATION GUIDE - Recommendation System
 * 
 * This guide shows how to integrate the recommendation system into your Express app
 */

// ============= STEP 1: Import the routes in your main index.js =============

/*
// In your backend/index.js file, add:

const recommendationRoutes = require('./router/recommendations.routes');

// Add this line after your other route definitions (e.g., after app.use('/api/users', userRoutes))
app.use('/api/recommendations', recommendationRoutes);

// Example structure:
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/recommendations', recommendationRoutes); // Add this line
*/

// ============= STEP 2: Ensure your models have required fields =============

/*
// Job Model needs:
- role (string)
- requirements (string) - can be comma-separated or space-separated
- salary (number) - optional
- stipend (boolean) - optional
- views (number) - optional, for engagement scoring
- applications (number) - optional
- createdAt (timestamp) - automatically set by MongoDB
- startupId (reference to StartupProfile)

// Post Model needs:
- title (string)
- description (string) - used for tag extraction
- likes (number) - default 0
- comments (array) - optional, counted for engagement
- createdAt (timestamp) - automatically set
- startupid (reference to StartupProfile)

// StudentProfile Model needs:
- skills (array of strings) - e.g., ['JavaScript', 'React', 'Node.js']
- interests (array of strings) - e.g., ['Web Development', 'Startups']
- location (string) - e.g., 'San Francisco'
- education (array with endYear) - for academic year matching
- userId (reference to User)

// Application Model needs:
- jobId (reference to Job)
- studentId (reference to StudentProfile)
- createdAt (timestamp)

// SaveJob/SavePost Models need:
- jobId/postId (reference)
- studentId (reference to StudentProfile)
- createdAt (timestamp)
*/

// ============= STEP 3: Test the endpoints =============

/*
// Using curl or Postman:

// 1. Get job recommendations for a student
GET /api/recommendations/jobs/USER_ID?limit=10
Authorization: Bearer YOUR_JWT_TOKEN

// 2. Get post recommendations
GET /api/recommendations/posts/USER_ID?limit=10
Authorization: Bearer YOUR_JWT_TOKEN

// 3. Get combined feed
GET /api/recommendations/feed/USER_ID?limit=10&jobLimit=5
Authorization: Bearer YOUR_JWT_TOKEN

// 4. Get trending (cold start - no auth needed)
GET /api/recommendations/cold-start?type=jobs&limit=10

// 5. Get score explanation (for debugging)
GET /api/recommendations/explain/USER_ID/CONTENT_ID?type=job
Authorization: Bearer YOUR_JWT_TOKEN

// 6. Get insights
GET /api/recommendations/insights/USER_ID
Authorization: Bearer YOUR_JWT_TOKEN
*/

// ============= STEP 4: Frontend Integration Examples =============

// JavaScript/React Example:
/*
import React, { useState, useEffect } from 'react';

function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const userId = localStorage.getItem('userId');
      
      const response = await fetch(
        `/api/recommendations/feed/${userId}?limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch recommendations');
      
      const data = await response.json();
      setRecommendations(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading recommendations...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Your Personalized Recommendations</h1>
      {recommendations.map(item => (
        <div key={item.jobId || item.postId} className="recommendation-card">
          <h3>{item.type === 'job' ? item.role : item.title}</h3>
          <p>Score: {item.scores.final}/100</p>
          
          {item.type === 'job' && (
            <>
              <p>Salary: ${item.salary}</p>
              <p>Matched Skills: {item.scoreBreakdown.matchedSkills.join(', ')}</p>
            </>
          )}
          
          <div className="score-breakdown">
            <small>
              Skill Match: {item.scores.skillMatch} | 
              Engagement: {item.scores.engagement} | 
              Freshness: {item.scores.freshness}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RecommendationsPage;
*/

// ============= STEP 5: Environment Configuration =============

/*
// Add to your .env file:

# Recommendation System
RECOMMENDATION_CACHE_ENABLED=true
RECOMMENDATION_CACHE_EXPIRY=300000
RECOMMENDATION_MAX_LIMIT=50
RECOMMENDATION_DEFAULT_LIMIT=10
*/

// ============= STEP 6: Database Optimization =============

/*
// Add these indexes to MongoDB for better performance:

db.jobs.createIndex({ "createdAt": -1 });
db.jobs.createIndex({ "startupId": 1 });
db.jobs.createIndex({ "views": -1 });
db.jobs.createIndex({ "likes": -1 });

db.posts.createIndex({ "createdAt": -1 });
db.posts.createIndex({ "startupid": 1 });
db.posts.createIndex({ "likes": -1 });

db.studentprofiles.createIndex({ "userId": 1 });
db.studentprofiles.createIndex({ "skills": 1 });
db.studentprofiles.createIndex({ "interests": 1 });

db.applications.createIndex({ "studentId": 1 });
db.applications.createIndex({ "jobId": 1 });
db.applications.createIndex({ "studentId": 1, "jobId": 1 });

db.savejobs.createIndex({ "studentId": 1 });
db.saveposts.createIndex({ "studentId": 1 });
*/

// ============= STEP 7: Testing the System =============

/*
// Run the test suite:
node recommendation/examples.js

// Expected output:
// - Configuration validation
// - Test scoring results
// - Performance benchmarks
// - System health check
*/

// ============= STEP 8: Monitoring & Maintenance =============

/*
// Track these metrics:

1. Average recommendation score
   GET /api/recommendations/insights/USER_ID
   
2. Cold start effectiveness
   Track how often users need cold-start recommendations
   
3. Click-through rate (CTR)
   Track which recommendations users interact with
   
4. Diversity ratio
   Ensure users see content from multiple startups

5. Processing time
   Monitor average time to generate recommendations
   
// Adjust weights if:
- Average scores are too high/low
- Diversity is poor
- Processing is slow
- User engagement drops
*/

// ============= STEP 9: Database Data Enrichment =============

/*
// To improve recommendations, ensure your database has:

1. Job Requirements filled out properly
   - Use comma/space-separated skills
   - Include specific technologies
   
2. Post Descriptions with keywords
   - Rich, descriptive text
   - Include relevant tags/skills

3. Student Profiles complete
   - Skills filled out
   - Interests specified
   - Location set
   
4. Engagement metrics tracked
   - Views on jobs/posts
   - Likes on posts
   - Applications on jobs
   - Saves of jobs/posts

// Script to check data completeness:
db.jobs.aggregate([
  {
    $group: {
      _id: null,
      totalJobs: { $sum: 1 },
      jobsWithRequirements: {
        $sum: { $cond: [{ $ne: ["$requirements", null] }, 1, 0] }
      },
      jobsWithViews: {
        $sum: { $cond: [{ $ne: ["$views", null] }, 1, 0] }
      }
    }
  }
])
*/

// ============= STEP 10: Future ML Integration Path =============

/*
// When you're ready to upgrade to ML:

1. Collect interaction data (clicks, saves, applies)
2. Build training dataset
3. Train collaborative filtering model
4. Use learned weights instead of static config
5. Gradually replace static scoring with ML predictions

// Example ML upgrade:
const mlRecommendations = require('./ml/rankingModel');

async function getJobRecommendationsML(studentId) {
  // Get candidate jobs
  const jobs = await Job.find();
  
  // Use ML model for ranking
  const scored = await mlRecommendations.rankJobs(studentId, jobs);
  
  return scored;
}
*/

// ============= COMMON ISSUES & SOLUTIONS =============

/*
ISSUE: "No recommendations returned"
SOLUTION: 
- Ensure student profile has skills/interests
- Ensure jobs have requirements
- Check database has enough content
- Try cold-start endpoint to verify data

ISSUE: "All recommendations have same score"
SOLUTION:
- Adjust weight distribution
- Ensure engagement metrics are populated
- Check if posts are same age (freshness bias)

ISSUE: "Slow performance"
SOLUTION:
- Add database indexes
- Enable recommendation caching
- Reduce content search limit
- Use pagination/lazy loading on frontend

ISSUE: "Scores don't make sense"
SOLUTION:
- Use explain endpoint to debug
- Check skill normalization (js → javascript)
- Verify timestamp formatting
- Review configuration weights
*/

// ============= VALIDATION CHECKLIST =============

/*
Before going to production:

☐ Configuration validates without errors
☐ All model fields present and populated
☐ Database indexes created for performance
☐ Routes integrated in main index.js
☐ JWT middleware working on protected routes
☐ Cold-start endpoint tested
☐ Personalized endpoints tested with real user data
☐ Score explanation endpoint provides correct breakdown
☐ Error handling in place for missing profiles
☐ Monitoring/logging set up
☐ Documentation updated
☐ Backend tests passing
*/

console.log('Integration guide loaded. See comments above for setup instructions.');
module.exports = {
  setupInstructions: 'See above'
};
