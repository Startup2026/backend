# Recommendation System - Deployment Checklist

## Pre-Deployment Verification

### Code Integration
- [ ] `recommendations.routes.js` added to Express app
- [ ] All 4 core files exist:
  - [ ] `recommendationSystem.js`
  - [ ] `recommendation.controller.js`
  - [ ] `config.js`
  - [ ] Routes file
- [ ] No TypeScript errors
- [ ] No ESLint errors

### Database
- [ ] Job model has: `role`, `requirements`, `startupId`, `createdAt`
- [ ] Post model has: `title`, `description`, `startupid`, `createdAt`
- [ ] StudentProfile model has: `skills`, `interests`, `location`, `userId`
- [ ] Application model tracks applications correctly
- [ ] Sample data exists in database
- [ ] Database indexes created:
  ```javascript
  db.jobs.createIndex({ "createdAt": -1 });
  db.jobs.createIndex({ "startupId": 1 });
  db.posts.createIndex({ "createdAt": -1 });
  db.posts.createIndex({ "startupid": 1 });
  db.studentprofiles.createIndex({ "userId": 1 });
  ```

### Testing
- [ ] `npm test` or test suite passes
- [ ] Run: `node recommendation/examples.js` - all tests pass
- [ ] Manually test cold-start endpoint (no auth needed)
- [ ] Manually test personalized endpoints with real user
- [ ] Test with postman/curl:
  ```bash
  # Cold start
  curl "http://localhost:5000/api/recommendations/cold-start?type=jobs&limit=5"
  
  # Personalized (requires token)
  curl -H "Authorization: Bearer TOKEN" \
    "http://localhost:5000/api/recommendations/jobs/USER_ID?limit=5"
  
  # Explain endpoint (for debugging)
  curl -H "Authorization: Bearer TOKEN" \
    "http://localhost:5000/api/recommendations/explain/USER_ID/CONTENT_ID?type=job"
  ```

### Configuration
- [ ] Weights validated in `config.js`
- [ ] Total positive weights ≤ 100
- [ ] All synonyms correctly mapped
- [ ] Freshness brackets make sense
- [ ] No hardcoded values in code (all in config.js)

### Error Handling
- [ ] Missing student profile returns 400
- [ ] Invalid content ID returns 400
- [ ] Database errors caught and logged
- [ ] JWT errors properly handled
- [ ] Graceful fallback to cold-start if needed

### Performance
- [ ] Benchmark runs in < 5ms average per item
- [ ] Can handle 100+ items efficiently
- [ ] Database queries optimized
- [ ] No N+1 query problems

### Documentation
- [ ] README.md complete and accurate
- [ ] QUICK_START.md reviewed
- [ ] INTEGRATION_GUIDE.js provided to team
- [ ] IMPLEMENTATION_SUMMARY.md updated
- [ ] API endpoint documentation clear
- [ ] Example responses match actual output

### Monitoring Setup
- [ ] Logging enabled for API calls
- [ ] Performance metrics tracked
- [ ] Error logging in place
- [ ] User engagement tracking set up
- [ ] Average score monitoring ready

### Security
- [ ] JWT authentication required on protected endpoints
- [ ] Input validation in place
- [ ] No sensitive data in response logs
- [ ] Rate limiting considered (if needed)
- [ ] CORS properly configured

---

## Deployment Steps

### 1. Code Deployment
```bash
# Ensure all files are committed
git add backend/recommendation/
git add backend/router/recommendations.routes.js
git add backend/controller/recommendationController/
git commit -m "Add recommendation system"
git push

# Deploy to production
# (Your deployment process here)
```

### 2. Database Preparation
```bash
# Create indexes on production database
mongo production_db
db.jobs.createIndex({ "createdAt": -1 });
db.jobs.createIndex({ "startupId": 1 });
db.posts.createIndex({ "createdAt": -1 });
db.posts.createIndex({ "startupid": 1 });
db.studentprofiles.createIndex({ "userId": 1 });
```

### 3. Configuration
- [ ] Set environment variables (if any)
- [ ] Update API documentation with new endpoints
- [ ] Configure monitoring/logging
- [ ] Set up caching (if using Redis)

### 4. Smoke Tests
- [ ] Cold-start endpoint returns 200
- [ ] Personalized endpoints return 200 with auth
- [ ] Unauthorized requests return 401
- [ ] Invalid IDs return 400
- [ ] Database responses are fast (< 100ms)

### 5. Production Verification
```bash
# Test cold-start (no auth)
curl "https://api.yourdomain.com/api/recommendations/cold-start?type=jobs&limit=5"

# Test with real token
curl -H "Authorization: Bearer {real_token}" \
  "https://api.yourdomain.com/api/recommendations/jobs/{real_user_id}?limit=5"

# Check response format and timing
```

