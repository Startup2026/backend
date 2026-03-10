const Incubator = require('../models/incubator.model');
const async_handler = require("express-async-handler");

const listIncubators = async_handler(async (req, res) => {
    // Return a list of all active incubators for the startup form to select
    const incubators = await Incubator.find({ isActive: true }).select('name _id').sort({ name: 1 });
    res.json({ success: true, data: incubators });
});

// Assuming an incubator admin creates their profile
const createIncubatorProfile = async_handler(async (req, res) => {
    const { name, website } = req.body;
    
    // Check if user is an incubator admin
    if (req.user.role !== 'incubator_admin') {
        return res.status(403).json({ success: false, error: 'Only incubator admins can create an incubator profile.' });
    }

    if (!name) {
        return res.status(400).json({ success: false, error: 'Incubator name is required' });
    }

    const existing = await Incubator.findOne({ name });
    if (existing) {
        return res.status(400).json({ success: false, error: 'An incubator with this name already exists.' });
    }

    const incubator = new Incubator({
        name,
        website,
        isActive: true,
        revenue_share_percentage: 10 // defaults to 10
    });

    await incubator.save();

    // Assign this incubator to the currently logged in user
    const User = require('../models/user.model');
    await User.findByIdAndUpdate(req.user.id, {
        incubatorId: incubator._id,
        profileCompleted: true
    });

    res.status(201).json({ success: true, data: incubator });
});

module.exports = {
    listIncubators,
    createIncubatorProfile
};
