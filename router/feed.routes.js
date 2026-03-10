const express = require('express');
const router = express.Router();
const feedController = require('../controller/feed.controller');
const tokenMiddleware = require('../middleware/jwttoken.middleware');

// Public Feed? User didn't specify, but "My Posts" implies auth.
// "Validate ownership for edit/delete" implies auth.
// I'll assume feed is authenticated for now as it returns `isLiked`.
router.use(tokenMiddleware);

router.get('/', feedController.getFeed);
router.get('/my-posts', feedController.getMyPosts);

// Interaction endpoints
router.post('/:id/view', feedController.trackView);
router.post('/:id/like', feedController.toggleLike);
router.post('/:id/save', feedController.toggleSave);

module.exports = router;
