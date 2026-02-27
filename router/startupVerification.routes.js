// // const express = require('express');
// // const router = express.Router();
// // const startupVerificationController = require('../controller/startupVerification.controller');
// // const protect = require('../middleware/jwttoken.middleware');

// // // Route to submit startup verification details
// // router.post('/', protect, startupVerificationController.submitVerification);

// // // Route for admin to get all verifications
// // router.get('/', protect, startupVerificationController.getVerifications);

// // // Route for admin to approve/reject a verification
// // router.patch('/:id', protect, startupVerificationController.updateVerificationStatus);

// // module.exports = router;





// const express = require('express');
// const router = express.Router();
// const startupVerificationController = require('../controller/startupVerification.controller');
// const protect = require('../middleware/jwttoken.middleware');

// // Route to submit startup verification details
// router.post('/', protect, startupVerificationController.submitVerification);

// // Route for user to check their own verification status
// router.get('/status', protect, startupVerificationController.getMyVerificationStatus);

// // Route for admin to get all verifications
// router.get('/', protect, startupVerificationController.getVerifications);

// // Route for admin to approve/reject a verification
// router.patch('/:id', protect, startupVerificationController.updateVerificationStatus);

// module.exports = router;














const express = require('express');
const router = express.Router();
const startupVerificationController = require('../controller/startupVerification.controller');
const protect = require('../middleware/jwttoken.middleware');



// Route to submit startup verification details
router.post('/', protect, startupVerificationController.submitVerification);

// Route for user to check their own verification status
router.get('/status', protect, startupVerificationController.getMyVerificationStatus);

// Route for admin to get all verifications
router.get('/', protect, startupVerificationController.getVerifications);

// Route for admin to approve/reject a verification
router.patch('/:id', protect, startupVerificationController.updateVerificationStatus);

module.exports = router;