const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['slot', 'casino'] },
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);