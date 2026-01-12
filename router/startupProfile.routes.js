const express = require('express');
const router = express.Router();
const token__middleware = require('../middleware/jwttoken.middleware');

const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../user/user.Controller');
const { loginUser, logout } = require('../user/auth.Controller');
const { createProfile: createStartupProfile, getProfiles: getStartupProfiles, getProfileById: getStartupProfileById, updateProfile: updateStartupProfile, deleteProfile: deleteStartupProfile } = require('../user/startupProfile.Controller');
const { createProfile: createStudentProfile, getProfiles: getStudentProfiles, getProfileById: getStudentProfileById, updateProfile: updateStudentProfile, deleteProfile: deleteStudentProfile } = require('../user/studentProfile.Controller');

// Startup profiles
router.post('/startupProfile', createStartupProfile);
router.get('/startupProfiles', token__middleware, getStartupProfiles);
router.get('/startupProfile/:id', token__middleware, getStartupProfileById);
router.put('/startupProfile/:id', token__middleware, updateStartupProfile);
router.delete('/startupProfile/:id', token__middleware, deleteStartupProfile);

module.exports = router;
