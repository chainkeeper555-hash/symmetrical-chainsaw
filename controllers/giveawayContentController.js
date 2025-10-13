const mongoose = require('mongoose');
const GiveawayContent = require('../models/GiveawayContent');
const GiveawayEntry = require('./models/GiveawayEntry'); // Adjust path if needed

const giveawayEntrySchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  depositAmount: { type: Number, required: true, min: 20 },
  prize: { type: String, trim: true }, // From wheel spin, e.g., "$10", "JACKPOT"
  enteredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('GiveawayEntry', giveawayEntrySchema);

exports.getGiveawayContent = async (req, res) => {
  try {
    const { type } = req.query;
    if (!['rewards', 'rules'].includes(type)) {
      return res.status(400).json({ message: 'Invalid type parameter. Use "rewards" or "rules".' });
    }
    const content = await GiveawayContent.find({ type });
    const items = content.map(item => ({
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl || ''
    }));
    res.status(200).json({ items });
  } catch (error) {
    console.error(`Error fetching giveaway content (type=${req.query.type}):`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitGiveawayEntry = async (req, res) => {
  try {
    // Placeholder logic (unchanged)
    res.status(200).json({ message: 'Giveaway entry submitted successfully' });
  } catch (error) {
    console.error('Error submitting giveaway entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitSpinResult = async (req, res) => {
  try {
    const { email, prize } = req.body;

    // Validate input
    if (!email || !prize) {
      return res.status(400).json({ message: 'Email and prize are required.' });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    // Check for existing entry with this email
    const existingEntry = await GiveawayEntry.findOne({ email });
    if (existingEntry) {
      return res.status(400).json({ message: 'This email has already been used for a spin.' });
    }

    // Create new giveaway entry
    const newEntry = new GiveawayEntry({
      email: email.toLowerCase(),
      depositAmount: 0, // Placeholder, as deposit isn't confirmed at spin time
      prize,
      enteredAt: new Date()
    });

    // Save to database
    await newEntry.save();
    console.log(`Spin result saved: email=${email}, prize=${prize}`);

    res.status(200).json({ success: true, message: 'Spin result recorded successfully' });
  } catch (error) {
    console.error('Error submitting spin result:', error.message, error.stack);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

exports.getGiveawayEntries = async (req, res) => {
  try {
    // Placeholder logic (unchanged)
    res.status(200).json({ entries: [] });
  } catch (error) {
    console.error('Error fetching giveaway entries:', error);
    res.status(500).json({ message: 'Server error' });
  }
};