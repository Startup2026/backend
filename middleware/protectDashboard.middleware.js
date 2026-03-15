const StartupProfile = require('../models/startupprofile.model');
const StartupVerification = require('../models/startupVerification.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");

const protectStartupDashboard = async_handler(async (req, res, next) => {
    // 1. Skip if not a startup user (admins are exempted)
    if (!req.user || (req.user.role !== 'startup' && req.user.role !== 'startup_admin')) {
        return next();
    }

    const userId = req.user.id;

    // 2. Check Email Verification (User model isVerified)
    const user = await User.findById(userId);
    if (!user || user.isVerified === false) {
        return res.status(403).json({
            success: false,
            error: 'Email not verified',
            code: 'EMAIL_UNVERIFIED'
        });
    }

    // 3. Check Profile & Payment
    const profile = await StartupProfile.findOne({ userId });
    
    // If no profile, they must complete it
    if (!profile) {
        return res.status(403).json({
            success: false,
            error: 'Profile incomplete',
            code: 'PROFILE_INCOMPLETE'
        });
    }

    // Check Payment (Subscription Plan)
    // Only allow dashboard if plan is NOT FREE
    if (!profile.subscriptionPlan || profile.subscriptionPlan === 'FREE') {
        return res.status(403).json({
            success: false,
            error: 'Payment required',
            code: 'PAYMENT_REQUIRED'
        });
    }

    // 4. Check Company Verification Status
    // Startup can proceed only when backend thresholding marks profile as Approved.
    if (profile.approval_status !== 'Approved') {
        return res.status(403).json({
            success: false,
            error: 'Startup approval pending or rejected',
            code: 'STARTUP_NOT_APPROVED',
            approval_status: profile.approval_status,
            eligibility_status: profile.eligibility_status
        });
    }

    const verification = await StartupVerification.findOne({ userId });
    
    // If status is 'pending', 'unverified', or 'rejected', block dashboard
    // ALLOW dashboard if verification status is 'verified' (auto-approved) or 'approved' (manual-approved)
    const isValidVerification = verification && (
        verification.status === 'verified' || 
        verification.status === 'approved'
    );

    if (!isValidVerification) {
        console.log(`>>> [ProtectDashboard] Verification Blocked for User: ${userId}. Status: ${verification ? verification.status : 'missing'}`);
        return res.status(403).json({
            success: false,
            error: 'Company verification pending or rejected',
            code: 'VERIFICATION_REQUIRED',
            status: verification ? verification.status : 'not_submitted',
            // debug info
            verificationId: verification ? verification._id : null
        });
    }

    // All checks passed
    next();
});

module.exports = { protectStartupDashboard };
