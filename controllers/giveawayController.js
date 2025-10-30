// controllers/giveawayController.js
const GiveawayEntry   = require('../models/GiveawayEntry');
const GiveawayContent = require('../models/GiveawayContent');

/* ---------- PUBLIC ---------- */
exports.getGiveawayContent = async (req, res) => {
  try {
    const { type } = req.query;
    if (!['rewards', 'rules'].includes(type))
      return res.status(400).json({ message: 'Invalid type. Use "rewards" or "rules".' });

    const docs = await GiveawayContent.find({ type });
    const items = docs.map(d => ({
      title: d.title,
      description: d.description,
      imageUrl: d.imageUrl || ''
    }));

    res.json({ items });
  } catch (e) {
    console.error('getGiveawayContent error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitGiveawayEntry = async (req, res) => {
  try {
    const { bcUsername, bcUserId, email } = req.body;

    // Validate required fields
    if (!bcUsername || !bcUserId || !email)
      return res.status(400).json({ message: 'All fields are required.' });

    // Validate email format
    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format.' });

    // Normalize
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = bcUsername.trim();
    const normalizedUserId = bcUserId.trim();

    // Prevent duplicates
    const exists = await GiveawayEntry.findOne({
      $or: [
        { email: normalizedEmail },
        { bcUserId: normalizedUserId }
      ]
    });

    if (exists)
      return res.status(400).json({ message: 'Email or BC User ID already registered.' });

    // Create entry
    const entry = new GiveawayEntry({
      email: normalizedEmail,
      bcUsername: normalizedUsername,
      bcUserId: normalizedUserId,
      depositAmount: 20, // Fixed as per schema
      prize: null
    });

    await entry.save();
    console.log('Giveaway entry saved →', entry.email, entry.bcUserId);

    res.json({ 
      success: true, 
      message: 'Entry submitted successfully!' 
    });
  } catch (e) {
    console.error('submitGiveawayEntry error:', e.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

exports.submitSpinResult = async (req, res) => {
  try {
    const { email, prize } = req.body;

    if (!email || !prize)
      return res.status(400).json({ message: 'Email and prize are required.' });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPrize = prize.trim();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail))
      return res.status(400).json({ message: 'Invalid email format.' });

    const entry = await GiveawayEntry.findOne({ email: normalizedEmail });
    if (!entry) 
      return res.status(404).json({ message: 'No entry found for this email.' });

    if (entry.prize) 
      return res.status(400).json({ message: 'You have already spun the wheel.' });

    // Save prize
    entry.prize = normalizedPrize;
    await entry.save();

    console.log('Spin result saved →', normalizedEmail, normalizedPrize);

    res.json({ 
      success: true, 
      message: 'Prize recorded!', 
      prize: normalizedPrize 
    });
  } catch (e) {
    console.error('submitSpinResult error:', e.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ---------- ADMIN (protected) ---------- */
exports.getGiveawayEntries = async (req, res) => {
  try {
    const entries = await GiveawayEntry.find({})
      .select('bcUsername bcUserId email depositAmount prize enteredAt')
      .sort({ enteredAt: -1 })
      .lean();

    res.json({ 
      success: true, 
      count: entries.length, 
      entries 
    });
  } catch (e) {
    console.error('getGiveawayEntries error:', e.message);
    res.status(500).json({ message: 'Server error' });
  }
};