const async_handler = require("express-async-handler");

const User = require('../models/user.model');

const isPlatformAdmin = async_handler(async (req, res, next) => {
    const roleFromToken = req.user?.role;
    if (['platform_admin', 'admin'].includes(roleFromToken)) {
        return next();
    }

    // Fallback for stale tokens: validate role from DB.
    if (req.user?.id) {
        const user = await User.findById(req.user.id).select('role');
        if (user && ['platform_admin', 'admin'].includes(user.role)) {
            req.user.role = user.role;
            return next();
        }
    }

    return res.status(403).json({ success: false, error: 'Access denied: Platform Admin privileges required.' });
});

const isIncubatorAdmin = async_handler(async (req, res, next) => {
    if (req.user && req.user.role === 'incubator_admin') {
        // If incubatorId is already in the token payload, proceed
        if (req.user.incubatorId) {
            return next();
        }

        // Fallback: Check database if token didn't have it (e.g. just created profile)
        const user = await User.findById(req.user.id).select('incubatorId');
        if (user && user.incubatorId) {
            req.user.incubatorId = user.incubatorId; // Hydrate request object
            return next();
        }
        
        return res.status(403).json({ success: false, error: 'Access denied: No incubator assigned to this admin.' });
    } else {
        return res.status(403).json({ success: false, error: 'Access denied: Incubator Admin privileges required.' });
    }
});

const isPlatformOrIncubatorAdmin = async_handler(async (req, res, next) => {
    const role = req.user?.role;
    if (['admin', 'platform_admin', 'incubator_admin'].includes(role)) {
        next();
    } else {
        return res.status(403).json({ success: false, error: 'Access denied: Admin privileges required.' });
    }
});


module.exports = {
    isPlatformAdmin,
    isIncubatorAdmin,
    isPlatformOrIncubatorAdmin
};
