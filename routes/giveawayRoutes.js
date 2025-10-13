const express = require('express');
const router = express.Router();
const GiveawayEntry = require('../models/GiveawayEntry');

router.get('/entries', async (req, res) => {
  try {
    const entries = await GiveawayEntry.find();
    res.status(200).json({ entries }); // Return { entries: [...] } for consistency
  } catch (error) {
    console.error('Error fetching giveaway entries:', {
      message: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: 'Server error' }); // Changed 'error' to 'message'
  }
});

router.post('/spin-result', async (req, res) => {
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
    console.error('Error submitting spin result:', {
      message: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

module.exports = router;