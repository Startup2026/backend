const mongoose = require('mongoose');
const Incubator = require('./models/incubator.model');
require('dotenv').config();

const debug = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const all = await Incubator.find({});
        console.log('All Docs in Incubator Collection:', JSON.stringify(all, null, 2));
        
        const active = await Incubator.find({ isActive: true });
        console.log('Active Docs:', JSON.stringify(active, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
};
debug();
