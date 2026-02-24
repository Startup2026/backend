const User = require('../models/user.model');
const async_handler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailHelper');

const loginUser = async_handler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required' });

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  if (!user.isVerified) {
    return res.status(403).json({ success: false, error: 'Please verify your email address before logging in.', needsVerification: true });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });

  // Set cookie (optional) and return token
  res.cookie('auth', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 * 1000 });

  const userObj = user.toObject();
  delete userObj.password;

  // For startups, check if profile exists
  let onboardingStep = 'completed';
  if (user.role === 'startup') {
    const StartupProfile = require('../models/startupprofile.model');
    const profile = await StartupProfile.findOne({ userId: user._id });
    if (!profile) {
      onboardingStep = 'profile';
    } else if (!profile.subscriptionPlan) {
      onboardingStep = 'plan';
    }
  }

  return res.json({ 
    success: true, 
    data: { 
      user: userObj, 
      token,
      onboardingStep 
    } 
  });
});

const logout = async_handler(async (req, res) => {
  res.clearCookie('auth');
  return res.json({ success: true, message: 'Logged out' });
});

const forgotPassword = async_handler(async (req, res) => {
    console.log('--- Forgot Password Request Started ---');
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase(); // <-- ADDED THIS LINE
    console.log('1. Email received:', email, '| Normalized:', normalizedEmail);

    const user = await User.findOne({ email: normalizedEmail }); // <-- UPDATED THIS LINE

    if (!user) {
        console.log('2. User not found in database. Sending generic success response.');
        // To prevent user enumeration, always send a success-like response
        return res.json({ success: true, message: 'If a user with that email exists, a password reset link has been sent.' });
    }
    console.log('2. User found in database:', user.email);


    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });
    console.log('3. Reset token generated and saved to user.');

    console.log(`DIAGNOSTIC: Value of FRONTEND_URL from .env is: ${process.env.FRONTEND_URL}`);

    // Send email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;
    const message = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password Reset Request</h2>
        <p>You are receiving this email because you (or someone else) has requested the reset of a password for your account.</p>
        <p>Please click on the following link, or paste it into your browser to complete the process:</p>
        <p><a href="${resetUrl}" style="color: #1a73e8;">${resetUrl}</a></p>
        <p>This link will expire in 10 minutes.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
      </div>
    `;

    try {
        console.log('4. Attempting to send email via Resend...');
        await sendEmail({
            to: user.email,
            subject: 'Password Reset Token',
            html: message,
        });
        console.log('5. Email successfully sent (or at least API call was successful).');

        res.json({ success: true, message: 'Email sent' });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        console.error('5. CRITICAL: Error sending email:', err);
        res.status(500).json({ success: false, error: 'Email could not be sent' });
    }
    console.log('--- Forgot Password Request Finished ---');
});

const resetPassword = async_handler(async (req, res) => {
    console.log('--- Reset Password Request Started ---');
    try {
        // 1) Get user based on the token
        console.log('1. Token from params:', req.params.token);
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        console.log('2. Hashed token for DB query:', hashedToken);

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        // 2) If token has not expired, and there is a user, set the new password
        if (!user) {
            console.log('3. User not found or token expired.');
            return res.status(400).json({ success: false, error: 'Token is invalid or has expired' });
        }
        console.log('3. User found for token:', user.email);


        if (!req.body.password) {
            console.log('4. No password provided in request body.');
            return res.status(400).json({ success: false, error: 'Password is required' });
        }
        console.log('4. New password received.');

        user.password = req.body.password; // The pre-save hook will hash it
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        
        console.log('5. Attempting to save user with new password...');
        await user.save();
        console.log('6. User saved successfully.');

        // 3) Log the user in, send JWT
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.cookie('auth', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
        
        const userObj = user.toObject();
        delete userObj.password;

        console.log('7. New JWT created and sent. Process finished.');
        res.json({ success: true, data: { user: userObj, token } });
    } catch (error) {
        console.error('--- CRITICAL: Error in resetPassword function ---', error);
        res.status(500).json({ success: false, error: 'An internal server error occurred.' });
    }
    console.log('--- Reset Password Request Finished ---');
});

module.exports = {
  loginUser,
  logout,
  forgotPassword,
  resetPassword
};