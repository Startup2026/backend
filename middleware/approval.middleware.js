const StartupProfile = require('../models/startupprofile.model');
const async_handler = require("express-async-handler");

const checkStartupApproval = async_handler(async (req, res, next) => {
    // Only apply for startup users
    if (req.user && req.user.role === 'startup') {
        const profile = await StartupProfile.findOne({ userId: req.user.id });
        if (!profile || profile.approval_status !== 'Approved') {
            return res.status(403).json({
                success: false,
                error: 'Your startup profile must be approved before you can post jobs or content.'
            });
        }
    }
    next();
});

module.exports = { checkStartupApproval };
