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
const VERIFICATION_DEBUG = process.env.VERIFICATION_DEBUG !== 'false';

const debugLogVerification = (label, payload) => {
  if (!VERIFICATION_DEBUG) return;
  try {
    const serialized = JSON.stringify(payload);
    const trimmed = serialized.length > 1800 ? `${serialized.slice(0, 1800)}...<truncated>` : serialized;
    console.log(`[VERIFICATION_DEBUG] ${label}: ${trimmed}`);
  } catch (err) {
    console.log(`[VERIFICATION_DEBUG] ${label}:`, payload);
  }
};

const cin_verification = async(cin)=>{
  if(!cin) return { cinVerified: false };
  const cinValue = cin.toString().trim().toUpperCase().replace(/\s+/g, '');
  const CINdata = {
    task_id: uuidv4(),
    group_id:uuidv4(),
    data: { cin: cinValue }
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const pickTask = (payload) => {
    if (!payload) return null;
    if (Array.isArray(payload)) return payload[0] || null;
    if (Array.isArray(payload.tasks)) return payload.tasks[0] || null;
    if (Array.isArray(payload.data)) return payload.data[0] || null;
    if (payload.task && typeof payload.task === 'object') return payload.task;
    if (payload.result || payload.status) return payload;
    return null;
  };

  const collectSourceOutput = (task) => (
    task?.result?.source_output ||
    task?.source_output ||
    task?.result?.data ||
    task?.data ||
    {}
  );

  const cinExistsInPayload = (sourceOutput, expectedCin) => {
    const text = JSON.stringify(sourceOutput || {}).toUpperCase();
    return text.includes(expectedCin);
  };

  let cinVerified = false;
  let explicitNegative = false;
  try {
    const response = await fetch(cinurl, cinoptions);
    const result = await response.json();
    debugLogVerification('CIN_CREATE_RESPONSE', {
      cin: cinValue,
      httpStatus: response.status,
      ok: response.ok,
      requestId: result?.request_id,
      result,
    });

    // Some providers return a synchronous-style completed payload in the POST response itself.
    const createTask = pickTask(result);
    if (createTask) {
      const createStatus = (createTask?.status || '').toString().toLowerCase();
      const createSourceOutput = collectSourceOutput(createTask);
      const createBlob = JSON.stringify(createSourceOutput).toLowerCase();
      const createSourceStatus = (
        createSourceOutput?.status ||
        createSourceOutput?.company_status ||
        createSourceOutput?.mca_status ||
        ''
      ).toString().toLowerCase();

      const createCompleted = ['completed', 'success', 'succeeded'].includes(createStatus);
      const createExplicitNegative =
        ['id_not_found', 'not_found', 'inactive', 'invalid', 'rejected'].includes(createSourceStatus) ||
        createBlob.includes('not found') ||
        createBlob.includes('inactive') ||
        createBlob.includes('invalid') ||
        createBlob.includes('rejected');
      const createPositiveByCin = cinExistsInPayload(createSourceOutput, cinValue);
      const createHasSourcePayload = createSourceOutput && typeof createSourceOutput === 'object' && Object.keys(createSourceOutput).length > 0;

      debugLogVerification('CIN_CREATE_PARSED', {
        cin: cinValue,
        createStatus,
        createSourceStatus,
        createHasSourcePayload,
        createPositiveByCin,
        createExplicitNegative,
      });

      if (!createExplicitNegative && ((createCompleted && createHasSourcePayload) || createPositiveByCin)) {
        debugLogVerification('CIN_VERIFICATION_RESULT', { cin: cinValue, cinVerified: true, reason: 'create_response_positive' });
        return { cinVerified: true, explicitNegative: false };
      }
      if (createExplicitNegative) {
        debugLogVerification('CIN_VERIFICATION_RESULT', { cin: cinValue, cinVerified: false, explicitNegative: true, reason: 'create_response_explicit_negative' });
        return { cinVerified: false, explicitNegative: true };
      }
    }

    const requestId = result?.request_id;
    if (requestId) {
      const pollUrl = `https://mca-corporate-verifications.p.rapidapi.com/v3/tasks?request_id=${requestId}`;
      const pollOptions = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.rapidapi_key,
          'x-rapidapi-host': 'mca-corporate-verifications.p.rapidapi.com'
        }
      };

      // Async MCA endpoint can take a few seconds; poll multiple times to avoid false negatives.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (attempt > 0) {
          await sleep(2000);
        } else {
          await sleep(2500);
        }

        const pollResponse = await fetch(pollUrl, pollOptions);
        const pollResult = await pollResponse.json();
        const task = pickTask(pollResult);
        debugLogVerification('CIN_POLL_RESPONSE', {
          cin: cinValue,
          attempt: attempt + 1,
          httpStatus: pollResponse.status,
          ok: pollResponse.ok,
          pollResult,
        });
        if (!task) continue;

        const taskStatus = (task?.status || '').toString().toLowerCase();
        const sourceOutput = collectSourceOutput(task);
        const sourceStatus = (
          sourceOutput.status ||
          sourceOutput.company_status ||
          sourceOutput.mca_status ||
          ''
        ).toString().toLowerCase();

        const sourceTextBlob = JSON.stringify(sourceOutput).toLowerCase();

        const completed = ['completed', 'success', 'succeeded'].includes(taskStatus);
        const sourceLooksValid = [
          'id_found',
          'active',
          'valid',
          'approved',
          'exist',
          'exists',
        ].includes(sourceStatus);
        const positiveByCin = cinExistsInPayload(sourceOutput, cinValue);

        const hasSourcePayload = sourceOutput && typeof sourceOutput === 'object' && Object.keys(sourceOutput).length > 0;
        const currentExplicitNegative =
          ['id_not_found', 'not_found', 'inactive', 'invalid', 'rejected'].includes(sourceStatus) ||
          sourceTextBlob.includes('not found') ||
          sourceTextBlob.includes('inactive') ||
          sourceTextBlob.includes('invalid') ||
          sourceTextBlob.includes('rejected');

        debugLogVerification('CIN_POLL_PARSED', {
          cin: cinValue,
          attempt: attempt + 1,
          taskStatus,
          sourceStatus,
          hasSourcePayload,
          sourceLooksValid,
          positiveByCin,
          currentExplicitNegative,
        });

        // MCA provider responses vary by shape. If task completed and source payload exists,
        // treat it as verified unless it explicitly carries a negative indicator.
        const inferredPositive = completed && hasSourcePayload && !currentExplicitNegative;

        if ((completed && sourceLooksValid) || inferredPositive || positiveByCin) {
          cinVerified = true;
          debugLogVerification('CIN_VERIFICATION_RESULT', {
            cin: cinValue,
            cinVerified: true,
            reason: 'poll_positive',
            attempt: attempt + 1,
          });
          break;
        }

        // If backend explicitly says not found/inactive, stop early.
        if (currentExplicitNegative) {
          explicitNegative = true;
          cinVerified = false;
          debugLogVerification('CIN_VERIFICATION_RESULT', {
            cin: cinValue,
            cinVerified: false,
            explicitNegative: true,
            reason: 'poll_explicit_negative',
            attempt: attempt + 1,
          });
          break;
        }
      }
    }
  } catch (error) {
    console.error('CIN verification error:', error);
  }
  debugLogVerification('CIN_VERIFICATION_RESULT', {
    cin: cinValue,
    cinVerified,
    explicitNegative,
    reason: 'final_return',
  });
  return { cinVerified, explicitNegative };
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
  let explicitNegative = false;
  try {
    const response = await fetch(gstnurl, gstnoptions);
    const result = await response.json();
    debugLogVerification('GST_CREATE_RESPONSE', {
      gstin,
      httpStatus: response.status,
      ok: response.ok,
      result,
    });
    const taskStatus = (result?.status || '').toString().toLowerCase();
    const gstStatus = (result?.result?.source_output?.gstin_status || '').toString().toLowerCase();
    explicitNegative = ['cancelled', 'failed', 'not_found', 'inactive', 'invalid', 'rejected'].includes(taskStatus) ||
      ['cancelled', 'failed', 'not_found', 'inactive', 'invalid', 'rejected'].includes(gstStatus);
    gstnVerified = taskStatus === 'completed' && gstStatus === 'active';
    debugLogVerification('GST_PARSED_RESULT', {
      gstin,
      taskStatus,
      gstStatus,
      gstnVerified,
      explicitNegative,
    });
  } catch (error) {
    console.error('GSTN verification error:', error);
  }
  debugLogVerification('GST_VERIFICATION_RESULT', {
    gstin,
    gstnVerified,
    explicitNegative,
  });
  return { gstnVerified, explicitNegative };
}