---

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error logs for exceptions
- [ ] Check average response time
- [ ] Verify scores are reasonable (50-80 range)
- [ ] Confirm no database connection issues
- [ ] Track user engagement with recommendations

### First Week
- [ ] Monitor cold-start usage (should be 0 if all profiles complete)
- [ ] Check if scores make sense for various users
- [ ] Measure click-through rate on recommendations
- [ ] Track diversity (unique startups in recommendations)
- [ ] Collect user feedback

### Ongoing
- [ ] Daily: Check error logs
- [ ] Weekly: Review average scores and diversity
- [ ] Weekly: Check recommendation quality
- [ ] Monthly: Analyze weight effectiveness
- [ ] Monthly: Plan weight adjustments if needed

---

## Rollback Plan

If issues occur:

### Immediate (< 5 minutes)
```bash
# Option 1: Disable recommendations endpoint
# Comment out route in index.js
# git push hotfix

# Option 2: Return empty recommendations (graceful degradation)
# Edit controller to return empty array
```

### Short-term (< 1 hour)
- Identify root cause using logs
- Fix in config.js or recommendation.controller.js
- Deploy fix
- Verify with tests

### Long-term (if major issues)
- Revert to cold-start only
- Debug with small sample
- Re-test thoroughly
- Redeploy

---

## Monitoring Queries

### MongoDB - Check data completeness
```javascript
// Jobs with requirements
db.jobs.aggregate([
  { $group: { 
      _id: null,
      total: { $sum: 1 },
      withRequirements: { 
        $sum: { $cond: [{ $ne: ["$requirements", null] }, 1, 0] } 
      }
    }
  }
])

// StudentProfiles with skills
db.studentprofiles.aggregate([
  { $group: {
      _id: null,
      total: { $sum: 1 },
      withSkills: {
        $sum: { $cond: [{ $gt: [{ $size: "$skills" }, 0] }, 1, 0] }
      }
    }
  }
])
```

### Application Metrics
```javascript
// Sample logging in your app
app.get('/api/recommendations/jobs/:studentId', (req, res) => {
  const startTime = Date.now();
  
  // ... get recommendations ...
  
  const duration = Date.now() - startTime;
  console.log({
    timestamp: new Date(),
    endpoint: 'recommendations/jobs',
    studentId: req.params.studentId,
    responseTime: duration,
    resultCount: recommendations.length,
    avgScore: recommendations.reduce((sum, r) => sum + r.scores.final, 0) / recommendations.length
  });
});
```

---

## Success Metrics

Track these KPIs:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| API Response Time | < 100ms | Monitor logs |
| Cold-Start Usage | < 5% of requests | Track endpoint calls |
| Average Score | 55-75 points | Calculate from responses |
| Diversity Ratio | > 70% | Count unique startups |
| Error Rate | < 0.1% | Monitor 500 errors |
| Click-Through Rate | > 30% | Track user interactions |

---

## Troubleshooting During Deployment

### Problem: "Module not found" errors
**Solution:**
- Verify file paths are correct
- Check for typos in require statements
- Ensure all files exist in correct directories

### Problem: "Cannot read property of undefined"
**Solution:**
- Check database documents have required fields
- Verify student profile exists
- Use try-catch and console.log for debugging

### Problem: "Very slow response time"
**Solution:**
- Check database indexes created
- Enable caching if available
- Reduce query scope
- Check network latency

### Problem: "All scores are identical"
**Solution:**
- Check if posts are same age
- Verify engagement metrics populated
- Check weight distribution in config

---

## Sign-off

- [ ] QA/Testing: All tests passed _______________
- [ ] DevOps: Database ready _______________
- [ ] Product: Monitoring configured _______________
- [ ] Documentation: Updated _______________

**Deployment Date:** _______________

**Deployed By:** _______________

**Notes:** _______________

---

## Post-Deployment Review

Conduct within 1 week of deployment:

- [ ] All endpoints working
- [ ] Response times acceptable
- [ ] No unexpected errors
- [ ] User feedback positive
- [ ] Metrics align with targets
- [ ] Documentation accurate
- [ ] Team understands system
- [ ] Monitoring in place

**Review Date:** _______________

**Outcome:** ✓ Success / ⚠️ Issues / ✗ Rollback

**Action Items:** _______________

---

## Contact & Support

For issues during deployment:

1. Check logs: `tail -f logs/app.log`
2. Test cold-start endpoint first
3. Review examples.js output
4. Check config.js values
5. See INTEGRATION_GUIDE.js for solutions
6. Review README.md for API details

**Emergency Contacts:**
- Tech Lead: _______________
- Database Admin: _______________
- DevOps: _______________
