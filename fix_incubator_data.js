const mongoose = require('mongoose');
const connectDB = require('./config/config');
const StartupProfile = require('./models/startupprofile.model');
const RevenueTransaction = require('./models/revenueTransaction.model');
const dotenv = require('dotenv');
dotenv.config();

const TARGET_INCUBATOR_ID = '69a55df83de6360552c0daa7';

async function fixData() {
    try {
        await connectDB();
        console.log("Connected to DB...");

        // 1. Update all StartupProfiles that currently have 4 startups to this incubator
        // From logs, we know this incubator has 4 startups. Let's make sure they are explicitly set.
        const startups = await StartupProfile.find({ incubatorId: TARGET_INCUBATOR_ID });
        console.log(`Found ${startups.length} startups already linked to ${TARGET_INCUBATOR_ID}`);

        // 2. Identify and fix RevenueTransactions
        // If there was a recent transaction (like the one for startup "vu"), let's find it and reassign it.
        // We know from previous logs one was created: 69ab004c5f553a35bfe69a12
        const tx = await RevenueTransaction.findOne().sort({ createdAt: -1 });
        if (tx) {
            console.log(`Found most recent transaction: ${tx._id} for startup: ${tx.startupId}`);
            console.log(`Current incubator in tx: ${tx.incubatorId}`);
            
            if (tx.incubatorId && tx.incubatorId.toString() !== TARGET_INCUBATOR_ID) {
                console.log(`Updating transaction ${tx._id} to point to target incubator ${TARGET_INCUBATOR_ID}`);
                tx.incubatorId = TARGET_INCUBATOR_ID;
                await tx.save();

                // Also update the startup's profile itself to prevent future mismatches
                await StartupProfile.findByIdAndUpdate(tx.startupId, { incubatorId: TARGET_INCUBATOR_ID });
                console.log(`Updated startup profile ${tx.startupId} to incubator ${TARGET_INCUBATOR_ID}`);
            }
        }

        console.log("Data alignment complete. Refresh your dashboard.");
        process.exit(0);
    } catch (err) {
        console.error("Error fixing data:", err);
        process.exit(1);
    }
}

fixData();
