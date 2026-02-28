// const StartupVerification = require('../models/startupVerification.model');
// const StartupProfile = require('../models/startupprofile.model');
// const async_handler = require("express-async-handler");

// // // @desc    Submit startup for verification
// // // @route   POST /api/startup-verification
// // // @access  Private (Startup)
// // const submitVerification = async_handler(async (req, res) => {
// //     const { companyName, website } = req.body;
// //     const userId = req.user.id;

// //     if (!companyName) {
// //         return res.status(400).json({ success: false, error: 'Company name is required.' });
// //     }

// //     const existingVerification = await StartupVerification.findOne({ userId });
// //     if (existingVerification) {
// //         return res.status(400).json({ success: false, error: 'You have already submitted a verification request.' });
// //     }

// //     const verification = await StartupVerification.create({
// //         userId,
// //         companyName,
// //         website
// //     });

// //     res.status(201).json({ success: true, data: verification });
// // });

// // // @desc    Get all verification requests (for admin)
// // // @route   GET /api/startup-verification
// // // @access  Private (Admin)
// // const getVerifications = async_handler(async (req, res) => {
// //     // Add role check middleware for admin access
// //     if (req.user.role !== 'admin') {
// //         return res.status(403).json({ success: false, error: 'Not authorized' });
// //     }
// //     const verifications = await StartupVerification.find().populate('userId', 'username email');
// //     res.json({ success: true, data: verifications });
// // });

// // // @desc    Update verification status (for admin)
// // // @route   PATCH /api/startup-verification/:id
// // // @access  Private (Admin)
// // const updateVerificationStatus = async_handler(async (req, res) => {
// //     if (req.user.role !== 'admin') {
// //         return res.status(403).json({ success: false, error: 'Not authorized' });
// //     }

// //     const { status } = req.body;
// //     if (!['approved', 'rejected'].includes(status)) {
// //         return res.status(400).json({ success: false, error: 'Invalid status.' });
// //     }

// //     const verification = await StartupVerification.findByIdAndUpdate(req.params.id, { status }, { new: true });

// //     if (!verification) {
// //         return res.status(404).json({ success: false, error: 'Verification request not found.' });
// //     }

// //     res.json({ success: true, data: verification });
// // });


// // // Add this method to your existing controller

// // const getMyVerificationStatus = async (req, res) => {
// //   try {
// //     const verification = await StartupVerification.findOne({ userId: req.user.id });
    
// //     if (!verification) {
// //       return res.json({ 
// //         success: true, 
// //         data: { status: 'not_submitted' } 
// //       });
// //     }
    
// //     return res.json({ 
// //       success: true, 
// //       data: { 
// //         status: verification.status,
// //         submittedAt: verification.createdAt,
// //         rejectionReason: verification.rejectionReason 
// //       } 
// //     });
// //   } catch (error) {
// //     console.error('Error fetching verification status:', error);
// //     return res.status(500).json({ 
// //       success: false, 
// //       error: 'Failed to fetch verification status' 
// //     });
// //   }
// // };

// // // Export it with other methods
// // module.exports = {
// //   submitVerification,
// //   getVerifications,
// //   updateVerificationStatus,
// //   getMyVerificationStatus, // Add this
// // };


// // module.exports = {
// //     submitVerification,
// //     getVerifications,
// //     updateVerificationStatus,
// //     getMyVerificationStatus,
// // };










const StartupVerification = require('../models/startupVerification.model');
const User = require('../models/user.model');

const submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if already submitted
    const existing = await StartupVerification.findOne({ userId });
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Verification already submitted and pending review' 
      });
    }

    const verificationData = {
      userId,
      ...req.body,
      status: 'pending',
      submittedAt: new Date()
    };

    const verification = existing 
      ? await StartupVerification.findOneAndUpdate({ userId }, verificationData, { new: true })
      : await StartupVerification.create(verificationData);

    return res.json({ 
      success: true, 
      message: 'Verification submitted successfully',
      data: verification 
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to submit verification' 
    });
  }
};

const getVerifications = async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const verifications = await StartupVerification.find()
      .populate('userId', 'name email')
      .sort({ submittedAt: -1 });

    return res.json({ success: true, data: verifications });
  } catch (error) {
    console.error('Error fetching verifications:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch verifications' });
  }
};

const updateVerificationStatus = async (req, res) => {
  try {
    // Admin only
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const verification = await StartupVerification.findByIdAndUpdate(
      id,
      { 
        status, 
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        reviewedAt: new Date()
      },
      { new: true }
    );

    if (!verification) {
      return res.status(404).json({ success: false, error: 'Verification not found' });
    }

    return res.json({ 
      success: true, 
      message: `Verification ${status}`,
      data: verification 
    });
  } catch (error) {
    console.error('Error updating verification:', error);
    return res.status(500).json({ success: false, error: 'Failed to update verification' });
  }
};

const getMyVerificationStatus = async (req, res) => {
  try {
    const verification = await StartupVerification.findOne({ userId: req.user.id });
    
    if (!verification) {
      return res.json({ 
        success: true, 
        data: { status: 'not_submitted' } 
      });
    }
    
    return res.json({ 
      success: true, 
      data: { 
        status: verification.status,
        submittedAt: verification.createdAt,
        rejectionReason: verification.rejectionReason 
      } 
    });
  } catch (error) {
    console.error('Error fetching verification status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch verification status' 
    });
  }
};

module.exports = {
  submitVerification,
  getVerifications,
  updateVerificationStatus,
  getMyVerificationStatus,
};