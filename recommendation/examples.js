/**
 * Recommendation System - Testing & Examples
 * 
 * Run this file to test the recommendation system:
 * node recommendation/examples.js
 */

const recommendationSystem = require('./recommendationSystem');
const recommendationUtils = require('./utils');
const config = require('./config');

async function runExamples() {
  console.log('='.repeat(80));
  console.log('RECOMMENDATION SYSTEM - TESTING & EXAMPLES');
  console.log('='.repeat(80));

  // ============= EXAMPLE 1: CONFIGURATION VALIDATION =============
  console.log('\n1. CONFIGURATION VALIDATION\n');
  console.log('-'.repeat(80));

  const configValidation = config.validate();
  console.log('Configuration Status:', configValidation.valid ? '✓ VALID' : '✗ INVALID');
  
  if (configValidation.errors.length > 0) {
    console.log('Errors:');
    configValidation.errors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('Total possible points:', config.getTotalWeights());
    console.log('Weight distribution:');
    Object.entries(config.weights).forEach(([key, val]) => {
      const percentage = Math.round((val / config.getTotalWeights()) * 100);
      console.log(`  - ${key}: ${val} points (${percentage}%)`);
    });
  }

  // ============= EXAMPLE 2: TEST DATA GENERATION =============
  console.log('\n2. TEST DATA GENERATION\n');
  console.log('-'.repeat(80));

  const testData = recommendationUtils.generateTestData();
  console.log('Generated Test Student Profile:');
  console.log(`  Name: ${testData.studentProfile.firstName} ${testData.studentProfile.lastName}`);
  console.log(`  Location: ${testData.studentProfile.location}`);
  console.log(`  Skills: ${testData.studentProfile.skills.join(', ')}`);
  console.log(`  Interests: ${testData.studentProfile.interests.join(', ')}`);

  console.log('\nGenerated Test Job:');
  console.log(`  Role: ${testData.job.role}`);
  console.log(`  Requirements: ${testData.job.requirements}`);
  console.log(`  Salary: $${testData.job.salary}`);

  console.log('\nGenerated Test Post:');
  console.log(`  Title: ${testData.post.title}`);
  console.log(`  Likes: ${testData.post.likes}`);

  // ============= EXAMPLE 3: PROFILE VALIDATION =============
  console.log('\n3. PROFILE VALIDATION\n');
  console.log('-'.repeat(80));

  const profileValidation = recommendationUtils.validateStudentProfile(
    testData.studentProfile
  );
  console.log('Profile Status:', profileValidation.valid ? '✓ COMPLETE' : '✗ INCOMPLETE');
  console.log('Message:', profileValidation.suggestion);

  // ============= EXAMPLE 4: CONTENT VALIDATION =============
  console.log('\n4. CONTENT VALIDATION\n');
  console.log('-'.repeat(80));

  const jobValidation = recommendationUtils.validateContent(testData.job, 'job');
  console.log('Job Validation:', jobValidation.valid ? '✓ VALID' : '✗ INVALID');
  if (jobValidation.warnings.length > 0) {
    console.log('Warnings:');
    jobValidation.warnings.forEach(w => console.log(`  - ${w}`));
  }

  const postValidation = recommendationUtils.validateContent(testData.post, 'post');
  console.log('\nPost Validation:', postValidation.valid ? '✓ VALID' : '✗ INVALID');
  if (postValidation.warnings.length > 0) {
    console.log('Warnings:');
    postValidation.warnings.forEach(w => console.log(`  - ${w}`));
  }

  // ============= EXAMPLE 5: SCORING SIMULATION =============
  console.log('\n5. SCORING SIMULATION - JOB\n');
  console.log('-'.repeat(80));

  const jobScoring = recommendationUtils.simulateScoring(
    testData.studentProfile,
    testData.job,
    'job'
  );

  console.log('Scoring Breakdown:');
  console.log(`  Skill Match:       ${jobScoring.skillMatch.score} / 40`);
  console.log(`    - Matched: ${jobScoring.skillMatch.matchedTags.join(', ')}`);
  console.log(`    - Match Rate: ${Math.round((jobScoring.skillMatch.matchedTags.length / jobScoring.skillMatch.totalTags) * 100)}%`);
  
  console.log(`  Engagement:        ${jobScoring.engagement} / 20`);
  console.log(`  Freshness:         ${jobScoring.freshness} / 20`);
  console.log(`  Contextual Boost:  ${jobScoring.contextualBoost} / 10`);
  console.log(`  Diversity Penalty: ${jobScoring.diversityPenalty}`);
  
  console.log(`\n  FINAL SCORE:       ${jobScoring.finalScore} / 100`);
  console.log(`  Percentage:        ${jobScoring.breakdown.percentageOfMax}%`);

  // ============= EXAMPLE 6: SCORING SIMULATION - POST =============
  console.log('\n6. SCORING SIMULATION - POST\n');
  console.log('-'.repeat(80));

  const postScoring = recommendationUtils.simulateScoring(
    testData.studentProfile,
    testData.post,
    'post'
  );

  console.log('Scoring Breakdown:');
  console.log(`  Interest Match:    ${postScoring.skillMatch.score} / 40`);
  console.log(`    - Matched: ${postScoring.skillMatch.matchedTags.join(', ')}`);
  
  console.log(`  Engagement:        ${postScoring.engagement} / 20`);
  console.log(`  Freshness:         ${postScoring.freshness} / 20`);
  console.log(`  Contextual Boost:  ${postScoring.contextualBoost} / 10`);
  console.log(`  Diversity Penalty: ${postScoring.diversityPenalty}`);
  
  console.log(`\n  FINAL SCORE:       ${postScoring.finalScore} / 100`);
  console.log(`  Percentage:        ${postScoring.breakdown.percentageOfMax}%`);

  // ============= EXAMPLE 7: BENCHMARK =============
  console.log('\n7. PERFORMANCE BENCHMARK (100 items)\n');
  console.log('-'.repeat(80));

  const benchmark = recommendationUtils.benchmarkScoring(100);
  console.log(`Total items scored:      ${benchmark.totalItemsScored}`);
  console.log(`Total time:              ${benchmark.totalTimeMs}ms`);
  console.log(`Average per item:        ${benchmark.averageTimePerItemMs}ms`);
  console.log(`Items per second:        ${benchmark.itemsPerSecond}`);
  console.log(`Performance rating:      ${benchmark.performance.toUpperCase()}`);

  // ============= EXAMPLE 8: WEIGHT IMPACT ANALYSIS =============
  console.log('\n8. WEIGHT IMPACT ANALYSIS (1000 simulations)\n');
  console.log('-'.repeat(80));

  const weightAnalysis = recommendationUtils.analyzeWeightImpact(1000);
  console.log('Average contribution of each component:');
  Object.entries(weightAnalysis.averageComponentContribution).forEach(([key, val]) => {
    console.log(`  - ${key}: ${val}`);
  });
  console.log(`\nAverage final score: ${weightAnalysis.averageTotal} / 100`);
  console.log(`Percentage of max:   ${weightAnalysis.percentageOfMax}%`);

  if (weightAnalysis.recommendations.length > 0 && 
      typeof weightAnalysis.recommendations[0] === 'object') {
    console.log('\nRecommendations:');
    weightAnalysis.recommendations.forEach(rec => {
      console.log(`  - ${rec.component}: ${rec.suggestion}`);
    });
  }

  // ============= EXAMPLE 9: TEXT NORMALIZATION =============
  console.log('\n9. TEXT NORMALIZATION EXAMPLES\n');
  console.log('-'.repeat(80));

  const textExamples = [
    'JavaScript & Node.js',
    'React.js Development',
    'Python 3.x',
    'C++ Programming',
    'Machine Learning (ML)',
    'Artificial Intelligence AI'
  ];

  console.log('Text normalization:');
  textExamples.forEach(text => {
    const normalized = recommendationSystem.normalizeText(text);
    console.log(`  "${text}" → "${normalized}"`);
  });

  // ============= EXAMPLE 10: FRESHNESS SCORING =============
  console.log('\n10. FRESHNESS SCORING EXAMPLES\n');
  console.log('-'.repeat(80));

  const daysExamples = [0, 2, 5, 7, 10, 14, 20, 30];
  
  console.log('Freshness scores by age:');
  daysExamples.forEach(days => {
    const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const score = recommendationSystem.calculateFreshnessScore(date);
    console.log(`  ${days} days old: ${score} points`);
  });

  // ============= EXAMPLE 11: SYSTEM HEALTH =============
  console.log('\n11. SYSTEM HEALTH CHECK\n');
  console.log('-'.repeat(80));

  const health = recommendationUtils.getSystemHealth();
  console.log('Timestamp:', health.timestamp);
  console.log('Configuration valid:', health.configValid ? '✓ YES' : '✗ NO');
  console.log('Performance status:', health.performanceStatus.toUpperCase());
  console.log('Average time per item:', health.benchmark.avgTimePerItem, 'ms');
  console.log('Items per second:', health.benchmark.itemsPerSecond);

  if (health.recommendations.length > 0) {
    console.log('\nSystem Recommendations:');
    health.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
  }

  // ============= EXAMPLE 12: RUN FULL TEST SUITE =============
  console.log('\n12. FULL TEST SUITE\n');
  console.log('-'.repeat(80));

  const testResults = await recommendationUtils.runTestSuite();
  
  console.log('Configuration test:', testResults.configuration.valid ? '✓ PASS' : '✗ FAIL');
  console.log('Scoring test:');
  console.log(`  - Job: ${testResults.testScoring.job?.finalScore || 'N/A'} / 100`);
  console.log(`  - Post: ${testResults.testScoring.post?.finalScore || 'N/A'} / 100`);
  console.log('Profile validation:', testResults.profileValidation.valid ? '✓ VALID' : '✗ INCOMPLETE');
  console.log('Content validation:');
  console.log(`  - Job: ${testResults.contentValidation.job.valid ? '✓ VALID' : '✗ INVALID'}`);
  console.log(`  - Post: ${testResults.contentValidation.post.valid ? '✓ VALID' : '✗ INVALID'}`);

  // ============= FINAL SUMMARY =============
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY COMPLETE');
  console.log('='.repeat(80));
  console.log('\nNext steps:');
  console.log('1. Review weight distribution and adjust as needed');
  console.log('2. Test with real user data from database');
  console.log('3. Monitor recommendation quality metrics');
  console.log('4. Gather user feedback and iterate');
  console.log('5. Plan ML integration for future scaling\n');
}

// Run examples
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = { runExamples };
