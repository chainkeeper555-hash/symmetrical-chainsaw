const Review = require('../models/Review');

exports.getReviews = async (req, res) => {
  try {
    const { type } = req.query;
    const query = type ? { type } : {};
    const reviews = await Review.find(query);
    res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};