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

    if (!bcUsername || !bcUserId || !email)
      return res.status(400).json({ message: 'All fields are required.' });

    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: 'Invalid email.' });

    const exists = await GiveawayEntry.findOne({
      $or: [{ email: email.toLowerCase() }, { bcUserId }]
    });
    if (exists)
      return res.status(400).json({ message: 'Email or BC User ID already used.' });

    const entry = new GiveawayEntry({
      bcUsername: bcUsername.trim(),
      bcUserId:   bcUserId.trim(),
      email:      email.toLowerCase().trim(),
      depositAmount: 20,
      prize: null
    });

    await entry.save();
    console.log('Entry saved →', entry.email, entry.bcUserId);
    res.json({ success: true, message: 'Entry submitted!' });
  } catch (e) {
    console.error('submitGiveawayEntry error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitSpinResult = async (req, res) => {
  try {
    const { email, prize } = req.body;
    if (!email || !prize)
      return res.status(400).json({ message: 'Email and prize required.' });

    if (!/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ message: 'Invalid email.' });

    const entry = await GiveawayEntry.findOne({ email: email.toLowerCase() });
    if (!entry) return res.status(404).json({ message: 'No entry for this email.' });
    if (entry.prize) return res.status(400).json({ message: 'Already spun.' });

    entry.prize = prize.trim();
    await entry.save();

    console.log('Spin saved →', email, prize);
    res.json({ success: true, message: 'Spin recorded!', prize });
  } catch (e) {
    console.error('submitSpinResult error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ---------- ADMIN (protected) ---------- */
exports.getGiveawayEntries = async (req, res) => {
  try {
    const entries = await GiveawayEntry.find({})
      .select('bcUsername bcUserId email depositAmount prize enteredAt')
      .sort({ enteredAt: -1 });

    res.json({ success: true, count: entries.length, entries });
  } catch (e) {
    console.error('getGiveawayEntries error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};