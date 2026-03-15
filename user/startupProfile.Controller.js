const StartupProfile = require('../models/startupprofile.model');
const StartupProfileView = require('../models/startupProfileView.model');
const User = require('../models/user.model');
const StartupVerification = require('../models/startupVerification.model');
const { cin_verification, gstin_verification } = require('../controller/startupVerification.controller');
const async_handler = require("express-async-handler");
const { PLAN_FEATURES, normalizePlanName } = require('../config/planFeatures');
const { calculate_eligibility_score, determine_eligibility_status } = require('../utils/eligibilityScoring');
const { createAndSendNotification } = require('../utils/notificationHelper');
const { markIncubationInviteUsed, resolveIncubationInvite } = require('../utils/incubationCodeHelper');

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

const resolveVerificationType = (registrationType, companyType) => {
  const normalized = (registrationType || companyType || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ');
  if (/(private|pvt|public).*(limited|ltd)/.test(normalized) || /(limited|ltd).*(private|pvt|public)/.test(normalized)) return 'cin';
  if (normalized.includes('llp') || normalized.includes('limited liability partnership')) return 'llpin';
  return 'gstn';
};

const verifyLlpinFormat = (llpin) => {
  const value = (llpin || '').trim().toUpperCase();
  // LLPIN format is typically 3 letters + optional hyphen + 4 digits, e.g. AAA-1234.
  return /^[A-Z]{3}-?\d{4}$/.test(value);
};

const resolveApprovalByVerificationAndEligibility = async ({ cin, gstNumber, llpin, registration_type, companyType, eligibility_status }) => {
  const verificationType = resolveVerificationType(registration_type, companyType);
  const cinValue = (cin || '').trim();
  const gstValue = (gstNumber || '').trim();
  const llpinValue = (llpin || '').trim();

  let cinVerified = false;
  let gstnVerified = false;
  let llpinVerified = false;
  let verified = false;

  if (verificationType === 'cin') {
    if (!cinValue) {
      return {
        verificationType,
        cinVerified,
        gstnVerified,
        llpinVerified,
        verified,
        finalApprovalStatus: 'Rejected',
        autoRejected: true,
        rejectionReason: 'CIN is required for Private/Public Limited companies.',
      };
    }

    try {
      const cinResult = await cin_verification(cinValue);
      cinVerified = !!cinResult?.cinVerified;

      if (!cinVerified && cinResult?.explicitNegative) {
        return {
          verificationType,
          cinVerified,
          gstnVerified,
          llpinVerified,
          verified,
          finalApprovalStatus: 'Rejected',
          autoRejected: true,
          rejectionReason: 'CIN verification failed. Entry denied.',
        };
      }
    } catch (err) {
      console.error('CIN verification failed:', err);
    }

    verified = cinVerified;
  } else if (verificationType === 'llpin') {
    if (!llpinValue) {
      return {
        verificationType,
        cinVerified,
        gstnVerified,
        llpinVerified,
        verified,
        finalApprovalStatus: 'Rejected',
        autoRejected: true,
        rejectionReason: 'LLPIN is required for LLP companies.',
      };
    }

    llpinVerified = verifyLlpinFormat(llpinValue);
    verified = llpinVerified;
  } else {
    if (!gstValue) {
      return {
        verificationType,
        cinVerified,
        gstnVerified,
        llpinVerified,
        verified,
        finalApprovalStatus: 'Rejected',
        autoRejected: true,
        rejectionReason: 'GSTIN is required for this registration type.',
      };
    }

    try {
      const gstResult = await gstin_verification(gstValue);
      gstnVerified = !!gstResult?.gstnVerified;

      if (!gstnVerified && gstResult?.explicitNegative) {
        return {
          verificationType,
          cinVerified,
          gstnVerified,
          llpinVerified,
          verified,
          finalApprovalStatus: 'Rejected',
          autoRejected: true,
          rejectionReason: 'GSTIN verification failed. Entry denied.',
        };
      }
    } catch (err) {
      console.error('GST verification failed:', err);
    }

    verified = gstnVerified;
  }

  if (!verified) {
    return {
      verificationType,
      cinVerified,
      gstnVerified,
      llpinVerified,
      verified,
      finalApprovalStatus: 'Pending',
      autoRejected: false,
      rejectionReason: `${verificationType.toUpperCase()} verification is pending manual review.`,
    };
  }

  if (eligibility_status === 'Eligible Startup') {
    return {
      verificationType,
      cinVerified,
      gstnVerified,
      llpinVerified,
      verified,
      finalApprovalStatus: 'Approved',
      autoRejected: false,
      rejectionReason: undefined,
    };
  }

  if (eligibility_status === 'Needs Manual Review') {
    return {
      verificationType,
      cinVerified,
      gstnVerified,
      llpinVerified,
      verified,
      finalApprovalStatus: 'Pending',
      autoRejected: false,
      rejectionReason: undefined,
    };
  }

  return {
    verificationType,
    cinVerified,
    gstnVerified,
    llpinVerified,
    verified,
    finalApprovalStatus: 'Rejected',
    autoRejected: true,
    rejectionReason: 'Startup is verified but not eligible. Entry denied.',
  };
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

    const incubationInvite = await resolveIncubationInvite({
      incubationCode: req.body.incubationCode,
      userEmail: user.email,
      founderEmail,
    });

    const resolvedSocialLinks = buildSocialLinks(socialLinks, linkedinUrl, twitterUrl, githubUrl);
    const resolvedLocation = normalizeLocation(location, city, country);

    const resolvedIncubatorId = incubationInvite ? incubationInvite.incubatorId : (incubatorId || null);
    const resolvedIncubatorName = incubationInvite ? incubationInvite.incubatorName : (incubator || undefined);
    const resolvedIncubatorClaimed = incubationInvite ? true : (!!incubator_claimed || !!incubator || !!incubatorId);
    const resolvedIncubatorVerified = incubationInvite ? true : false;
    const resolvedIncubatorVerifiedAt = incubationInvite ? new Date() : undefined;

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

    const {
      verificationType,
      cinVerified,
      gstnVerified,
      llpinVerified,
      verified: apiVerified,
      finalApprovalStatus: final_approval_status,
      autoRejected,
      rejectionReason,
    } = await resolveApprovalByVerificationAndEligibility({
      cin,
      gstNumber,
      llpin,
      registration_type,
      companyType,
      eligibility_status,
    });

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
      cin,
      gstNumber,
      llpin,
      udyamNumber,
      startupIndiaId,
      founderPhone,
      founderEmail,
      ...startupParams,
      eligibility_score,
      eligibility_status,
      approval_status: final_approval_status,
      incubatorId: resolvedIncubatorId,
      incubator: resolvedIncubatorName,
      incubator_claimed: resolvedIncubatorClaimed,
      incubator_verified: resolvedIncubatorVerified,
      incubator_verified_at: resolvedIncubatorVerifiedAt,
      incubationCodeId: incubationInvite ? incubationInvite.invitation._id : null,
      incubationCodeUsedAt: incubationInvite ? new Date() : null
    });
    await profile.save();

    if (incubationInvite) {
      await markIncubationInviteUsed({
        invitation: incubationInvite.invitation,
        startupId: profile._id,
        userId,
      });
    }

    if (profile.incubatorId && !profile.incubator_verified) {
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
        status: final_approval_status === 'Approved' ? 'verified' : (autoRejected ? 'rejected' : 'pending'),
        cinVerified,
        gstnVerified,
        llpinVerified,
        verificationType,
        rejectionReason
      };

      if (!existingVerification) {
        await StartupVerification.create(verificationUpdate);
      } else {
        await StartupVerification.findOneAndUpdate({ userId }, verificationUpdate);
      }
    } catch (verError) {
      console.error("Error auto-submitting verification:", verError);
    }

    if (autoRejected) {
      return res.status(201).json({
        success: true,
        warning: rejectionReason,
        code: 'STARTUP_VERIFICATION_FAILED',
        data: profile,
      });
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
      profile = await StartupProfile.findOne({ userId: req.user.id })
        .populate('userId', 'name email')
        .populate('incubatorId', 'name');
    } else {
      profile = await StartupProfile.findById(req.params.id)
        .populate('userId', 'name email')
        .populate('incubatorId', 'name');
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
      'cin',
      'gstNumber',
      'llpin',
      'udyamNumber',
      'startupIndiaId',
      'founderPhone',
      'founderEmail',
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

    const authUser = await User.findById(userId).select('email');
    const incubationInvite = await resolveIncubationInvite({
      incubationCode: req.body.incubationCode,
      userEmail: authUser?.email,
      founderEmail: req.body.founderEmail,
      currentStartupId: profile._id,
      currentIncubatorId: previousIncubatorId,
    });

    Object.assign(profile, updates);

    if (incubationInvite) {
      profile.incubatorId = incubationInvite.incubatorId;
      profile.incubator = incubationInvite.incubatorName || profile.incubator;
      profile.incubator_claimed = true;
      profile.incubator_verified = true;
      profile.incubator_verified_at = profile.incubator_verified_at || new Date();
      profile.incubationCodeId = incubationInvite.invitation._id;
      profile.incubationCodeUsedAt = profile.incubationCodeUsedAt || new Date();
    }

    // Dynamic Re-Approval Logic on Update:
    // 1. Recalculate score
    profile.eligibility_score = calculate_eligibility_score(profile);
    profile.eligibility_status = determine_eligibility_status(profile.eligibility_score);

    console.log("--- STARTUP VERIFICATION DEBUG (UPDATE) ---");
    console.log("Calculated Eligibility Score:", profile.eligibility_score);
    console.log("Determined Eligibility Status:", profile.eligibility_status);
    console.log("-------------------------------------------");

    const verificationCin = req.body.cin || profile.cin;
    const verificationGstNumber = req.body.gstNumber || profile.gstNumber;
    const verificationLlpin = req.body.llpin || profile.llpin;
    const verificationRegistrationType = req.body.registration_type || profile.registration_type;
    const verificationCompanyType = req.body.companyType || profile.companyType;
    const {
      verificationType,
      cinVerified,
      gstnVerified,
      llpinVerified,
      finalApprovalStatus: final_approval_status,
      autoRejected,
      rejectionReason,
    } = await resolveApprovalByVerificationAndEligibility({
      cin: verificationCin,
      gstNumber: verificationGstNumber,
      llpin: verificationLlpin,
      registration_type: verificationRegistrationType,
      companyType: verificationCompanyType,
      eligibility_status: profile.eligibility_status,
    });

    profile.approval_status = final_approval_status;
    await profile.save();

    if (incubationInvite) {
      await markIncubationInviteUsed({
        invitation: incubationInvite.invitation,
        startupId: profile._id,
        userId,
      });
    }

    const currentIncubatorId = profile.incubatorId ? profile.incubatorId.toString() : null;
    const incubatorChanged = currentIncubatorId && currentIncubatorId !== previousIncubatorId;
    if (!profile.incubator_verified && (incubatorChanged || (req.body.incubatorId && currentIncubatorId))) {
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
        status: final_approval_status === 'Approved' ? 'verified' : (autoRejected ? 'rejected' : 'pending'),
        cinVerified,
        gstnVerified,
        llpinVerified,
        verificationType,
        rejectionReason
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

    if (autoRejected) {
      return res.status(200).json({
        success: true,
        warning: rejectionReason,
        code: 'STARTUP_VERIFICATION_FAILED',
        data: profile,
      });
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
