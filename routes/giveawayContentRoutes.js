const express = require('express');
const router = express.Router();
const GiveawayContent = require('../models/GiveawayContent');

router.get('/', async (req, res) => {
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
});

module.exports = router;