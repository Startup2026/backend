const crypto = require('crypto');
const IncubationCode = require('../models/incubationCode.model');

const normalizeIncubationCode = (value = '') => String(value || '').trim().toUpperCase();
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const generateUniqueIncubationCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `WOS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const existing = await IncubationCode.findOne({ code: candidate }).select('_id').lean();
    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique incubation code. Please try again.');
};

const resolveIncubationInvite = async ({ incubationCode, userEmail, founderEmail, currentStartupId, currentIncubatorId }) => {
  const normalizedCode = normalizeIncubationCode(incubationCode);
  if (!normalizedCode) {
    return null;
  }

  const invitation = await IncubationCode.findOne({
    code: normalizedCode,
    revokedAt: null,
  }).populate('incubatorId', 'name');

  if (!invitation) {
    throw new Error('Invalid incubation code.');
  }

  const currentStartupIdString = currentStartupId ? currentStartupId.toString() : null;
  const usedByStartupIdString = invitation.usedByStartupId ? invitation.usedByStartupId.toString() : null;
  if (invitation.usedAt && usedByStartupIdString !== currentStartupIdString) {
    throw new Error('This incubation code has already been used.');
  }

  const allowedEmails = [normalizeEmail(userEmail), normalizeEmail(founderEmail)].filter(Boolean);
  if (invitation.recipientEmail && allowedEmails.length > 0 && !allowedEmails.includes(invitation.recipientEmail)) {
    throw new Error('This incubation code was issued for a different email address.');
  }

  if (
    currentIncubatorId &&
    invitation.incubatorId &&
    invitation.incubatorId._id.toString() !== currentIncubatorId.toString()
  ) {
    throw new Error('This startup is already linked to a different incubator.');
  }

  return {
    invitation,
    incubatorId: invitation.incubatorId?._id || invitation.incubatorId,
    incubatorName: invitation.incubatorId?.name || null,
    normalizedCode,
  };
};

const markIncubationInviteUsed = async ({ invitation, startupId, userId }) => {
  if (!invitation || !startupId || !userId) {
    return invitation;
  }

  const sameStartup = invitation.usedByStartupId && invitation.usedByStartupId.toString() === startupId.toString();
  if (invitation.usedAt && sameStartup) {
    return invitation;
  }

  invitation.usedByStartupId = startupId;
  invitation.usedByUserId = userId;
  invitation.usedAt = invitation.usedAt || new Date();
  await invitation.save();
  return invitation;
};

module.exports = {
  generateUniqueIncubationCode,
  markIncubationInviteUsed,
  normalizeEmail,
  normalizeIncubationCode,
  resolveIncubationInvite,
};