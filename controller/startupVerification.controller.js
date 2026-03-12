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

const { randomUUID } = require("crypto");

const uuidv4 = () => randomUUID();

const cin_verification = async(cin)=>{
  if(!cin) return { cinVerified: false };
  const CINdata = {
    task_id: uuidv4(),
    group_id:uuidv4(),
    data: { cin: cin }
  };
  const cinurl = 'https://mca-corporate-verifications.p.rapidapi.com/v3/tasks/async/verify_with_source/ind_mca';
  const cinoptions = {
    method: 'POST',
    headers: {
      'x-rapidapi-key': process.env.rapidapi_key,
      'x-rapidapi-host': 'mca-corporate-verifications.p.rapidapi.com',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(CINdata)
  };

  let cinVerified = false;
  try {
    const response = await fetch(cinurl, cinoptions);
    const result = await response.json();
    const requestId = result?.request_id;
    if (requestId) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pollUrl = `https://mca-corporate-verifications.p.rapidapi.com/v3/tasks?request_id=${requestId}`;
      const pollOptions = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.rapidapi_key,
          'x-rapidapi-host': 'mca-corporate-verifications.p.rapidapi.com'
        }
      };
      const pollResponse = await fetch(pollUrl, pollOptions);
      const pollResult = await pollResponse.json();
      const task = Array.isArray(pollResult) ? pollResult[0] : pollResult;
      cinVerified = (task?.status === 'completed' || task?.status === 'success') && 
                    (task?.result?.source_output?.status === 'id_found' || task?.result?.source_output?.status === 'Active');
    }
  } catch (error) {
    console.error('CIN verification error:', error);
  }
  return { cinVerified };
}

const gstin_verification = async(gstin)=>{
  if(!gstin) return { gstnVerified: false };
  const GSTNdata = {
		task_id: uuidv4(),
		group_id: uuidv4(),
		data: { gstin: gstin }
	} 
  const gstnurl = 'https://gst-verification.p.rapidapi.com/v3/tasks/sync/verify_with_source/ind_gst_certificate';
  const gstnoptions = {
    method: 'POST',
    headers: {
      'x-rapidapi-key': process.env.rapidapi_key,
      'x-rapidapi-host': 'gst-verification.p.rapidapi.com',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(GSTNdata)
  };

  let gstnVerified = false;
  try {
    const response = await fetch(gstnurl, gstnoptions);
    const result = await response.json();
    gstnVerified = result?.status === 'completed' && result?.result?.source_output?.gstin_status === 'Active';
  } catch (error) {
    console.error('GSTN verification error:', error);
  }
  return { gstnVerified };
}

// Logic for LLPIN and UDYAM can be added here once RapidAPI endpoints are decided.
// For now, we mark them as pending for manual review or placeholder success.
const llpin_verification = async(llpin) => {
  return { llpinVerified: false }; // Placeholder
}

const udyam_verification = async(udyam) => {
  return { udyamVerified: false }; // Placeholder
}

const gstin_cin_verification = async(cin, gstin) => {
  const { cinVerified } = await cin_verification(cin);
  const { gstnVerified } = await gstin_verification(gstin);
  return { cinVerified, gstnVerified };
}

const StartupVerification = require('../models/startupVerification.model');
const User = require('../models/user.model');

const submitVerification = async (req, res) => {
  console.log(">>> [Verification Route Hit] User:", req.user?.id);
  try {
    const userId = req.user.id;
    const { cin, gstNumber, llpin, udyamNumber, startupIndiaId } = req.body;
    
    // Check if identifying info exists
    const hasAnyId = cin || gstNumber || llpin || udyamNumber || startupIndiaId;
    
    const existing = await StartupVerification.findOne({ userId });
    
    const verificationData = {
      userId,
      ...req.body,
      status: hasAnyId ? "pending" : "unverified",
      submittedAt: new Date()
    };

    // Run active verifications if IDs provided
    if (cin) {
      const { cinVerified } = await cin_verification(cin);
      verificationData.cinVerified = cinVerified;
      if (cinVerified) verificationData.status = 'verified'; 
    }
    
    if (gstNumber) {
      const { gstnVerified } = await gstin_verification(gstNumber);
      verificationData.gstnVerified = gstnVerified;
      if (gstnVerified) verificationData.status = 'verified';
    }

    // Save to DB
    const verification = existing
      ? await StartupVerification.findOneAndUpdate({ userId }, verificationData, { new: true })
      : await StartupVerification.create(verificationData);

    return res.json({
      success: true,
      message: hasAnyId ? 'Verification submitted and is pending/auto-verifying' : 'Profile info saved',
      data: verification
    });
  } catch (error) {
    console.error('Error submitting verification:', error);
    return res.status(500).json({ success: false, error: 'Failed' });
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
  cin_verification,
  gstin_verification,
  gstin_cin_verification,
};