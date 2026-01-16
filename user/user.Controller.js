const User = require('../models/user.model');
const async_handler = require("express-async-handler");
const bcrypt = require('bcryptjs');
// Basic CRUD controller for User

const createUser = async_handler(async (req, res) => {
  try {
    const { username, email, role, password } = req.body;
    
    // Validate required fields
    if (!username || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'username, email, password, and role are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, error: 'Email already in use' });

    // Ensure password is a string
    if (typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password must be a string' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email: email.toLowerCase(), role, password: hashed });
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(201).json({ success: true, data: userObj });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

const getUsers = async_handler(async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const getUserById = async_handler(async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const updateUser = async_handler(async (req, res) => {
  try {
    const updates = req.body;
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const userObj = user.toObject();
    delete userObj.password;
    return res.json({ success: true, data: userObj });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

const deleteUser = async_handler(async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const userObj = user.toObject();
    delete userObj.password;
    return res.json({ success: true, data: userObj });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
};
