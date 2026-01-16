const StartupProfile = require('../models/startupprofile.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");

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
      description, // map to aboutus
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
      hiring
    } = req.body;

    if (!startupName) return res.status(400).json({ success: false, error: 'startupName is required' });

    // Ensure user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const profile = new StartupProfile({
      userId,
      startupName,
      tagline,
      aboutus: description,
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
      hiring
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
    // support 'me' shortcut
    if (req.params.id === 'me') {
      const profile = await StartupProfile.findOne({ userId: req.user.id }).populate('userId', 'name email');
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const profile = await StartupProfile.findById(req.params.id).populate('userId', 'name email');
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
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
      'verified'
    ];

    const updates = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (allowed.includes(k)) updates[k] = req.body[k];
      // allow 'description' to update 'aboutus'
      if (k === 'description') updates.aboutus = req.body[k];
    });

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

module.exports = {
  createProfile,
  getProfiles,
  getProfileById,
  updateProfile,
  deleteProfile
};
