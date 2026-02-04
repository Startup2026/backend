/**
 * Seed Posts and Jobs
 * Creates 100 posts (50 from each startup) and 100 jobs (50 from each startup)
 * Run: node seedPostsJobs.js
 */

const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

// Import models
const Post = require('./models/post.model');
const Job = require('./models/job.model');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/backend_startup');
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Startup IDs
const STARTUP_IDS = {
  startup1: '696cad1289c11a641fc9f7aa',
  startup2: '696cad1389c11a641fc9f7ae'
};

// Job roles
const jobRoles = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'DevOps Engineer',
  'Product Manager',
  'UI/UX Designer',
  'Mobile Developer',
  'Machine Learning Engineer',
  'Cloud Architect',
  'Security Engineer',
  'Software Engineer'
];

// Post titles
const postTitles = [
  'Excited to announce our Series A funding!',
  'New product launch coming soon',
  'Join our growing engineering team',
  'Tips for building scalable systems',
  'Our journey to 1M users',
  'Celebrating our company milestone',
  'New internship opportunities available',
  'Behind the scenes at our office',
  'Technology trends in 2026',
  'Innovation in our industry',
  'Building the future of startups',
  'Our company culture and values'
];

/**
 * Create posts
 */
const createPosts = async () => {
  console.log('\n📝 Creating 100 Posts...');
  
  let createdCount = 0;
  
  // Create 50 posts for startup 1
  for (let i = 0; i < 50; i++) {
    try {
      await Post.create({
        startupid: STARTUP_IDS.startup1,
        title: postTitles[Math.floor(Math.random() * postTitles.length)],
        description: faker.lorem.paragraphs(Math.floor(Math.random() * 3) + 1),
        media: {
          photo: `https://via.placeholder.com/400x300?text=Post${i + 1}`,
          video: null
        },
        likes: faker.number.int({ min: 0, max: 500 })
      });
      createdCount++;
    } catch (error) {
      console.error(`  ✗ Error creating post ${i + 1}:`, error.message);
    }
  }
  
  // Create 50 posts for startup 2
  for (let i = 0; i < 50; i++) {
    try {
      await Post.create({
        startupid: STARTUP_IDS.startup2,
        title: postTitles[Math.floor(Math.random() * postTitles.length)],
        description: faker.lorem.paragraphs(Math.floor(Math.random() * 3) + 1),
        media: {
          photo: `https://via.placeholder.com/400x300?text=Post${i + 51}`,
          video: null
        },
        likes: faker.number.int({ min: 0, max: 500 })
      });
      createdCount++;
    } catch (error) {
      console.error(`  ✗ Error creating post:`, error.message);
    }
  }
  
  console.log(`✓ Successfully created ${createdCount}/100 posts`);
  return createdCount;
};

/**
 * Create jobs
 */
const createJobs = async () => {
  console.log('\n💼 Creating 100 Job Posts...');
  
  let createdCount = 0;
  
  // Create 50 jobs for startup 1
  for (let i = 0; i < 50; i++) {
    try {
      const role = jobRoles[Math.floor(Math.random() * jobRoles.length)];
      const deadline = new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000);
      
      await Job.create({
        startupId: STARTUP_IDS.startup1,
        role,
        aboutRole: faker.lorem.paragraph(),
        keyResponsibilities: faker.lorem.paragraphs(2),
        requirements: faker.lorem.paragraphs(2),
        perksAndBenifits: faker.lorem.paragraphs(1),
        stipend: Math.random() > 0.5,
        salary: faker.number.int({ min: 30000, max: 150000 }),
        openings: faker.number.int({ min: 1, max: 5 }),
        deadline: deadline.toISOString().split('T')[0]
      });
      createdCount++;
    } catch (error) {
      console.error(`  ✗ Error creating job ${i + 1}:`, error.message);
    }
  }
  
  // Create 50 jobs for startup 2
  for (let i = 0; i < 50; i++) {
    try {
      const role = jobRoles[Math.floor(Math.random() * jobRoles.length)];
      const deadline = new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000);
      
      await Job.create({
        startupId: STARTUP_IDS.startup2,
        role,
        aboutRole: faker.lorem.paragraph(),
        keyResponsibilities: faker.lorem.paragraphs(2),
        requirements: faker.lorem.paragraphs(2),
        perksAndBenifits: faker.lorem.paragraphs(1),
        stipend: Math.random() > 0.5,
        salary: faker.number.int({ min: 30000, max: 150000 }),
        openings: faker.number.int({ min: 1, max: 5 }),
        deadline: deadline.toISOString().split('T')[0]
      });
      createdCount++;
    } catch (error) {
      console.error(`  ✗ Error creating job:`, error.message);
    }
  }
  
  console.log(`✓ Successfully created ${createdCount}/100 jobs`);
  return createdCount;
};

/**
 * Main seed function
 */
const seedPostsJobs = async () => {
  try {
    console.log('\n================================================================================');
    console.log('SEEDING POSTS AND JOBS');
    console.log('================================================================================');
    
    await connectDB();
    
    const postsCreated = await createPosts();
    const jobsCreated = await createJobs();
    
    console.log('\n================================================================================');
    console.log('✓ POSTS & JOBS SEEDING COMPLETE');
    console.log('================================================================================');
    console.log(`Total Posts Created: ${postsCreated}`);
    console.log(`Total Jobs Created: ${jobsCreated}`);
    console.log(`Total Content: ${postsCreated + jobsCreated}`);
    console.log('\nBreakdown:');
    console.log(`  Startup 1 (696cad1289c11a641fc9f7aa): 50 posts + 50 jobs = 100 items`);
    console.log(`  Startup 2 (696cad1389c11a641fc9f7ae): 50 posts + 50 jobs = 100 items`);
    console.log('================================================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding Error:', error);
    process.exit(1);
  }
};

// Run seeding
seedPostsJobs();
