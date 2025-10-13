const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  username: { type: String, required: true, trim: true },
  userHandle: { type: String, required: true, trim: true }, // e.g., @jwkxd
  betAmount: { type: Number, required: true },
  multiplier: { type: Number, required: true },
  profit: { type: Number, required: true },
  period: { type: String, enum: ['daily', 'monthly'], required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leaderboard', leaderboardSchema);