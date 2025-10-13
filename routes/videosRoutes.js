const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const cloudinary = require('cloudinary').v2;

router.get('/', async (req, res) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.status(200).json({ videos });
  } catch (err) {
    console.error('Error fetching videos:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to fetch videos', details: err.message });
  }
});

router.post('/', async (req, res) => {
  const { title, description, image, imagePublicId, videoUrl } = req.body;
  if (!title || !description || !image || !imagePublicId || !videoUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const video = new Video({ title, description, image, imagePublicId, videoUrl });
    await video.save();
    res.status(201).json({ message: 'Video added successfully' });
  } catch (err) {
    console.error('Error adding video:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to add video', details: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    if (video.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(video.imagePublicId);
        console.log('Cloudinary image deleted:', {
          public_id: video.imagePublicId,
          timestamp: new Date().toISOString()
        });
      } catch (cloudinaryErr) {
        console.error('Error deleting Cloudinary image:', {
          public_id: video.imagePublicId,
          message: cloudinaryErr.message,
          stack: cloudinaryErr.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
    await Video.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (err) {
    console.error('Error deleting video:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to delete video', details: err.message });
  }
});

module.exports = router;