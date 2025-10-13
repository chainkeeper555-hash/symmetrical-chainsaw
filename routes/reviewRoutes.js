const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// GET reviews by type (slot or casino)
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || !['slot', 'casino'].includes(type)) {
      return res.status(400).json({ message: 'Invalid or missing review type' });
    }

    const reviews = await Review.find({ type })
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(10); // Limit to 10 reviews for performance

    res.status(200).json({ reviews });
  } catch (error) {
    console.error(`Error fetching ${req.query.type} reviews:`, error);
    res.status(500).json({ message: 'Error fetching reviews', details: error.message });
  }
});

// POST create a new review (with image upload)
router.post('/', async (req, res) => {
  try {
    const { title, type, rating, description, image } = req.body;

    // Validate input
    if (!title || !type || !rating || !description || !image) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!['slot', 'casino'].includes(type)) {
      return res.status(400).json({ message: 'Invalid review type' });
    }
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Handle base64 image upload to Cloudinary
    let imageUrl = image;
    if (image.startsWith('data:image/')) {
      const match = image.match(/^data:image\/(\w+);base64,/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid base64 image header' });
      }
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'streamerpulse/reviews', resource_type: 'image' },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        Readable.from(buffer).pipe(stream);
      });
      imageUrl = result.secure_url;
    }

    const review = new Review({
      title,
      type,
      image: imageUrl,
      rating,
      description
    });

    await review.save();
    res.status(201).json({ message: 'Review created successfully', review });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Error creating review', details: error.message });
  }
});

// PUT update a review by ID
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, rating, description, image } = req.body;

    // Validate input
    if (!title || !type || !rating || !description || !image) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (!['slot', 'casino'].includes(type)) {
      return res.status(400).json({ message: 'Invalid review type' });
    }
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Handle base64 image upload to Cloudinary if provided
    let imageUrl = image;
    if (image.startsWith('data:image/')) {
      const match = image.match(/^data:image\/(\w+);base64,/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid base64 image header' });
      }
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'streamerpulse/reviews', resource_type: 'image' },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        Readable.from(buffer).pipe(stream);
      });
      imageUrl = result.secure_url;
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { title, type, image: imageUrl, rating, description, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.status(200).json({ message: 'Review updated successfully', review });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Error updating review', details: error.message });
  }
});

// DELETE a review by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Optionally delete image from Cloudinary (extract public_id from image URL)
    if (review.image) {
      const publicId = review.image.split('/').pop().split('.')[0];
      try {
        await cloudinary.uploader.destroy(`streamerpulse/reviews/${publicId}`);
      } catch (cloudinaryError) {
        console.error('Error deleting image from Cloudinary:', cloudinaryError);
      }
    }

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Error deleting review', details: error.message });
  }
});

module.exports = router;