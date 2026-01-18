/**
 * Recommendation System Configuration
 * Adjust these weights to fine-tune the recommendation algorithm
 */

const config = {
  // ============= SCORING WEIGHTS =============
  weights: {
    skillMatch: 40,        // Max points for skill matching
    engagement: 20,        // Max points for engagement metrics
    freshness: 20,         // Max points for freshness
    contextualBoost: 10,   // Max points for contextual match
    diversityPenalty: 10   // Max penalty for duplicate sources
  },

  // ============= ENGAGEMENT SCORING THRESHOLDS =============
  engagement: {
    views: {
      maxPoints: 5,
      logBase: 100,        // Logarithmic scaling base
      cap: 5
    },
    likes: {
      maxPoints: 10,
      logBase: 50,
      cap: 10
    },
    appliesSaves: {
      maxPoints: 5,
      divisor: 20,         // Every 20 applies/saves = 1 point
      cap: 5
    }
  },

  // ============= FRESHNESS SCORING BRACKETS =============
  freshness: {
    brackets: [
      { daysFrom: 0, daysTo: 3, points: 20 },
      { daysFrom: 4, daysTo: 7, points: 12 },
      { daysFrom: 8, daysTo: 14, points: 6 },
      { daysFrom: 15, daysTo: Infinity, points: 0 }
    ]
  },

  // ============= CONTEXTUAL BOOST =============
  contextualBoost: {
    locationMatch: 5,      // Points for location match
    academicYearMatch: 5   // Points for academic year match
  },

  // ============= DIVERSITY PENALTY =============
  diversity: {
    penaltyPerOccurrence: 2,  // Points deducted per additional post from same startup
    maxPenalty: 10             // Maximum penalty
  },

  // ============= SKILL MATCHING =============
  skillMatching: {
    synonyms: {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'cpp': 'cplusplus',
      'cc': 'cplusplus',
      'c#': 'csharp',
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
      'nlp': 'naturallanguageprocessing',
      'rest': 'restapi',
      'graphql': 'graphql',
      'docker': 'docker',
      'k8s': 'kubernetes',
      'aws': 'amazonwebservices',
      'azure': 'microsoftazure',
      'gcp': 'googlecloudplatform'
    },
    // Threshold for considering a tag match (0-1)
    // 1.0 = exact match only
    // 0.8 = 80% similar
    matchThreshold: 0.8
  },

  // ============= COLD START SETTINGS =============
  coldStart: {
    // How many days to consider "fresh" for new users
    freshnessWindow: 7,
    // Minimum likes for "popular" posts
    popularityThreshold: 10
  },

  // ============= RANKING & PAGINATION =============
  ranking: {
    defaultLimit: 10,
    maxLimit: 50,
    minLimit: 1
  },

  // ============= PERFORMANCE TUNING =============
  performance: {
    // Cache recommendations for X milliseconds
    cacheExpiry: 300000, // 5 minutes
    
    // Number of posts to fetch from DB before scoring
    // Increase for better diversity, decrease for speed
    queryLimit: 100,
    
    // Whether to use caching
    enableCaching: true
  },

  // ============= LOGGING & DEBUG =============
  logging: {
    // Log scoring details for each recommendation
    enableScoringLogging: false,
    
    // Log execution time
    enablePerformanceLogging: true,
    
    // Log API requests
    enableRequestLogging: true
  },

  // ============= FUTURE ML INTEGRATION =============
  ml: {
    // Weights for ML-based recommendations (when implemented)
    // These will gradually replace static weights
    enabled: false,
    modelVersion: 'v0',
    fallbackToStaticWeights: true
  }
};

// ============= HELPER FUNCTIONS =============

/**
 * Get engagement score threshold for a metric
 */
config.getEngagementThreshold = function(metric) {
  return this.engagement[metric];
};

/**
 * Get freshness points for age in days
 */
config.getFreshnessPoints = function(daysOld) {
  const bracket = this.freshness.brackets.find(
    b => daysOld >= b.daysFrom && daysOld <= b.daysTo
  );
  return bracket ? bracket.points : 0;
};

/**
 * Get synonym mapping
 */
config.getSynonym = function(word) {
  return this.skillMatching.synonyms[word.toLowerCase()] || word;
};

/**
 * Get all weights
 */
config.getTotalWeights = function() {
  return Object.values(this.weights).reduce((a, b) => a + b, 0);
};

/**
 * Validate configuration
 */
config.validate = function() {
  const errors = [];

  // Check total weights don't exceed 100
  const totalPositiveWeights = this.weights.skillMatch + 
                               this.weights.engagement + 
                               this.weights.freshness + 
                               this.weights.contextualBoost;
  
  if (totalPositiveWeights > 100) {
    errors.push('Total positive weights exceed 100 points');
  }

  // Check engagement sub-weights
  const engagementTotal = this.engagement.views.maxPoints +
                          this.engagement.likes.maxPoints +
                          this.engagement.appliesSaves.maxPoints;
  
  if (engagementTotal !== this.weights.engagement) {
    errors.push('Engagement sub-weights do not match engagement weight');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = config;
