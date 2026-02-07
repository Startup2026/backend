const express = require('express');
const router = express.Router();
const token__middleware = require('../middleware/jwttoken.middleware');
const uploads = require('../middleware/fileuploads.middleware');

const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../user/user.Controller');
const { loginUser, logout } = require('../user/auth.Controller');
const { createProfile: createStartupProfile, getProfiles: getStartupProfiles, getProfileById: getStartupProfileById, updateProfile: updateStartupProfile, deleteProfile: deleteStartupProfile } = require('../user/startupProfile.Controller');
const { createProfile: createStudentProfile, getProfiles: getStudentProfiles, getProfileById: getStudentProfileById, updateProfile: updateStudentProfile, deleteProfile: deleteStudentProfile } = require('../user/studentProfile.Controller');


const profileUploads = uploads.fields([
	{ name: 'profilepic', maxCount: 1 },
	{ name: 'resume', maxCount: 1 }
]);

router.post('/student-profiles', token__middleware, profileUploads, createStudentProfile);
// Convenience endpoints that return/modify the authenticated user's profile (uses token from cookie or Authorization header)
router.get('/student-profiles/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, getStudentProfileById);
router.put('/student-profiles/me', token__middleware, profileUploads, (req, res, next) => { req.params.id = 'me'; next(); }, updateStudentProfile);
router.delete('/student-profiles/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, deleteStudentProfile);
router.get('/student-profiles', token__middleware, getStudentProfiles);
router.get('/student-profiles/:id', token__middleware, getStudentProfileById);
router.put('/student-profiles/:id', token__middleware, profileUploads, updateStudentProfile);
router.delete('/student-profiles/:id', token__middleware, deleteStudentProfile);
module.exports = router;