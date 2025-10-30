const mongoose = require('mongoose');

const giveawayContentSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['rewards', 'rules'],
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('GiveawayContent', giveawayContentSchema);