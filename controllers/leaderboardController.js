const Leaderboard = require('../models/Leaderboard');

exports.getLeaderboard = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    if (!['daily', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }
    const leaderboard = await Leaderboard.find({ period })
      .sort({ rank: 1 })
      .limit(10);
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

exports.addLeaderboardEntry = async (req, res) => {
  try {
    const entry = new Leaderboard(req.body);
    await entry.save();
    res.status(201).json({ message: 'Leaderboard entry added!' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to add leaderboard entry' });
  }
};