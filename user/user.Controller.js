const User = require('../models/user.model');
const PendingUser = require('../models/pendingUser.model');
const async_handler = require("express-async-handler");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/emailHelper');

// Basic CRUD controller for User

const createUser = async_handler(async (req, res) => {
  try {
    console.log("Full signup request body:", req.body);
    const { username, email, role, password } = req.body;
    console.log("Registration attempt:", { username, email, role, hasPassword: !!password });
    
    // Validate required fields
    if (!username || !email || !password || !role) {
      console.log("Registration failed: Missing fields");
      return res.status(400).json({ success: false, error: 'username, email, password, and role are required' });
    }

    const normalizedEmail = email.toLowerCase();

    // 1. Check if user already exists in main User collection
    const existingVerified = await User.findOne({ email: normalizedEmail });
    if (existingVerified) {
      console.log("Registration failed: Email already verified", normalizedEmail);
      return res.status(409).json({ success: false, error: 'Email already in use and verified' });
    }

    // 2. Ensure password is a string
    if (typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password must be a string' });
    }

    const hashed = await bcrypt.hash(password, 10);
    
    // 3. Generate OTP for verification
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. Upsert into PendingUser collection (temporary storage)
    console.log("Saving to pending collection...");
    await PendingUser.findOneAndUpdate(
      { email: normalizedEmail },
      { 
        username, 
        password: hashed, 
        role, 
        otp: tokenHash, 
        expiresAt: tokenExpires 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Send verification email via Brevo
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height:1.4; color:#111;">
          <h2>Verify Your Email</h2>
          <p>Thanks for registering with Wostup. Use the one-time verification code below to complete your registration. This code expires in 24 hours.</p>
          <p style="text-align:center; margin:28px 0; font-size:22px; letter-spacing:4px;"><strong>${token}</strong></p>
          <p>If you didn't request this, ignore this email.</p>
          <hr />
          <p style="font-size:12px;color:#666">If you need help, reply to this email.</p>
        </div>
      `;
      
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: "Verify Your Email",
        html: htmlContent,
        isVerification: true
      });
      console.log(`Verification email sent to ${normalizedEmail}`, emailResult);
    } catch (emailErr) {
      console.error("CRITICAL: Failed to send verification email:", emailErr);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to send verification email. Please check your email configuration.",
        details: emailErr.message 
      });
    }

    return res.status(201).json({ 
      success: true, 
      message: "Please check your email for the verification code to complete your registration." 
    });
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
    const id = req.params.id === 'me' ? req.user.id : req.params.id;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const updateUser = async_handler(async (req, res) => {
  try {
    const updates = { ...req.body };
    const id = req.params.id === 'me' ? req.user.id : req.params.id;

    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    // Prevent role change via this route if needed, or allow for admin only
    if (req.params.id === 'me' && updates.role) {
      delete updates.role;
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
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

const verifyEmail = async_handler(async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) return res.status(400).json({ success: false, error: 'Email and token are required' });

  try {
    const normalized = email.toLowerCase();
    const hash = crypto.createHash('sha256').update(token).digest('hex');

    // 1. Find the pending record
    const pending = await PendingUser.findOne({ email: normalized, otp: hash });
    
    if (!pending) {
      return res.status(400).json({ success: false, error: 'Invalid verification code or email' });
    }

    // 2. Check expiry
    if (pending.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    // 3. Move data to main User collection (This is where the user is finally "stored")
    const newUser = new User({
      username: pending.username,
      email: pending.email,
      password: pending.password,
      role: pending.role,
      isVerified: true // They are verified now
    });

    await newUser.save();

    // 4. Remove from PendingUser
    await PendingUser.deleteOne({ _id: pending._id });

    // 5. Auto-login after verification
    const tokenPayload = { id: newUser._id, role: newUser.role };
    const authToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '30d' });

    // Set cookie
    res.cookie('auth', authToken, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'Lax', 
      maxAge: 30 * 24 * 60 * 60 * 1000 
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    // Determine onboarding step
    let onboardingStep = 'completed';
    if (newUser.role === 'startup') {
      onboardingStep = 'profile'; // If they just verified, they definitely don't have a profile yet
    }

    return res.json({ 
      success: true, 
      message: "Email verified successfully!",
      data: {
        user: userObj,
        token: authToken,
        onboardingStep
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error during verification' });
  }
});

const resendVerification = async_handler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

  try {
    const normalized = email.toLowerCase();
    
    // Check if they are already a verified user
    const alreadyVerified = await User.findOne({ email: normalized });
    if (alreadyVerified) {
      return res.status(400).json({ success: false, error: "This email is already verified. Please log in." });
    }

    // Check if they have a pending registration
    const pending = await PendingUser.findOne({ email: normalized });
    
    if (pending) {
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      pending.otp = tokenHash;
      pending.expiresAt = tokenExpires;
      await pending.save();

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height:1.4; color:#111;">
          <h2>Verify Your Email</h2>
          <p>Use the one-time verification code below to complete your registration. This code expires in 24 hours.</p>
          <p style="text-align:center; margin:28px 0; font-size:22px; letter-spacing:4px;"><strong>${token}</strong></p>
          <hr />
          <p style="font-size:12px;color:#666">If you need help, reply to this email.</p>
        </div>
      `;
      
      await sendEmail({
        to: normalized,
        subject: "Verify Your Email",
        html: htmlContent,
        isVerification: true
      });

      return res.json({ success: true, message: "A new verification code has been sent to your email." });
    } else {
      return res.status(404).json({ success: false, error: "No pending registration found for this email. Please sign up again." });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  verifyEmail,
  resendVerification
};
