const StartupProfile = require('../models/startupprofile.model');
const StartupProfileView = require('../models/startupProfileView.model');
const User = require('../models/user.model');
const StartupVerification = require('../models/startupVerification.model');
const { cin_verification, gstin_verification } = require('../controller/startupVerification.controller');
const async_handler = require("express-async-handler");
const { PLAN_FEATURES, normalizePlanName } = require('../config/planFeatures');
const { calculate_eligibility_score, determine_eligibility_status } = require('../utils/eligibilityScoring');
const { createAndSendNotification } = require('../utils/notificationHelper');

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (forwardedFor || '').split(',')[0];

  const ip = (forwardedIp || req.ip || req.connection?.remoteAddress || '').toString().trim();
  return ip.replace(/^::ffff:/, '');
};

const buildSocialLinks = (socialLinks, linkedinUrl, twitterUrl, githubUrl) => {
  const merged = { ...(socialLinks || {}) };
  if (linkedinUrl) merged.linkedin = linkedinUrl;
  if (twitterUrl) merged.twitter = twitterUrl;
  if (githubUrl) merged.github = githubUrl;
  return Object.keys(merged).length ? merged : undefined;
};

const normalizeLocation = (location, city, country) => {
  if (location && typeof location === 'object') return location;
  if (typeof location === 'string') {
    const parts = location.split(',').map((part) => part.trim());
    const parsedCity = parts[0] || '';
    const parsedCountry = parts[1] || '';
    if (parsedCity || parsedCountry) return { city: parsedCity, country: parsedCountry };
  }
  if (city || country) return { city: city || '', country: country || '' };
  return undefined;
};

const notifyIncubatorAdminsForClaim = async ({ incubatorId, startupName, startupProfileId }) => {
  if (!incubatorId) return;

  try {
    const incubatorAdmins = await User.find({ incubatorId, role: 'incubator_admin' }).select('_id');
    for (const admin of incubatorAdmins) {
      await createAndSendNotification(
        admin._id,
        'New Startup Affiliation Claim',
        `Startup "${startupName}" has claimed affiliation with your incubator and is awaiting your verification.`,
        'info',
        startupProfileId
      );
    }
  } catch (notifyErr) {
    console.error('Failed to notify incubator admins for startup claim:', notifyErr);
  }
};

