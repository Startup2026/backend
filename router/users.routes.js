const express = require('express');
const router = express.Router();

const { createUser, getUsers, getUserById, updateUser, deleteUser, verifyEmail, resendVerification } = require('../user/user.Controller');
const { loginUser, logout, forgotPassword, resetPassword } = require('../user/auth.Controller');

const token__middleware = require('../middleware/jwttoken.middleware');


// Auth
router.post('/auth/signup', createUser);
router.post('/auth/login', loginUser);
router.post('/auth/logout', logout);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password/:token', resetPassword);
router.post('/auth/verify-email', verifyEmail);
router.post('/auth/resend-verification', resendVerification);

// Users CRUD (protected)
router.get('/users', token__middleware, getUsers);
router.get('/users/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, getUserById);
router.put('/users/me', token__middleware, (req, res, next) => { req.params.id = 'me'; next(); }, updateUser);
router.get('/users/:id', token__middleware, getUserById);
router.put('/users/:id', token__middleware, updateUser);
router.delete('/users/:id', token__middleware, deleteUser);

 
module.exports = router;



