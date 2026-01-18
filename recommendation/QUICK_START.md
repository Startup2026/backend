# Quick Start Guide - Recommendation System

## 5-Minute Setup

### Step 1: Add Route to Express App (1 minute)

In `backend/index.js`, add this line:

```javascript
// After other route imports
const recommendationRoutes = require('./router/recommendations.routes');

// In your Express app setup (after other app.use statements)
app.use('/api/recommendations', recommendationRoutes);
```

### Step 2: Test the System (2 minutes)

```bash
# Navigate to your backend folder
cd backend

# Run the test suite
node recommendation/examples.js
```

You should see:
- ✓ Configuration validation
- Test scoring results
- Performance benchmarks

### Step 3: Test an Endpoint (2 minutes)

Use Postman, curl, or your API client:

```
GET /api/recommendations/cold-start?type=jobs&limit=5
```

This endpoint doesn't need authentication - it returns trending jobs.

Expected response:
```json
{
  "success": true,
  "data": [
    {
      "jobId": "...",
      "role": "Developer",
      "startupName": "...",
      "freshnessBased": true,
      "reason": "New and trending job posting"
    }
  ],
  "count": 5
}
```

## Next: Test Personalized Recommendations

### Prerequisites:
1. Have a student user ID
2. Have a JWT token for authentication
3. Student profile should have skills/interests filled

### Test Job Recommendations:

```
GET /api/recommendations/jobs/{studentId}?limit=5
Authorization: Bearer {YOUR_JWT_TOKEN}
```

Example response:
```json
{
  "success": true,
  "data": [
    {
      "jobId": "507f1f77bcf86cd799439011",
      "role": "Frontend Developer",
      "startupName": "TechStart Inc",
      "salary": 80000,
      "scores": {
        "skillMatch": 35.5,
        "engagement": 12.3,
        "freshness": 20,
        "contextualBoost": 5,
        "diversityPenalty": 0,
        "final": 72.8
      }
    }
  ],
  "count": 5
}
```

### Test Combined Feed:

```
GET /api/recommendations/feed/{studentId}?limit=10&jobLimit=5
Authorization: Bearer {YOUR_JWT_TOKEN}
```

This returns both jobs and posts interleaved by score.

## Understanding the Scores

Each recommendation includes a `scores` object:

| Score | Max | Meaning |
|-------|-----|---------|
| `skillMatch` | 40 | How many required skills do you have? |
| `engagement` | 20 | How popular is this post? (views, likes, applies) |
| `freshness` | 20 | How recent is this? (older = lower score) |
| `contextualBoost` | 10 | Does location or academic year match? |
| `diversityPenalty` | -10 | Penalty if same startup appears repeatedly |
| `final` | 100 | Total score - higher is better |

## Debugging a Recommendation

To understand WHY a specific job/post got a certain score:

```
GET /api/recommendations/explain/{userId}/{contentId}?type=job
Authorization: Bearer {YOUR_JWT_TOKEN}
```

Response includes detailed breakdown:
```json
{
  "success": true,
  "data": {
    "scoreBreakdown": {
      "skillMatch": {
        "score": 35.5,
        "explanation": "3 out of 5 required skills matched",
        "matchedTags": ["javascript", "react", "nodejs"]
      },
      "freshness": {
        "score": 20,
        "explanation": "Posted 1 days ago - Very Fresh (20 pts)"
      }
      ...
    }
  }
}
```

## File Structure

```
backend/recommendation/
├── recommendationSystem.js      # Core algorithm (don't modify)
├── recommendation.controller.js # API handlers (don't modify)
├── config.js                    # ADJUST WEIGHTS HERE
├── utils.js                     # Testing tools
├── examples.js                  # Test suite
├── README.md                    # Full documentation
├── INTEGRATION_GUIDE.js         # Detailed setup
├── IMPLEMENTATION_SUMMARY.md    # What was built
└── QUICK_START.md              # This file

backend/router/
└── recommendations.routes.js    # Route definitions

backend/controller/recommendationController/
└── recommendation.controller.js # Already created above
```

## Customization

### Change Scoring Weights

Edit `recommendation/config.js`:

```javascript
weights: {
  skillMatch: 40,        // How important is skill matching? (0-100)
  engagement: 20,        // How important is popularity?
  freshness: 20,         // How important is recency?
  contextualBoost: 10,   // How important is location/year match?
  diversityPenalty: 10   // How strict should diversity be?
}
```

### Add More Skill Synonyms

In `config.js`, add to `skillMatching.synonyms`:

```javascript
synonyms: {
  'js': 'javascript',
  'py': 'python',
  'yourabbrev': 'fullname',  // Add custom mappings
}
```

### Adjust Freshness Brackets

In `config.js`, modify `freshness.brackets`:

```javascript
brackets: [
  { daysFrom: 0, daysTo: 2, points: 20 },   // Very new = 20 pts
  { daysFrom: 3, daysTo: 7, points: 10 },   // Recent = 10 pts
  { daysFrom: 8, daysTo: 30, points: 5 },   // Older = 5 pts
  { daysFrom: 31, daysTo: Infinity, points: 0 } // Very old = 0 pts
]
```

## API Reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /recommendations/jobs/:id` | Yes | Get job recommendations for a student |
| `GET /recommendations/posts/:id` | Yes | Get social feed recommendations |
| `GET /recommendations/feed/:id` | Yes | Get combined jobs + posts |
| `GET /recommendations/cold-start` | No | Get trending jobs/posts (for new users) |
| `GET /recommendations/explain/:userId/:contentId` | Yes | Debug a specific recommendation |
| `GET /recommendations/insights/:id` | Yes | Get analytics about recommendations |

## Common Issues

### "No recommendations returned"
**Solution:**
1. Check if student has skills/interests in profile
2. Check if jobs/posts have requirements/descriptions
3. Try cold-start endpoint first

### "All recommendations have score 0"
**Solution:**
1. Verify posts aren't too old (> 14 days = 0 freshness)
2. Check that database has likes/views data
3. Run `node recommendation/examples.js` to test

### "Slow performance"
**Solution:**
1. Add database indexes (see INTEGRATION_GUIDE.js)
2. Enable caching in config.js
3. Reduce limit parameter

## Production Checklist

- [ ] Routes added to Express app
- [ ] Test endpoints working
- [ ] Database indexes created
- [ ] Error handling verified
- [ ] Monitoring set up
- [ ] Weights tuned for your use case
- [ ] Cold-start endpoint tested
- [ ] Personalized endpoint tested with real users
- [ ] Documentation shared with team

## Next Steps

1. **Read Full Docs:** See `README.md`
2. **Understand Algorithm:** See `IMPLEMENTATION_SUMMARY.md`
3. **Detailed Setup:** See `INTEGRATION_GUIDE.js`
4. **Tune Weights:** Edit `config.js`
5. **Monitor Quality:** Use `/insights` endpoint

## Questions?

- **Algorithm details?** → README.md
- **How to set up?** → INTEGRATION_GUIDE.js
- **Need to debug?** → Use `/explain` endpoint
- **Want to test?** → Run `node recommendation/examples.js`
- **Want to customize?** → Edit `config.js`

---

**That's it!** You now have a working recommendation system. Start with cold-start endpoint, then test with real user data.
