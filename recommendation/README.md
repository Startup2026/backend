# Non-ML Recommendation System Documentation

## Overview

This is a transparent, non-machine-learning recommendation system designed to suggest relevant job posts and social feed updates to users. The algorithm is explainable, fast, scalable, and legally safe, with a clear path to ML-based upgrades in the future.

## Architecture

### Key Components

1. **recommendationSystem.js** - Core scoring engine
2. **recommendation.controller.js** - API handlers
3. **recommendations.routes.js** - Route definitions

## Algorithm Breakdown

### Step 1: Text Normalization
- Lowercase all text
- Remove punctuation
- Map synonyms (e.g., `js` → `javascript`, `py` → `python`)

### Step 2: Skill & Interest Matching (40 points)
```
Score = (Matched Tags / Total Post Tags) × 40
```
- Matches user skills/interests against post requirements/tags
- Uses normalized text comparison
- Returns matched tags and match percentage

### Step 3: Engagement Scoring (20 points)
- **Views** (5 pts): Capped logarithmic scaling
- **Likes** (10 pts): Capped logarithmic scaling  
- **Applications/Saves** (5 pts): Capped scaling

Capping prevents viral posts from dominating recommendations.

### Step 4: Freshness Scoring (20 points)
- **0-3 days**: 20 points
- **4-7 days**: 12 points
- **8-14 days**: 6 points
- **15+ days**: 0 points

Encourages discovery of recent opportunities.

### Step 5: Contextual Boost (10 points)
- **Location match**: +5 points
- **Academic year relevance**: +5 points

Personalizes recommendations based on user profile.

### Step 6: Diversity Penalty (-10 points)
- Penalizes repeated recommendations from same startup
- Formula: `-10 points × (number of recent posts from same startup)`
- Ensures feed diversity

### Final Score Formula
```
Final Score = Skill Match + Engagement + Freshness + Context Boost - Diversity Penalty
```
**Total possible: 100 points**

## API Endpoints

### 1. Get Job Recommendations
```
GET /recommendations/jobs/:studentId?limit=10
```

**Parameters:**
- `studentId` (path) - Student's user ID
- `limit` (query) - Number of recommendations (default: 10)

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "jobId": "507f1f77bcf86cd799439011",
      "role": "Frontend Developer",
      "startupName": "TechStart Inc",
      "startupId": "507f1f77bcf86cd799439012",
      "salary": 50000,
      "stipend": false,
      "deadline": "2026-02-28",
      "createdAt": "2026-01-15T10:00:00Z",
      "scores": {
        "skillMatch": 35.5,
        "engagement": 12.3,
        "freshness": 20,
        "contextualBoost": 5,
        "diversityPenalty": 0,
        "final": 72.8
      },
      "scoreBreakdown": {
        "matchedSkills": ["javascript", "reactjs", "nodejs"],
        "totalSkillsRequired": 5
      }
    }
  ],
  "count": 10,
  "message": "Found 10 job recommendations"
}
```

### 2. Get Social Feed Recommendations
```
GET /recommendations/posts/:studentId?limit=10
```

**Parameters:**
- `studentId` (path) - Student's user ID
- `limit` (query) - Number of recommendations (default: 10)

**Authentication:** Required (JWT token)

**Response:** Similar to job recommendations, but for posts

### 3. Get Combined Personalized Feed
```
GET /recommendations/feed/:studentId?limit=10&jobLimit=5
```

**Parameters:**
- `studentId` (path) - Student's user ID
- `limit` (query) - Total items in feed (default: 10)
- `jobLimit` (query) - Number of jobs (default: half of limit)

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "job",
      "jobId": "507f1f77bcf86cd799439011",
      ...
    },
    {
      "type": "post",
      "postId": "507f1f77bcf86cd799439020",
      ...
    }
  ],
  "count": 10,
  "statistics": {
    "jobs": 5,
    "posts": 5
  }
}
```

### 4. Cold Start Recommendations (New Users)
```
GET /recommendations/cold-start?type=jobs&limit=10
```

**Parameters:**
- `type` (query) - Either "jobs" or "posts" (default: "jobs")
- `limit` (query) - Number of recommendations (default: 10)

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "jobId": "507f1f77bcf86cd799439011",
      "role": "Backend Developer",
      "startupName": "StartupXYZ",
      "salary": 60000,
      "freshnessBased": true,
      "reason": "New and trending job posting"
    }
  ],
  "count": 10,
  "type": "jobs"
}
```

### 5. Score Explanation (Debugging)
```
GET /recommendations/explain/:userId/:contentId?type=job
```

**Parameters:**
- `userId` (path) - Student's user ID
- `contentId` (path) - Job or Post ID
- `type` (query) - Either "job" or "post"

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439001",
    "contentId": "507f1f77bcf86cd799439011",
    "contentType": "job",
    "studentProfile": {
      "skills": ["javascript", "reactjs", "nodejs"],
      "interests": ["web development", "startups"],
      "location": "San Francisco"
    },
    "content": {
      "title": "Frontend Developer",
      "startup": "TechStart Inc",
      "createdAt": "2026-01-15T10:00:00Z"
    },
    "scoreBreakdown": {
      "skillMatch": {
        "score": 35.5,
        "maxPoints": 40,
        "explanation": "3 out of 5 required skills matched",
        "matchedTags": ["javascript", "reactjs", "nodejs"]
      },
      "engagement": {
        "score": 12.3,
        "maxPoints": 20,
        "explanation": "Views: 5, Likes: 7, Applies/Saves: 0.3"
      },
      "freshness": {
        "score": 20,
        "maxPoints": 20,
        "explanation": "Posted 1 days ago - Very Fresh (20 pts)"
      },
      "contextualBoost": {
        "score": 5,
        "maxPoints": 10,
        "explanation": "Location matched"
      }
    },
    "finalScore": 72.8
  }
}
```

