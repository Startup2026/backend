const StudentProfile = require('../models/studentprofile.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");
const mongoose = require('mongoose');

const parseMaybeJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback !== undefined ? fallback : value;
    }
  }
  return value;
};

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

    const {
      firstName,
      lastName,
      email,
      phone,
      location,
      bio,
      education,
      skills,
      interests,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      resumeUrl,
      experience
    } = req.body;

    const parsedEducation = parseMaybeJson(education, []);
    const parsedSkills = parseMaybeJson(skills, []);
    const parsedInterests = parseMaybeJson(interests, []);
    const parsedExperience = parseMaybeJson(experience, []);

    let profilepic = req.body.profilepic;
    let resumeFileUrl = resumeUrl;
    if (req.files?.profilepic?.[0]) {
      profilepic = `/media/${req.files.profilepic[0].filename}`;
    }
    if (req.files?.resume?.[0]) {
      resumeFileUrl = `/media/${req.files.resume[0].filename}`;
    }

    // Basic check: ensure user exists
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const existing = await StudentProfile.findOne({ userId });
    if (existing) return res.status(409).json({ success: false, error: 'Profile already exists for this user' });

    const profile = new StudentProfile({
      userId,
      firstName,
      lastName,
      email,
      phone,
      location,
      bio,
      profilepic,
      education: parsedEducation,
      skills: parsedSkills,
      interests: parsedInterests,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      resumeUrl: resumeFileUrl,
      experience: parsedExperience
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
    // whitelist allowed fields
    const allowed = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'location',
      'bio',
      'profilepic',
      'education',
      'skills',
      'interests',
      'githubUrl',
      'linkedinUrl',
      'portfolioUrl',
      'resumeUrl',
      'experience'
    ];

    const jsonFields = ['education', 'skills', 'interests', 'experience'];
    const updates = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (!allowed.includes(k)) return;
      if (jsonFields.includes(k)) {
        updates[k] = parseMaybeJson(req.body[k], []);
      } else {
        updates[k] = req.body[k];
      }
    });

    if (req.files?.profilepic?.[0]) {
      updates.profilepic = `/media/${req.files.profilepic[0].filename}`;
    }
    if (req.files?.resume?.[0]) {
      updates.resumeUrl = `/media/${req.files.resume[0].filename}`;
    }

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
