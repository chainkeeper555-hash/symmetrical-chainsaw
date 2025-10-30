// models/GiveawayEntry.js
const mongoose = require('mongoose');

const giveawayEntrySchema = new mongoose.Schema({
  email:         { type: String, required: true, trim: true, lowercase: true },
  bcUsername:    { type: String, required: true, trim: true },
  bcUserId:      { type: String, required: true, trim: true, unique: true },
  depositAmount: { type: Number, required: true, min: 20, default: 20 },
  prize:         { type: String, trim: true, default: null },
  enteredAt:     { type: Date,   default: Date.now }
});

// Prevent duplicate bcUserId
giveawayEntrySchema.index({ bcUserId: 1 }, { unique: true });
// Optional: index for fast email lookup
giveawayEntrySchema.index({ email: 1 });

module.exports = mongoose.model('GiveawayEntry', giveawayEntrySchema);