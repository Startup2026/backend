const express = require("express");
const router = express.Router();

const {
  likePost,
  unlikePost,
  addComment,
  deleteComment,
} = require("../controller/common/postController/review");

// OPTIONAL: auth middleware if required
const token__middleware = require("../middleware/jwttoken.middleware");

/**
 * Base route example:
 * /api/interactions
 */

/**
 * LIKE a post or pitch
 * POST /api/interactions/like/:pitch_post_id
 */
router.post(
  "/like/:postId",
  token__middleware,   // remove if not needed
  likePost
);

/**
 * UNLIKE a post or pitch
 * POST /api/interactions/unlike/:pitch_post_id
 */
router.post(
  "/unlike/:postId",
  token__middleware,
  unlikePost
);

/**
 * ADD COMMENT to post or pitch
 * POST /api/interactions/comment/:pitch_post_id
 * Body: { text }
 */
router.post(
  "/comment/:postId",
  token__middleware,
  addComment
);

/**
 * DELETE COMMENT
 * DELETE /api/interactions/comment/:pitch_post_id/:commentId
 */ 
router.delete(
  "/comment/:postId/:commentId",
  token__middleware,
  deleteComment
);

module.exports = router;
