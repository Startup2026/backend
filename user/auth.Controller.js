const User = require('../models/user.model');
const async_handler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const loginUser = async_handler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

  // Set cookie (optional) and return token
  res.cookie('auth', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 * 1000 });

  const userObj = user.toObject();
  delete userObj.password;

  return res.json({ success: true, data: { user: userObj, token } });
});

const logout = async_handler(async (req, res) => {
  res.clearCookie('auth');
  return res.json({ success: true, message: 'Logged out' });
});

module.exports = {
  loginUser,
  logout
};