### 6. Analytics & Insights
```
GET /recommendations/insights/:studentId
```

**Parameters:**
- `studentId` (path) - Student's user ID

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": {
      "totalRecommendations": 100,
      "averageScore": 65.5,
      "topScore": 92.3,
      "skillMatchAverage": 28.5,
      "topStartups": ["TechStart Inc", "StartupXYZ", "InnovateCo"]
    },
    "posts": {
      "totalRecommendations": 100,
      "averageScore": 55.2,
      "topScore": 88.7,
      "interestMatchAverage": 24.3,
      "topStartups": ["TechStart Inc", "StartupXYZ"]
    },
    "recommendations": {
      "topJobRecommendation": { ... },
      "topPostRecommendation": { ... }
    }
  }
}
```

## Integration with Express

Add the routes to your main `index.js`:

```javascript
const recommendationRoutes = require('./router/recommendations.routes');

// Add to your app
app.use('/api/recommendations', recommendationRoutes);
```

## Database Requirements

Ensure your models include these fields:

**Job Model:**
- `role` - Job title
- `requirements` - Required skills
- `salary` - Job salary
- `views` - Number of views
- `applications` - Number of applications
- `createdAt` - Timestamp

**Post Model:**
- `title` - Post title
- `description` - Post content
- `likes` - Number of likes
- `comments` - Array of comments
- `startupid` - Reference to startup
- `createdAt` - Timestamp

**StudentProfile Model:**
- `skills` - Array of skills
- `interests` - Array of interests
- `location` - User location
- `education` - Array with academic info

## Example Usage

### Frontend JavaScript
```javascript
// Get job recommendations
const response = await fetch(
  '/api/recommendations/jobs/507f1f77bcf86cd799439001?limit=10',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const recommendations = await response.json();

// Get explanation for specific job
const explanation = await fetch(
  '/api/recommendations/explain/507f1f77bcf86cd799439001/507f1f77bcf86cd799439011?type=job',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```

### Cold Start Flow
```javascript
// For new users without profile data
const trending = await fetch('/api/recommendations/cold-start?type=jobs&limit=10');
const trendingJobs = await trending.json();

// Display trending jobs until user completes profile
```

## Performance Considerations

- **Caching:** Implement Redis caching for frequently requested recommendations
- **Batch Processing:** Use background jobs for updating engagement metrics
- **Indexing:** Add database indexes on:
  - `createdAt` (for freshness queries)
  - `startupId` (for diversity penalties)
  - `studentId` (for user-specific queries)

## Future ML Upgrades

Once interaction data scales, you can:

1. **Replace static weights** with learned ranking models
2. **Use collaborative filtering** for improved skill matching
3. **Implement deep learning** for content understanding
4. **Add A/B testing** for weight optimization

## Advantages of Current Approach

✅ **Transparent** - Clear scoring breakdown  
✅ **Fast** - No ML inference latency  
✅ **Scalable** - Linear complexity  
✅ **Safe** - No privacy concerns with black-box models  
✅ **Debuggable** - Easy to explain recommendations  
✅ **Compliant** - No GDPR/privacy issues  
✅ **ML-ready** - Easy transition when scaling

## Troubleshooting

### No recommendations returned
- Ensure student profile has skills/interests filled
- Check if jobs/posts have requirements/descriptions
- Verify timestamps are correct

### Low scores everywhere
- Student might have no overlapping skills with posts
- Posts might be very old (check freshness)
- Check skill normalization (is "js" being mapped to "javascript"?)

### Score explanation endpoint errors
- Verify contentId exists
- Ensure userId has a StudentProfile
- Check type parameter is "job" or "post"

## Testing

```bash
# Test job recommendations
curl -H "Authorization: Bearer TOKEN" \
  'http://localhost:5000/api/recommendations/jobs/USER_ID?limit=5'

# Test cold start (no auth needed)
curl 'http://localhost:5000/api/recommendations/cold-start?type=jobs&limit=5'

# Test score explanation
curl -H "Authorization: Bearer TOKEN" \
  'http://localhost:5000/api/recommendations/explain/USER_ID/CONTENT_ID?type=job'
```

## Support & Maintenance

- Monitor recommendation quality through insights endpoint
- Track average scores and diversity metrics
- Periodically adjust weights based on user feedback
- Prepare for ML upgrade when data volume increases