// Logic for LLPIN and UDYAM can be added here once RapidAPI endpoints are decided.
// For now, we mark them as pending for manual review or placeholder success.
const llpin_verification = async(llpin) => {
  const value = (llpin || '').trim().toUpperCase();
  const llpinVerified = /^[A-Z]{3}-?\d{4}$/.test(value);
  return { llpinVerified };
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
    const { cin, gstNumber, llpin, udyamNumber, startupIndiaId, registration_type, companyType } = req.body;
    
    // Check if identifying info exists
    const hasAnyId = cin || gstNumber || llpin || udyamNumber || startupIndiaId;
    
    const existing = await StartupVerification.findOne({ userId });
    
    const verificationData = {
      userId,
      ...req.body,
      status: hasAnyId ? "pending" : "unverified",
      submittedAt: new Date()
    };

    const resolveVerificationType = (registrationType, companyTypeValue) => {
      const normalized = (registrationType || companyTypeValue || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[._-]/g, ' ')
        .replace(/\s+/g, ' ');
      if (/(private|pvt|public).*(limited|ltd)/.test(normalized) || /(limited|ltd).*(private|pvt|public)/.test(normalized)) return 'cin';
      if (normalized.includes('llp') || normalized.includes('limited liability partnership')) return 'llpin';
      return 'gstn';
    };

    // Use one identifier by startup type:
    // - Private/Public Limited -> CIN
    // - LLP -> LLPIN
    // - Others -> GSTIN
    const verificationType = resolveVerificationType(registration_type, companyType);
    const cinValue = (cin || '').trim();
    const gstValue = (gstNumber || '').trim();
    const llpinValue = (llpin || '').trim();

    let cinVerified = false;
    let gstnVerified = false;
    let llpinVerified = false;

    if (verificationType === 'cin') {
      if (!cinValue) {
        verificationData.status = 'rejected';
        verificationData.rejectionReason = 'CIN is required for Private/Public Limited companies.';
      } else {
        const cinResult = await cin_verification(cinValue);
        cinVerified = !!cinResult?.cinVerified;
        verificationData.status = cinVerified ? 'verified' : 'rejected';
        verificationData.rejectionReason = cinVerified ? undefined : 'CIN verification failed.';
      }
    } else if (verificationType === 'llpin') {
      if (!llpinValue) {
        verificationData.status = 'rejected';
        verificationData.rejectionReason = 'LLPIN is required for LLP companies.';
      } else {
        const llpinResult = await llpin_verification(llpinValue);
        llpinVerified = !!llpinResult?.llpinVerified;
        verificationData.status = llpinVerified ? 'verified' : 'rejected';
        verificationData.rejectionReason = llpinVerified ? undefined : 'LLPIN verification failed.';
      }
    } else {
      if (!gstValue) {
        verificationData.status = 'rejected';
        verificationData.rejectionReason = 'GSTIN is required for this registration type.';
      } else {
        const gstResult = await gstin_verification(gstValue);
        gstnVerified = !!gstResult?.gstnVerified;
        verificationData.status = gstnVerified ? 'verified' : 'rejected';
        verificationData.rejectionReason = gstnVerified ? undefined : 'GSTIN verification failed.';
      }
    }

    verificationData.verificationType = verificationType;
    verificationData.cinVerified = cinVerified;
    verificationData.gstnVerified = gstnVerified;
    verificationData.llpinVerified = llpinVerified;

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