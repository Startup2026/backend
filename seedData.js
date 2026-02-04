    /**
 * Seed Database with Test Data
 * Generates 50 student users with profiles and 50 startup users with profiles
 * Run: node seedData.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
require('dotenv').config();

// Import models
const User = require('./models/user.model');
const StudentProfile = require('./models/studentprofile.model');
const StartupProfile = require('./models/startupprofile.model');

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://Sanchit:1234@cluster0.jano3fg.mongodb.net/Backend');
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Skills and interests for students
const skillsList = [
  'JavaScript', 'Python', 'React', 'Node.js', 'MongoDB', 'Express',
  'TypeScript', 'Vue.js', 'Angular', 'Java', 'C++', 'SQL',
  'Docker', 'AWS', 'Git', 'REST API', 'GraphQL', 'Machine Learning',
  'Data Analysis', 'UI/UX Design', 'Product Management', 'DevOps'
];

const interestsList = [
  'Web Development', 'Mobile Development', 'Data Science', 'AI/ML',
  'Cloud Computing', 'Cybersecurity', 'FinTech', 'EdTech',
  'HealthTech', 'E-Commerce', 'Startups', 'Technology'
];

const industries = [
  'FinTech', 'EdTech', 'HealthTech', 'AI/ML', 'SaaS',
  'E-Commerce', 'Web3', 'Other'
];

const stages = ['Idea', 'MVP', 'Early Traction', 'Growth', 'Scaling'];

const locations = [
  { city: 'San Francisco', country: 'USA' },
  { city: 'New York', country: 'USA' },
  { city: 'Los Angeles', country: 'USA' },
  { city: 'Seattle', country: 'USA' },
  { city: 'Austin', country: 'USA' },
  { city: 'Boston', country: 'USA' },
  { city: 'London', country: 'UK' },
  { city: 'Berlin', country: 'Germany' },
  { city: 'Singapore', country: 'Singapore' },
  { city: 'Bangalore', country: 'India' },
  { city: 'Mumbai', country: 'India' },
  { city: 'Delhi', country: 'India' }
];

/**
 * Generate random skills
 */
const getRandomSkills = () => {
  const shuffled = [...skillsList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, faker.number.int({ min: 3, max: 8 }));
};

/**
 * Generate random interests
 */
const getRandomInterests = () => {
  const shuffled = [...interestsList].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, faker.number.int({ min: 2, max: 5 }));
};

/**
 * Generate random location
 */
const getRandomLocation = () => {
  return locations[Math.floor(Math.random() * locations.length)];
};

/**
 * Create student users and profiles
 */
const createStudents = async () => {
  console.log('\n📚 Creating 50 Student Users and Profiles...');
  
  const students = [];
  
  for (let i = 0; i < 50; i++) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // Create user
      const userEmail = `student${i + 1}@example.com`;
      const user = await User.create({
        username: `student_${i + 1}`,
        email: userEmail,
        password: hashedPassword,
        role: 'student',
        profileCompleted: true
      });
      
      // Create student profile
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const location = getRandomLocation();
      
      const studentProfile = await StudentProfile.create({
        userId: user._id,
        firstName,
        lastName,
        email: userEmail,
        phone: "8010238743",
        location: `${location.city}, ${location.country}`,
        bio: faker.lorem.sentence(),
        skills: getRandomSkills(),
        interests: getRandomInterests(),
        githubUrl: `https://github.com/${firstName.toLowerCase()}${i}`,
        linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
        education: [
          {
            institution: faker.company.name() + ' University',
            degree: 'Bachelor',
            field: faker.commerce.department(),
            startYear: String(new Date().getFullYear() - 4),
            endYear: String(new Date().getFullYear())
          }
        ],
        experience: [
          {
            title: faker.person.jobTitle(),
            company: faker.company.name(),
            duration: `${faker.number.int({ min: 1, max: 3 })} years`
          }
        ]
      });
      
      students.push(studentProfile);
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ Created ${i + 1}/50 students`);
      }
    } catch (error) {
      console.error(`  ✗ Error creating student ${i + 1}:`, error.message);
    }
  }
  
  console.log(`✓ Successfully created ${students.length}/50 students`);
  return students;
};

/**
 * Create startup users and profiles
 */
const createStartups = async () => {
  console.log('\n🚀 Creating 50 Startup Users and Profiles...');
  
  const startups = [];
  
  for (let i = 0; i < 50; i++) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // Create user
      const userEmail = `startup${i + 1}@example.com`;
      const user = await User.create({
        username: `startup_${i + 1}`,
        email: userEmail,
        password: hashedPassword,
        role: 'startup',
        profileCompleted: true
      });
      
      // Create startup profile
      const startupName = faker.company.name();
      const location = getRandomLocation();
      
      const startupProfile = await StartupProfile.create({
        userId: user._id,
        startupName,
        numberOfEmployees: faker.number.int({ min: 5, max: 200 }),
        tagline: faker.lorem.sentence(),
        aboutus: faker.lorem.paragraphs(2),
        productOrService: faker.lorem.paragraph(),
        cultureAndValues: faker.lorem.paragraph(),
        industry: industries[Math.floor(Math.random() * industries.length)],
        stage: stages[Math.floor(Math.random() * stages.length)],
        website: `https://${startupName.toLowerCase().replace(/\s+/g, '')}.com`,
        socialLinks: {
          linkedin: `https://linkedin.com/company/${startupName.toLowerCase()}`,
          twitter: `https://twitter.com/${startupName.toLowerCase()}`,
          github: `https://github.com/${startupName.toLowerCase()}`
        },
        foundedYear: faker.number.int({ min: 2015, max: new Date().getFullYear() }),
        teamSize: faker.number.int({ min: 5, max: 50 }),
        location: {
          city: location.city,
          country: location.country
        },
        hiring: Math.random() > 0.5,
        verified: Math.random() > 0.7
      });
      
      startups.push(startupProfile);
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ Created ${i + 1}/50 startups`);
      }
    } catch (error) {
      console.error(`  ✗ Error creating startup ${i + 1}:`, error.message);
    }
  }
  
  console.log(`✓ Successfully created ${startups.length}/50 startups`);
  return startups;
};

/**
 * Clear existing data
 */
const clearDatabase = async () => {
  console.log('\n🗑️  Clearing existing data...');
  try {
    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await StartupProfile.deleteMany({});
    console.log('✓ Database cleared');
  } catch (error) {
    console.error('✗ Error clearing database:', error.message);
  }
};

/**
 * Main seed function
 */
const seedDatabase = async () => {
  try {
    console.log('\n================================================================================');
    console.log('DATABASE SEEDING - GENERATING TEST DATA');
    console.log('================================================================================');
    
    await connectDB();
    await clearDatabase();
    
    const students = await createStudents();
    const startups = await createStartups();
    
    console.log('\n================================================================================');
    console.log('✓ DATA SEEDING COMPLETE');
    console.log('================================================================================');
    console.log(`Total Students Created: ${students.length}`);
    console.log(`Total Startups Created: ${startups.length}`);
    console.log(`Total Users Created: ${students.length + startups.length}`);
    console.log('\nTest Credentials:');
    console.log('  Student: student1@example.com / password123');
    console.log('  Startup: startup1@example.com / password123');
    console.log('================================================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding Error:', error);
    process.exit(1);
  }
};

// Run seeding
seedDatabase();
