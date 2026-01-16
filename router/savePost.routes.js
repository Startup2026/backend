const express = require('express');
const router = express.Router();
const savePostController = require('../controller/savePostCoontrolller/savePost.controller');
const token__middleware = require('../middleware/jwttoken.middleware');

// POST /sav-posts/:postId
router.post('/sav-posts/:postId', token__middleware, savePostController.savePost);
// GET /sav-posts
router.get('/sav-posts', token__middleware, savePostController.getSavedPosts);  
// DELETE /sav-posts/:postId
router.delete('/sav-posts/:postId', token__middleware, savePostController.removeSavedPost);
module.exports = router;