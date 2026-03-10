const express = require('express');
const router = express.Router();
const token__middleware = require('../middleware/jwttoken.middleware');

const { 
  createProfile: createStartupProfile, 
  getProfiles: getStartupProfiles, 
  getProfileById: getStartupProfileById, 
  updateProfile: updateStartupProfile, 
  deleteProfile: deleteStartupProfile,
  selectPlan: selectStartupPlan,
  adminReviewProfile
} = require('../user/startupProfile.Controller');

const { isPlatformAdmin } = require('../middleware/adminRole.middleware');

// Startup profiles
router.post('/startupProfile', createStartupProfile);
router.post('/startupProfile/select-plan', token__middleware, selectStartupPlan);
router.get('/startupProfiles', token__middleware, getStartupProfiles);
router.put('/startupProfile/:id/admin-review', token__middleware, isPlatformAdmin, adminReviewProfile);
// Convenience endpoints that return/modify the authenticated user's profile (uses token from cookie or Authorization header)
router.get('/startupProfile/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, getStartupProfileById);
router.put('/startupProfile/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, updateStartupProfile);
router.delete('/startupProfile/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, deleteStartupProfile);
router.get('/startupProfile/:id', token__middleware, getStartupProfileById);
router.put('/startupProfile/:id', token__middleware, updateStartupProfile);
router.delete('/startupProfile/:id', token__middleware, deleteStartupProfile);

module.exports = router;
