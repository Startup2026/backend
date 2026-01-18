/**
 * Recommendation System Testing & Validation Utilities
 * Use these for testing, debugging, and monitoring the recommendation system
 */

const recommendationSystem = require('./recommendationSystem');
const config = require('./config.js');

class RecommendationUtils {
  /**
   * Simulate recommendation scoring for testing
   * @param {object} userProfile - Mock student profile
   * @param {object} content - Mock job/post
   * @param {string} contentType - 'job' or 'post'
   * @returns {object} - Full scoring breakdown
   */
  simulateScoring(userProfile, content, contentType = 'job') {
    // Extract tags
    const contentTags = recommendationSystem.extractTags(
      contentType === 'job' ? content.requirements : content.description
    );

    // Calculate skill match
    const userSkillsOrInterests = contentType === 'job' 
      ? (userProfile.skills || [])
      : (userProfile.interests || []);

    const skillMatch = recommendationSystem.calculateSkillMatchScore(
      userSkillsOrInterests,
      contentTags
    );

    // Calculate engagement
    const engagement = recommendationSystem.calculateEngagementScore(content);

    // Calculate freshness
    const freshness = recommendationSystem.calculateFreshnessScore(
      content.createdAt || new Date()
    );

    // Calculate contextual boost
    const contextualBoost = recommendationSystem.calculateContextualBoost(
      userProfile,
      content
    );

    // Calculate diversity penalty
    const diversityPenalty = recommendationSystem.calculateDiversityPenalty(
      content.startupId,
      content.recentInteractions || []
    );

    // Calculate final score
    const finalScore = recommendationSystem.calculateFinalScore({
      skillMatch: skillMatch.score,
      engagement,
      freshness,
      contextualBoost,
      diversityPenalty
    });

    return {
      skillMatch,
      engagement,
      freshness,
      contextualBoost,
      diversityPenalty,
      finalScore,
      breakdown: {
        components: {
          skillMatch: skillMatch.score,
          engagement: Math.round(engagement * 100) / 100,
          freshness,
          contextualBoost,
          diversityPenalty
        },
        maxPoints: config.getTotalWeights(),
        percentageOfMax: Math.round((finalScore / 100) * 100)
      }
    };
  }

