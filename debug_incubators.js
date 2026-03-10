const mongoose = require('mongoose');
const Incubator = require('./models/incubator.model');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://Sanchit:1234@cluster0.jano3fg.mongodb.net/Backend');
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('✗ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

const checkIncubators = async () => {
    await connectDB();
    const incubators = await Incubator.find({});
    console.log('All Incubators:', incubators);
    const activeIncubators = await Incubator.find({ isActive: true });
    console.log('Active Incubators:', activeIncubators);
    process.exit(0);
};

checkIncubators();
