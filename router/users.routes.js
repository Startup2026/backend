const express = require('express');
const router = express.Router();

const { createUser, getUsers, getUserById, updateUser, deleteUser } = require('../user/user.Controller');
const { loginUser, logout } = require('../user/auth.Controller');
const { createProfile: createStudentProfile, getProfiles: getStudentProfiles, getProfileById: getStudentProfileById, updateProfile: updateStudentProfile, deleteProfile: deleteStudentProfile } = require('../user/studentProfile.Controller');

const token__middleware = require('../middleware/jwttoken.middleware');

// Auth
router.post('/auth/signup', createUser);
router.post('/auth/login', loginUser);
router.post('/auth/logout', logout);

// Users CRUD (protected)
router.get('/users', token__middleware, getUsers);
router.get('/users/:id', token__middleware, getUserById);
router.put('/users/:id', token__middleware, updateUser);
router.delete('/users/:id', token__middleware, deleteUser);

// Student profiles
router.post('/student-profiles', createStudentProfile);
router.get('/student-profiles', token__middleware, getStudentProfiles);
// Convenience endpoints that return/modify the authenticated user's profile
router.get('/student-profiles/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, getStudentProfileById);
router.put('/student-profiles/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, updateStudentProfile);
router.delete('/student-profiles/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, deleteStudentProfile);
router.get('/student-profiles/:id', token__middleware, getStudentProfileById);
router.put('/student-profiles/:id', token__middleware, updateStudentProfile);
router.delete('/student-profiles/:id', token__middleware, deleteStudentProfile);

module.exports = router;
