const async_handler = require('express-async-handler');
const SavePost = require('../../../models/savePost.model');

const savePost = async_handler(async (req, res) => {
    try {
        const { studentId, postId } = req.body;
        const existingSave = await SavePost.findOne({ studentId, postId });
        if (existingSave) {
            return res.status(400).json({ success: false, error: 'Post already saved' });
        }   
        const savePost = new SavePost({ studentId, postId });
        await savePost.save();
        return res.status(201).json({ success: true, data: savePost });
    } catch (err) {
        console.error(err);
        return res.status(400).json({ success: false, error: err.message });
    }   
});

/**
 * GET SAVED POSTS
 */
const getSavedPosts = async_handler(async (req, res) => {
    try {
        const { studentId } = req.body;
        if (!studentId) {
            return res.status(400).json({ success: false, error: 'studentId is required' });
        }
        const savedPosts = await SavePost.find({ studentId }).populate('postId');
        return res.json({ success: true, data: savedPosts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * REMOVE SAVED POST
 */
const removeSavedPost = async_handler(async (req, res) => {
    try {
        const { postId } = req.params;
        const { studentId } = req.body;
        if (!postId || !studentId) {
            return res.status(400).json({ success: false, error: 'postId and studentId are required' });
        }
        const savedPost = await SavePost.findOneAndDelete({ studentId, postId });
        if (!savedPost) {
            return res.status(404).json({ success: false, error: 'Saved post not found' });
        }
        return res.json({ success: true, data: savedPost });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = { savePost, getSavedPosts, removeSavedPost };