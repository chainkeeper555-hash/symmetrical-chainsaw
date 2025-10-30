const express = require('express');
const router = express.Router();
const Short = require('../models/Short');
const cloudinary = require('cloudinary').v2;

router.get('/', async (req, res) => {
  try {
    const shorts = await Short.find().sort({ createdAt: -1 });
    res.status(200).json({ shorts });
  } catch (err) {
    console.error('Error fetching shorts:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to fetch shorts', details: err.message });
  }
});

router.post('/', async (req, res) => {
  const { title, description, image, imagePublicId, videoUrl } = req.body;
  if (!title || !description || !image || !imagePublicId || !videoUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const short = new Short({ title, description, image, imagePublicId, videoUrl });
    await short.save();
    res.status(201).json({ message: 'Short added successfully' });
  } catch (err) {
    console.error('Error adding short:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to add short', details: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const short = await Short.findById(req.params.id);
    if (!short) {
      return res.status(404).json({ error: 'Short not found' });
    }
    if (short.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(short.imagePublicId);
        console.log('Cloudinary image deleted:', {
          public_id: short.imagePublicId,
          timestamp: new Date().toISOString()
        });
      } catch (cloudinaryErr) {
        console.error('Error deleting Cloudinary image:', {
          public_id: short.imagePublicId,
          message: cloudinaryErr.message,
          stack: cloudinaryErr.stack,
          timestamp: new Date().toISOString()
        });
      }
    }
    await Short.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Short deleted successfully' });
  } catch (err) {
    console.error('Error deleting short:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Failed to delete short', details: err.message });
  }
});

module.exports = router;