const mongoose = require('mongoose');

const giveawayEntrySchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  depositAmount: { type: Number, required: true, min: 0 }, // Allow 0 for spins
  prize: { type: String, trim: true }, // From wheel spin, e.g., "$10", "JACKPOT"
  enteredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GiveawayEntry', giveawayEntrySchema);