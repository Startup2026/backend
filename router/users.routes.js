const express = require('express');
const router = express.Router();

const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../user/user.Controller');
const { loginUser, logout } = require('../user/auth.Controller');
const { createProfile: createStartupProfile, getProfiles: getStartupProfiles, getProfileById: getStartupProfileById, updateProfile: updateStartupProfile, deleteProfile: deleteStartupProfile } = require('../user/startupProfile.Controller');
const { createProfile: createStudentProfile, getProfiles: getStudentProfiles, getProfileById: getStudentProfileById, updateProfile: updateStudentProfile, deleteProfile: deleteStudentProfile } = require('../user/studentProfile.Controller');

const token__middleware = require('../middleware/jwttoken.middleware');

// Auth
router.post('/signup', createUser);
router.post('/login', loginUser);
router.post('/logout', logout);

// Users CRUD (protected)
router.get('/users', token__middleware, getUsers);
router.get('/users/:id', token__middleware, getUserById);
router.put('/users/:id', token__middleware, updateUser);
router.delete('/users/:id', token__middleware, deleteUser);

// Startup profiles
router.post('/startupProfile', createStartupProfile);
router.get('/startupProfiles', token__middleware, getStartupProfiles);
router.get('/startupProfile/:id', token__middleware, getStartupProfileById);
router.put('/startupProfile/:id', token__middleware, updateStartupProfile);
router.delete('/startupProfile/:id', token__middleware, deleteStartupProfile);

// Student profiles
router.post('/studentProfile', createStudentProfile);
router.get('/studentProfiles', token__middleware, getStudentProfiles);
router.get('/studentProfile/:id', token__middleware, getStudentProfileById);
router.put('/studentProfile/:id', token__middleware, updateStudentProfile);
router.delete('/studentProfile/:id', token__middleware, deleteStudentProfile);

module.exports = router;