const createProfile = async_handler(async (req, res) => {
  try {
    // prefer authenticated user id when available
    const bodyUserId = req.body.userId;
    const authUserId = req.user?.id;
    if (authUserId && bodyUserId && authUserId !== bodyUserId) {
      return res.status(403).json({ success: false, error: 'Cannot create a profile for another user' });
    }

    const userId = authUserId || bodyUserId;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

    const {
      startupName,
      tagline,
      description, // legacy alias for aboutus
      aboutus,
      industry,
      stage,
      profilepic,
      numberOfEmployees,
      productOrService,
      cultureAndValues,
      website,
      socialLinks,
      foundedYear,
      teamSize,
      location,
      hiring,
      linkedinUrl,
      twitterUrl,
      githubUrl,
      city,
      country,
      leadershipTeam,
      companyType,
      brandName,
      registeredCity,
      registeredState,
      cin,
      llpin,
      gstNumber,
      udyamNumber,
      startupIndiaId,
      founderPhone,
      founderEmail,
      // Eligibility Fields
      legally_registered,
      registration_type,
      year_of_incorporation,
      team_size_range,
      primary_business_model,
      owns_proprietary_product,
      product_url,
      revenue_model,
      primarily_service_based,
      product_description,
      // Incubation Fields
      incubator,
      incubatorId,
      incubator_claimed
    } = req.body;

    if (!startupName) return res.status(400).json({ success: false, error: 'startupName is required' });

    // Ensure user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const resolvedSocialLinks = buildSocialLinks(socialLinks, linkedinUrl, twitterUrl, githubUrl);
    const resolvedLocation = normalizeLocation(location, city, country);
    console.log(incubatorId);
    const startupParams = {
      legally_registered,
      registration_type,
      year_of_incorporation: year_of_incorporation || foundedYear,
      team_size_range,
      primary_business_model,
      owns_proprietary_product,
      product_url,
      revenue_model,
      primarily_service_based,
      product_description: product_description || productOrService
    };
    
    const eligibility_score = calculate_eligibility_score(startupParams);
    const eligibility_status = determine_eligibility_status(eligibility_score);

    console.log("--- STARTUP VERIFICATION DEBUG ---");
    console.log("Startup Params:", JSON.stringify(startupParams, null, 2));
    console.log("Calculated Eligibility Score:", eligibility_score);
    console.log("Determined Eligibility Status:", eligibility_status);
    console.log("----------------------------------");

    // Dynamic Approval Logic:
    // 1. If "Not Eligible" -> Auto Reject
    // 2. If "Eligible Startup" AND API Verified -> Auto Approve
    // 3. Otherwise (borderline score or not verified) -> Pending for Manual Review
    
    let final_approval_status = 'Pending';
    let apiVerified = false;
    let autoRejected = false;

    if (eligibility_status === 'Not Eligible') {
      final_approval_status = 'Rejected';
      autoRejected = true;
    } else {
      // Check API verification if not rejected
      if (cin) {
        try {
          const { cinVerified } = await cin_verification(cin);
          if (cinVerified) apiVerified = true;
        } catch (e) {
          console.error("CIN verification failed:", e);
        }
      }
      if (gstNumber && !apiVerified) {
        try {
          const { gstnVerified } = await gstin_verification(gstNumber);
          if (gstnVerified) apiVerified = true;
        } catch (e) {
            console.error("GST verification failed:", e);
        }
      }

      // AUTO-VERIFICATION LOGIC UPDATE:
      // If the startup is eligible based on score (>=6), we auto-approve.
      // API verification (CIN/GST) is preferred but we allow score-based approval if API fails/missing for MVP.
      if (eligibility_status === 'Eligible Startup') {
        final_approval_status = 'Approved';
        // If they provided valid docs, great. If not, we still approve based on high score.
        // apiVerified logic above acts as a secondary check or for future strict mode.
      } else {
        final_approval_status = 'Pending';
      }
    }

    const profile = new StartupProfile({
      userId,
      startupName,
      tagline,
      aboutus: aboutus || description,
      industry,
      stage,
      profilepic,
      numberOfEmployees,
      productOrService,
      cultureAndValues,
      website,
      socialLinks: resolvedSocialLinks,
      foundedYear,
      teamSize,
      location: resolvedLocation,
      hiring,
      leadershipTeam,
      ...startupParams,
      eligibility_score,
      eligibility_status,
      approval_status: final_approval_status,
      incubatorId: incubatorId || null,
      incubator: incubator || undefined,
      incubator_claimed: !!incubator_claimed || !!incubator || !!incubatorId
    });
    await profile.save();

    if (profile.incubatorId) {
      await notifyIncubatorAdminsForClaim({
        incubatorId: profile.incubatorId,
        startupName: profile.startupName,
        startupProfileId: profile._id
      });
    }

    user.profileCompleted = true;
    await user.save();

    // Auto-update/create verification record
    try {
      const existingVerification = await StartupVerification.findOne({ userId });
      
      const verificationUpdate = {
        userId,
        companyName: startupName,
        website: website || '',
        brandName: brandName || startupName,
        companyType,
        registeredCity: registeredCity || city,
        registeredState: registeredState || undefined, 
        cin,
        llpin,
        gstNumber,
        udyamNumber,
        startupIndiaId,
        founderName: req.user?.username || req.user?.name || "Startup Founder", 
        founderEmail: founderEmail || req.user?.email,
        founderPhone,
        status: autoRejected ? 'rejected' : (apiVerified ? 'verified' : 'pending'),
        rejectionReason: autoRejected ? 'Startup does not meet minimum eligibility criteria.' : undefined
      };

      if (!existingVerification) {
        await StartupVerification.create(verificationUpdate);
      } else {
        await StartupVerification.findOneAndUpdate({ userId }, verificationUpdate);
      }
    } catch (verError) {
      console.error("Error auto-submitting verification:", verError);
    }

    return res.status(201).json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

const getProfiles = async_handler(async (req, res) => {
  try {
    const profiles = await StartupProfile.find().populate('userId', 'name email');
    return res.json({ success: true, data: profiles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const getProfileById = async_handler(async (req, res) => {
  try {
    let profile;
    // support 'me' shortcut
    if (req.params.id === 'me') {
      profile = await StartupProfile.findOne({ userId: req.user.id }).populate('userId', 'name email');
    } else {
      profile = await StartupProfile.findById(req.params.id).populate('userId', 'name email');
    }

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    // Handle subscription expiration
    if (profile.subscriptionStatus !== "EXPIRED" && profile.subscriptionEndDate && new Date() > profile.subscriptionEndDate) {
      profile.subscriptionStatus = "EXPIRED";
      profile.subscriptionPlan = "FREE";
      await profile.save();
    }

    // Increment profile views only once per viewer IP (unique views)
    // for any public profile request (non-/me).
    if (req.params.id !== 'me') {
      const viewerIp = getClientIp(req);
      if (viewerIp) {
        const existingView = await StartupProfileView.findOne({
          startupProfile: profile._id,
          viewerIp,
        });

        if (!existingView) {
          await StartupProfileView.create({
            startupProfile: profile._id,
            viewerIp,
          });

          profile.views = (profile.views || 0) + 1;
          await profile.save();
        }
      }
    }

    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const updateProfile = async_handler(async (req, res) => {
  try {
    // whitelist allowed fields
    const allowed = [
      'startupName',
      'tagline',
      'aboutus',
      'productOrService',
      'cultureAndValues',
      'industry',
      'stage',
      'website',
      'socialLinks',
      'profilepic',
      'numberOfEmployees',
      'foundedYear',
      'teamSize',
      'location',
      'hiring',
      'verified',
      'leadershipTeam',
      // Eligibility Fields
      'legally_registered',
      'registration_type',
      'year_of_incorporation',
      'team_size_range',
      'primary_business_model',
      'owns_proprietary_product',
      'product_url',
      'revenue_model',
      'primarily_service_based',
      'product_description',
      // Incubation
      'incubatorId',
      'incubator',
      'incubator_claimed'
    ];

    const updates = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (allowed.includes(k)) updates[k] = req.body[k];
      // allow 'description' to update 'aboutus'
      if (k === 'description') updates.aboutus = req.body[k];
    });

    if (req.body.aboutus) updates.aboutus = req.body.aboutus;
    if (req.body.socialLinks) updates.socialLinks = req.body.socialLinks;

    const legacySocialLinks = buildSocialLinks(undefined, req.body.linkedinUrl, req.body.twitterUrl, req.body.githubUrl);
    if (legacySocialLinks) {
      updates.socialLinks = { ...(updates.socialLinks || {}), ...legacySocialLinks };
    }

    const resolvedLocation = normalizeLocation(req.body.location, req.body.city, req.body.country);
    if (resolvedLocation) updates.location = resolvedLocation;

    let profile;
    const userId = req.user.id;
    
    console.log("updateProfile called for ID:", req.params.id);
    console.log("Request Body Keys:", Object.keys(req.body));
    console.log("Incubator Data in Body:", {
        incubatorId: req.body.incubatorId,
        incubator: req.body.incubator,
        incubator_claimed: req.body.incubator_claimed
    });

    // fetch existing to recalculate score
    if (req.params.id === 'me') {
      profile = await StartupProfile.findOne({ userId });
    } else {
      profile = await StartupProfile.findById(req.params.id);
    }

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const normalizedPlan = normalizePlanName(profile.subscriptionPlan) || 'FREE';
    if (normalizedPlan !== profile.subscriptionPlan) {
      profile.subscriptionPlan = normalizedPlan;
    }

    const previousIncubatorId = profile.incubatorId ? profile.incubatorId.toString() : null;

    Object.assign(profile, updates);

    // Dynamic Re-Approval Logic on Update:
    // 1. Recalculate score
    profile.eligibility_score = calculate_eligibility_score(profile);
    profile.eligibility_status = determine_eligibility_status(profile.eligibility_score);

    console.log("--- STARTUP VERIFICATION DEBUG (UPDATE) ---");
    console.log("Calculated Eligibility Score:", profile.eligibility_score);
    console.log("Determined Eligibility Status:", profile.eligibility_status);
    console.log("-------------------------------------------");

    // Determine updated approval status
    let final_approval_status = profile.approval_status;
    let apiVerified = false;
    let autoRejected = false;

    if (profile.eligibility_status === 'Not Eligible') {
      final_approval_status = 'Rejected';
      autoRejected = true;
    } else {
      // Check API verification if not rejected
      const cin = req.body.cin || profile.cin;
      const gstNumber = req.body.gstNumber || profile.gstNumber;

      if (cin) {
        const { cinVerified } = await cin_verification(cin);
        if (cinVerified) apiVerified = true;
      }
      if (gstNumber && !apiVerified) {
        const { gstin_verification } = require('../controller/startupVerification.controller.js');
        const { gstnVerified } = await gstin_verification(gstNumber);
        if (gstnVerified) apiVerified = true;
      }

      // AUTO-VERIFICATION LOGIC UPDATE (MATCHING CREATE PROFILE):
      // If score is high enough (Eligible Startup), we auto-approve regardless of API verification for MVP.
      if (profile.eligibility_status === 'Eligible Startup') {
        final_approval_status = 'Approved';
      } else if (final_approval_status === 'Rejected' && profile.eligibility_status !== 'Not Eligible') {
        // If it was rejected but now has better score, move to pending
        final_approval_status = 'Pending';
      }
    }

    profile.approval_status = final_approval_status;
    await profile.save();

    const currentIncubatorId = profile.incubatorId ? profile.incubatorId.toString() : null;
    const incubatorChanged = currentIncubatorId && currentIncubatorId !== previousIncubatorId;
    if (incubatorChanged || (req.body.incubatorId && currentIncubatorId)) {
      await notifyIncubatorAdminsForClaim({
        incubatorId: profile.incubatorId,
        startupName: profile.startupName,
        startupProfileId: profile._id
      });
    }

    // Handle verification updates
    try {
      const { 
        brandName, companyType, registeredCity, registeredState, cin, gstNumber, llpin, udyamNumber, startupIndiaId, founderPhone, founderEmail 
      } = req.body;

      // Extract verification-related fields
      const verificationUpdate = {
        companyName: req.body.startupName || profile.startupName,
        website: req.body.website || profile.website,
        status: autoRejected ? 'rejected' : ((final_approval_status === 'Approved') ? 'verified' : 'pending'),
        rejectionReason: autoRejected ? 'Startup does not meet minimum eligibility criteria.' : undefined
      };

      if (brandName) verificationUpdate.brandName = brandName;
      if (companyType) verificationUpdate.companyType = companyType;
      if (registeredCity) verificationUpdate.registeredCity = registeredCity;
      if (registeredState) verificationUpdate.registeredState = registeredState;
      if (cin) verificationUpdate.cin = cin;
      if (llpin) verificationUpdate.llpin = llpin;
      if (gstNumber) verificationUpdate.gstNumber = gstNumber;
      if (udyamNumber) verificationUpdate.udyamNumber = udyamNumber;
      if (startupIndiaId) verificationUpdate.startupIndiaId = startupIndiaId;
      if (founderPhone) verificationUpdate.founderPhone = founderPhone;
      if (founderEmail) verificationUpdate.founderEmail = founderEmail;

      const existingVer = await StartupVerification.findOne({ userId });
      
      if (existingVer) {
         await StartupVerification.findOneAndUpdate({ userId }, verificationUpdate);
      } else {
         verificationUpdate.userId = userId;
         verificationUpdate.founderName = req.user?.username || req.user?.name || "Startup Founder";
         await StartupVerification.create(verificationUpdate);
      }
    } catch (verError) {
      console.error("Error updating verification details:", verError);
    }

    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

const deleteProfile = async_handler(async (req, res) => {
  try {
    if (req.params.id === 'me') {
      const profile = await StartupProfile.findOneAndDelete({ userId: req.user.id });
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const profile = await StartupProfile.findByIdAndDelete(req.params.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const selectPlan = async_handler(async (req, res) => {
  const { plan } = req.body;
  if (!plan) return res.status(400).json({ success: false, error: 'Plan name is required' });

  const normalizedPlan = normalizePlanName(plan);

  if (!normalizedPlan) {
    return res.status(400).json({ success: false, error: 'Invalid plan selected' });
  }

  try {
    const profile = await StartupProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        error: 'Profile not found. Please create profile first.',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    profile.subscriptionPlan = normalizedPlan;
    profile.subscriptionStatus = 'ACTIVE';
    
    const planConfig = PLAN_FEATURES[normalizedPlan] || {};
    const durationInMonths = planConfig.durationMonths;
    if (durationInMonths) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + durationInMonths);
      profile.subscriptionEndDate = expiry;
    } else {
      profile.subscriptionEndDate = null;
    }

    await profile.save();

    return res.json({ 
      success: true, 
      message: `Successfully switched to ${planConfig.displayName || normalizedPlan} plan`,
      data: {
        plan: profile.subscriptionPlan,
        status: profile.subscriptionStatus,
        expiry: profile.subscriptionEndDate
      } 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error while selecting plan' });
  }
});

const adminReviewProfile = async_handler(async (req, res) => {
  try {
    const { approval_status, eligibility_status, incubator_verified, verified } = req.body;
    let updates = {};

    if (approval_status !== undefined) updates.approval_status = approval_status;
    if (eligibility_status !== undefined) {
        updates.eligibility_status = eligibility_status;
        console.log(`[ADMIN OVERRIDE] Admin updated eligibility_status of startup ${req.params.id} to ${eligibility_status}`);
    }
    if (incubator_verified !== undefined) {
        updates.incubator_verified = incubator_verified;
        updates.incubator_verified_at = incubator_verified ? new Date() : null;
        console.log(`[ADMIN REVIEW] Admin marked incubator_verified=${incubator_verified} for startup ${req.params.id}`);
    }
    if (verified !== undefined) updates.verified = verified;

    const profile = await StartupProfile.findByIdAndUpdate(req.params.id, updates, { new: true });
    
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    res.json({ success: true, startup: profile });
  } catch(error) {
    console.error("Admin review error:", error);
    res.status(500).json({ success: false, error: 'Server error during admin review' });
  }
});

module.exports = {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
  selectPlan,
  adminReviewProfile
};
