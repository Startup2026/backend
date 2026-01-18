const express = require('express');
const router = express.Router();
const post = require('../controller/common/postController/post.controller');
const token__middleware = require('../middleware/jwttoken.middleware');
const uploads = require('../middleware/fileuploads.middleware');

router.post('/create-post', token__middleware, uploads.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), post.createPost);

router.get('/get-all-posts', token__middleware, post.getPosts);
router.get('/get-post/:id', token__middleware, post.getPostById);
router.put('/update-post/:id', token__middleware, uploads.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), post.updatePost);
router.delete('/delete-post/:id', token__middleware, post.deletePost);

module.exports = router;
