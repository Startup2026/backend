const StudentProfile = require('../models/studentprofile.model');
const User = require('../models/user.model');
const async_handler = require("express-async-handler");
const mongoose = require('mongoose');
const { getUploadedFileUrl } = require("../utils/uploadUrl");

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

const sanitizeExperience = (value) => {
  const parsed = parseMaybeJson(value, []);
  const list = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);

  const normalized = list
    .map((item) => ({
      title: typeof item?.title === 'string' ? item.title.trim() : item?.title,
      company: typeof item?.company === 'string' ? item.company.trim() : item?.company,
      duration: typeof item?.duration === 'string' ? item.duration.trim() : item?.duration,
    }))
    .filter((item) => {
      const hasAnyValue = [item.title, item.company, item.duration]
        .some((v) => typeof v === 'string' ? v.length > 0 : v !== undefined && v !== null);
      return hasAnyValue;
    });

  const invalidEntry = normalized.find((item) => !item.title || !item.company);
  if (invalidEntry) {
    return { error: 'Each experience entry must include title and company' };
  }

  return normalized;
};

const sanitizeEducation = (value) => {
  const parsed = parseMaybeJson(value, []);
  if (!Array.isArray(parsed)) return [];

  const normalized = parsed
    .map((item) => ({
      institution: typeof item?.institution === 'string' ? item.institution.trim() : item?.institution,
      degree: typeof item?.degree === 'string' ? item.degree.trim() : item?.degree,
      field: typeof item?.field === 'string' ? item.field.trim() : item?.field,
      startYear: typeof item?.startYear === 'string' ? item.startYear.trim() : item?.startYear,
      endYear: typeof item?.endYear === 'string' ? item.endYear.trim() : item?.endYear,
    }))
    .filter((item) => {
      const hasAnyValue = [item.institution, item.degree, item.field, item.startYear, item.endYear]
        .some((v) => typeof v === 'string' ? v.length > 0 : v !== undefined && v !== null);
      return hasAnyValue;
    });

  const invalidEntry = normalized.find((item) => !item.institution);
  if (invalidEntry) {
    return { error: 'Each education entry must include institution' };
  }

  return normalized;
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

    const parsedEducation = sanitizeEducation(education);
    if (parsedEducation?.error) {
      return res.status(400).json({ success: false, error: parsedEducation.error });
    }

    const parsedSkills = parseMaybeJson(skills, []);
    const parsedInterests = parseMaybeJson(interests, []);
    const parsedExperience = sanitizeExperience(experience);
    if (parsedExperience?.error) {
      return res.status(400).json({ success: false, error: parsedExperience.error });
    }

    let profilepic = req.body.profilepic;
    let resumeFileUrl = resumeUrl;
    if (req.files?.profilepic?.[0]) {
      profilepic = getUploadedFileUrl(req.files.profilepic[0]);
    }
    if (req.files?.resume?.[0]) {
      resumeFileUrl = getUploadedFileUrl(req.files.resume[0]);
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
      // For current user, return a soft "not created yet" response instead of HTTP 404
      // so dashboard/profile pages can load without a failed-resource browser error.
      if (!profile) {
        return res.json({ success: true, data: null, profileExists: false, message: 'Profile not found' });
      }
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
    const requiredScalarFields = new Set(['firstName', 'lastName', 'email']);
    const updates = {};

    Object.keys(req.body || {}).forEach((k) => {
      if (!allowed.includes(k)) return;
      if (jsonFields.includes(k)) {
        if (k === 'education') {
          const sanitizedEducation = sanitizeEducation(req.body[k]);
          if (sanitizedEducation?.error) {
            updates.__educationError = sanitizedEducation.error;
            return;
          }
          updates[k] = sanitizedEducation;
          return;
        }

        if (k === 'experience') {
          const sanitizedExperience = sanitizeExperience(req.body[k]);
          if (sanitizedExperience?.error) {
            updates.__experienceError = sanitizedExperience.error;
            return;
          }
          updates[k] = sanitizedExperience;
          return;
        }

        updates[k] = parseMaybeJson(req.body[k], []);
      } else {
        const rawValue = req.body[k];
        if (typeof rawValue === 'string') {
          const trimmed = rawValue.trim();
          if (trimmed === '' && requiredScalarFields.has(k)) {
            return;
          }
          updates[k] = trimmed;
          return;
        }

        updates[k] = rawValue;
      }
    });

    if (updates.__educationError) {
      return res.status(400).json({ success: false, error: updates.__educationError });
    }

    if (updates.__experienceError) {
      return res.status(400).json({ success: false, error: updates.__experienceError });
    }

    if (req.files?.profilepic?.[0]) {
      updates.profilepic = getUploadedFileUrl(req.files.profilepic[0]);
    }
    if (req.files?.resume?.[0]) {
      updates.resumeUrl = getUploadedFileUrl(req.files.resume[0]);
    }

    if (req.params.id === 'me') {
      let existingProfile = await StudentProfile.findOne({ userId: req.user.id });

      if (!existingProfile) {
        const user = await User.findById(req.user.id).select('username email profileCompleted');
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        const usernameParts = (user.username || '').trim().split(/\s+/).filter(Boolean);
        const firstName = updates.firstName || usernameParts[0] || 'Student';
        const lastName = updates.lastName || usernameParts.slice(1).join(' ') || 'User';
        const email = updates.email || user.email;

        const createdProfile = await StudentProfile.create({
          userId: req.user.id,
          firstName,
          lastName,
          email,
          ...updates,
          education: updates.education || [],
        });

        user.profileCompleted = true;
        await user.save({ validateBeforeSave: false });

        return res.status(201).json({ success: true, data: createdProfile, profileCreated: true });
      }

      const profile = await StudentProfile.findOneAndUpdate(
        { userId: req.user.id },
        updates,
        { new: true, runValidators: true }
      );

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
