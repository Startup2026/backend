const StartupProfile = require('../models/startupprofile.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");

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
      leadershipTeam
    } = req.body;

    if (!startupName) return res.status(400).json({ success: false, error: 'startupName is required' });

    // Ensure user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const resolvedSocialLinks = buildSocialLinks(socialLinks, linkedinUrl, twitterUrl, githubUrl);
    const resolvedLocation = normalizeLocation(location, city, country);

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
      leadershipTeam
    });
    await profile.save();

    user.profileCompleted = true;
    await user.save();

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

    // Increment views if it's not the owner viewing their own profile
    if (req.params.id !== 'me' && (!req.user || req.user.id !== profile.userId?._id?.toString())) {
      profile.views = (profile.views || 0) + 1;
      await profile.save();
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
      'leadershipTeam'
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

    // support 'me' route
    if (req.params.id === 'me') {
      const profile = await StartupProfile.findOneAndUpdate({ userId: req.user.id }, updates, { new: true, runValidators: true });
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const profile = await StartupProfile.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
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
  
  const validPlans = ['FREE', 'GROWTH', 'PRO', 'ENTERPRISE'];
  const upperPlan = plan.toUpperCase();
  
  if (!validPlans.includes(upperPlan)) {
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

    profile.subscriptionPlan = upperPlan;
    profile.subscriptionStatus = 'ACTIVE';
    
    // Set 30-day expiry for paid plans
    if (upperPlan !== 'FREE') {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 30);
      profile.subscriptionEndDate = expiry;
    } else {
      profile.subscriptionEndDate = null;
    }

    await profile.save();

    return res.json({ 
      success: true, 
      message: `Successfully switched to ${upperPlan} plan`,
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

module.exports = {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile,
  selectPlan
};
