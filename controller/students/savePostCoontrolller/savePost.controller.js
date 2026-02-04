const async_handler = require('express-async-handler');
const SavePost = require('../../../models/savePost.model');

const savePost = async_handler(async (req, res) => {
    try {
        const { studentId, postId } = req.body;

        // FIX: Your SavePost model requires 'jobId', even for posts
        const existingSave = await SavePost.findOne({ studentId, jobId: postId });
        
        if (existingSave) {
            return res.status(400).json({ success: false, error: 'Post already saved' });
        }   
        
        const savePost = new SavePost({ 
            studentId, 
            jobId: postId // Mapping postId -> jobId
        });
        
        await savePost.save();
        return res.status(201).json({ success: true, data: savePost });
    } catch (err) {
        console.error("Save Error:", err);
        return res.status(400).json({ success: false, error: err.message });
    }   
});

const getSavedPosts = async_handler(async (req, res) => {
    try {
        const { studentId } = req.body;
        // Populate 'jobId' because that's where the Post ID is stored
        const savedPosts = await SavePost.find({ studentId }).populate('jobId');
        return res.json({ success: true, data: savedPosts });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

const removeSavedPost = async_handler(async (req, res) => {
    try {
        const { postId } = req.params;
        const { studentId } = req.body;
        
        // Find by jobId
        const savedPost = await SavePost.findOneAndDelete({ studentId, jobId: postId });
        
        if (!savedPost) {
            return res.status(404).json({ success: false, error: 'Saved post not found' });
        }
        return res.json({ success: true, data: savedPost });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = { savePost, getSavedPosts, removeSavedPost };