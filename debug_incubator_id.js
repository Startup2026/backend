const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const StartupProfile = require('./models/startupprofile.model');
const Incubator = require('./models/incubator.model'); // If needed

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const run = async () => {
    await connectDB();

    // Check the latest startup profile
    const profile = await StartupProfile.findOne().sort({ createdAt: -1 });
    if (!profile) {
        console.log("No startup profiles found.");
    } else {
        console.log("Latest Startup Profile:");
        console.log(JSON.stringify(profile, null, 2));
        console.log(`incubatorId on profile: ${profile.incubatorId}`);
        console.log(`incubator_claimed on profile: ${profile.incubator_claimed}`);

        if (profile.incubatorId) {
            const incubator = await mongoose.model('Incubator').findById(profile.incubatorId);
            if (incubator) {
                console.log(`Incubator valid: ${incubator.name}`);
            } else {
                console.log(`Incubator ID ${profile.incubatorId} does not point to a valid incubator.`);
            }
        }
    }
    
    // Check total count of profiles with non-null incubatorId
    const count = await StartupProfile.countDocuments({ incubatorId: { $ne: null } });
    console.log(`Number of startup profiles with valid incubatorId: ${count}`);

    // List all incubators
    const incubators = await mongoose.model('Incubator').find({ isActive: true }).select('name _id');
    console.log("Available Incubators:");
    incubators.forEach(inc => console.log(`${inc.name}: ${inc._id}`));

    process.exit();
};

run();