  /**
   * Validate student profile has required fields
   * @param {object} profile - Student profile to validate
   * @returns {object} - {valid, missing}
   */
  validateStudentProfile(profile) {
    const required = ['skills', 'interests', 'location'];
    const missing = [];

    required.forEach(field => {
      if (!profile[field] || (Array.isArray(profile[field]) && profile[field].length === 0)) {
        missing.push(field);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
      suggestion: missing.length > 0 
        ? `Profile is incomplete. Missing: ${missing.join(', ')}. Cold start recommendations will be used.`
        : 'Profile is complete. Personalized recommendations available.'
    };
  }

  /**
   * Validate content (job/post) has required fields
   * @param {object} content - Job or post to validate
   * @param {string} contentType - 'job' or 'post'
   * @returns {object} - {valid, missing, warnings}
   */
  validateContent(content, contentType = 'job') {
    const missing = [];
    const warnings = [];

    const requiredFields = contentType === 'job' 
      ? ['role', 'requirements', 'startupId', 'createdAt']
      : ['title', 'description', 'startupid', 'createdAt'];

    requiredFields.forEach(field => {
      if (!content[field]) {
        missing.push(field);
      }
    });

    // Check optional but important fields
    if (!content.likes && contentType === 'post') {
      warnings.push('Post has no likes - engagement score will be 0');
    }

    if (contentType === 'job' && !content.salary) {
      warnings.push('Job has no salary information');
    }

    const now = new Date();
    const ageInDays = (now - new Date(content.createdAt)) / (1000 * 60 * 60 * 24);
    if (ageInDays > 90) {
      warnings.push(`Content is ${Math.floor(ageInDays)} days old - very low freshness score`);
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings
    };
  }

  /**
   * Generate test data for development
   * @returns {object} - Mock student profile and content
   */
  generateTestData() {
    const testStudentProfile = {
      userId: '507f1f77bcf86cd799439001',
      firstName: 'John',
      lastName: 'Doe',
      location: 'San Francisco',
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      interests: ['Web Development', 'Startups', 'Technology'],
      education: [{
        institution: 'UC Berkeley',
        degree: 'BS',
        field: 'Computer Science',
        endYear: new Date().getFullYear().toString()
      }]
    };

    const testJob = {
      _id: '507f1f77bcf86cd799439011',
      role: 'Frontend Developer',
      requirements: 'JavaScript, React, Node.js, CSS, REST APIs',
      salary: 80000,
      views: 150,
      likes: 25,
      applications: 12,
      saves: 8,
      startupId: {
        _id: '507f1f77bcf86cd799439012',
        startupName: 'TechStart Inc',
        industry: 'Technology'
      },
      location: 'San Francisco',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    };

    const testPost = {
      _id: '507f1f77bcf86cd799439020',
      title: 'Building React Apps at Scale',
      description: 'Learn advanced React patterns and best practices. Web development, JavaScript, performance optimization',
      likes: 45,
      comments: [{ user: 'user1', text: 'Great post!' }],
      views: 300,
      startupid: {
        _id: '507f1f77bcf86cd799439012',
        startupName: 'TechStart Inc'
      },
      location: 'San Francisco',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day old
    };

    return {
      studentProfile: testStudentProfile,
      job: testJob,
      post: testPost
    };
  }

  /**
   * Run full test suite
   * @returns {object} - Test results
   */
  async runTestSuite() {
    const results = {
      configuration: config.validate(),
      testScoring: {},
      profileValidation: {},
      contentValidation: {}
    };

    // Generate test data
    const testData = this.generateTestData();

    // Test scoring
    try {
      results.testScoring.job = this.simulateScoring(
        testData.studentProfile,
        testData.job,
        'job'
      );

      results.testScoring.post = this.simulateScoring(
        testData.studentProfile,
        testData.post,
        'post'
      );

      results.testScoring.status = 'success';
    } catch (error) {
      results.testScoring.status = 'failed';
      results.testScoring.error = error.message;
    }

    // Validate profiles
    results.profileValidation = this.validateStudentProfile(
      testData.studentProfile
    );

    // Validate content
    results.contentValidation.job = this.validateContent(
      testData.job,
      'job'
    );

    results.contentValidation.post = this.validateContent(
      testData.post,
      'post'
    );

    return results;
  }

  /**
   * Benchmark recommendation calculation
   * Measures time taken to score content
   * @param {number} contentCount - Number of items to score
   * @returns {object} - Timing results
   */
  benchmarkScoring(contentCount = 100) {
    const testData = this.generateTestData();
    const items = Array(contentCount).fill(testData.job);

    const startTime = performance.now();

    items.forEach(item => {
      this.simulateScoring(testData.studentProfile, item, 'job');
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgTimePerItem = totalTime / contentCount;

    return {
      totalItemsScored: contentCount,
      totalTimeMs: Math.round(totalTime * 100) / 100,
      averageTimePerItemMs: Math.round(avgTimePerItem * 100) / 100,
      itemsPerSecond: Math.round((1000 / avgTimePerItem) * 100) / 100,
      performance: avgTimePerItem < 1 ? 'excellent' : avgTimePerItem < 5 ? 'good' : 'needs optimization'
    };
  }

  /**
   * Compare weights and their impact
   * Shows contribution of each scoring component
   * @param {number} simulationCount - Number of simulations
   * @returns {object} - Weight contribution analysis
   */
  analyzeWeightImpact(simulationCount = 1000) {
    const testData = this.generateTestData();
    const simulations = [];

    // Run multiple simulations with slight variations
    for (let i = 0; i < simulationCount; i++) {
      const variedJob = {
        ...testData.job,
        views: Math.floor(Math.random() * 500),
        likes: Math.floor(Math.random() * 100),
        applications: Math.floor(Math.random() * 50),
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      };

      const scoring = this.simulateScoring(testData.studentProfile, variedJob, 'job');
      simulations.push(scoring);
    }

    // Calculate average contribution of each component
    const avgContribution = {
      skillMatch: simulations.reduce((sum, s) => sum + s.breakdown.components.skillMatch, 0) / simulationCount,
      engagement: simulations.reduce((sum, s) => sum + s.breakdown.components.engagement, 0) / simulationCount,
      freshness: simulations.reduce((sum, s) => sum + s.breakdown.components.freshness, 0) / simulationCount,
      contextualBoost: simulations.reduce((sum, s) => sum + s.breakdown.components.contextualBoost, 0) / simulationCount,
      diversityPenalty: simulations.reduce((sum, s) => sum + s.breakdown.components.diversityPenalty, 0) / simulationCount
    };

    // Calculate percentage of max possible
    const totalMax = config.getTotalWeights();
    const avgScore = Object.values(avgContribution).reduce((a, b) => a + b, 0);

    return {
      simulationCount,
      averageComponentContribution: Object.entries(avgContribution).reduce((acc, [key, val]) => {
        acc[key] = Math.round(val * 100) / 100;
        return acc;
      }, {}),
      averageTotal: Math.round(avgScore * 100) / 100,
      percentageOfMax: Math.round((avgScore / totalMax) * 100),
      recommendations: this.generateWeightRecommendations(avgContribution, config.weights)
    };
  }

  /**
   * Generate recommendations for weight adjustment
   */
  generateWeightRecommendations(contributions, weights) {
    const recommendations = [];

    // If engagement is very low, it might be weighted too low
    if (contributions.engagement < 2) {
      recommendations.push({
        component: 'engagement',
        suggestion: 'Engagement score is very low. Consider increasing engagement weight or lowering caps.',
        currentWeight: weights.engagement
      });
    }

    // If freshness dominates, reduce its weight
    if (contributions.freshness > 15) {
      recommendations.push({
        component: 'freshness',
        suggestion: 'Freshness dominates scoring. Consider reducing freshness weight for better diversity.',
        currentWeight: weights.freshness
      });
    }

    // If skill match is very high, it might be overweighted
    if (contributions.skillMatch > 30) {
      recommendations.push({
        component: 'skillMatch',
        suggestion: 'Skill match score is very high. Consider reducing weight to allow other factors to influence.',
        currentWeight: weights.skillMatch
      });
    }

    return recommendations.length > 0 ? recommendations : ['Weight distribution looks balanced'];
  }

  /**
   * Export configuration as JSON for documentation
   */
  exportConfig() {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Get system health status
   */
  getSystemHealth() {
    const validation = config.validate();
    const benchmark = this.benchmarkScoring(50);

    return {
      timestamp: new Date().toISOString(),
      configValid: validation.valid,
      configErrors: validation.errors,
      performanceStatus: benchmark.performance,
      benchmark: {
        avgTimePerItem: benchmark.averageTimePerItemMs,
        itemsPerSecond: benchmark.itemsPerSecond
      },
      recommendations: [
        !validation.valid ? `Fix configuration errors: ${validation.errors.join(', ')}` : null,
        benchmark.performance === 'needs optimization' ? 'Consider caching or optimizing scoring logic' : null
      ].filter(Boolean)
    };
  }
}

module.exports = new RecommendationUtils();
