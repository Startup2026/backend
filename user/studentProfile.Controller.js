const StudentProfile = require('../models/studentprofile.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");
const mongoose = require('mongoose');

const createProfile = async_handler(async (req, res) => {
  try {
    // Prefer authenticated user id (from token); fall back to body.userId if present
    const bodyUserId = req.body.userId;
    const authUserId = req.user?.id;
    if (authUserId && bodyUserId && authUserId !== bodyUserId) {
      return res.status(403).json({ success: false, error: 'Cannot create a profile for another user' });
    }

    const userId = authUserId || bodyUserId;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });

    const { firstName, lastName, email, education,skills,interests,githubUrl,linkedinUrl,portfolioUrl,resumeUrl } = req.body;

    // Basic check: ensure user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const existing = await StudentProfile.findOne({ userId });
    if (existing) return res.status(409).json({ success: false, error: 'Profile already exists for this user' });

    const profile = new StudentProfile({ userId, firstName, lastName, email, education,skills,interests,githubUrl,linkedinUrl,portfolioUrl });
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
    const profiles = await StudentProfile.find().populate('userId', 'name email');
    return res.json({ success: true, data: profiles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const getProfileById = async_handler(async (req, res) => {
  try {
    // If caller asks for 'me', return the profile belonging to the authenticated user.
    if (req.params.id === 'me') {
      const profile = await StudentProfile.findOne({ userId: req.user.id }).populate('userId', 'name email');
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid profile id' });

    // Try by profile _id first, then fallback to searching by userId in case client passed a user id.
    let profile = await StudentProfile.findById(id).populate('userId', 'name email');
    if (!profile) {
      profile = await StudentProfile.findOne({ userId: id }).populate('userId', 'name email');
    }

    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
    return res.json({ success: true, data: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const updateProfile = async_handler(async (req, res) => {
  try {
    const updates = req.body;

    if (req.params.id === 'me') {
      const profile = await StudentProfile.findOneAndUpdate({ userId: req.user.id }, updates, { new: true, runValidators: true });
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid profile id' });

    const profile = await StudentProfile.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
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
      const profile = await StudentProfile.findOneAndDelete({ userId: req.user.id });
      if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });
      return res.json({ success: true, data: profile });
    }

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: 'Invalid profile id' });

    const profile = await StudentProfile.findByIdAndDelete(id);
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
