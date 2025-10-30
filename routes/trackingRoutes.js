const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { visitorSchema, linkClickSchema } = require('./schemas');

const Visitor = mongoose.model('Visitor', visitorSchema);
const LinkClick = mongoose.model('LinkClick', linkClickSchema);

router.post('/trackVisitor', async (req, res) => {
  const { sessionId } = req.body;
  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    const visitor = new Visitor({ sessionId });
    await visitor.save();
    res.status(201).json({ message: 'Visitor tracked' });
  } catch (err) {
    console.error('Error saving visitor:', {
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find();
    res.status(200).json(visitors);
  } catch (err) {
    console.error('Error fetching visitors:', {
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/trackLinkClick', async (req, res) => {
  const { url } = req.body;
  try {
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const linkClick = new LinkClick({ url });
    await linkClick.save();
    res.status(201).json({ message: 'Link click tracked' });
  } catch (err) {
    console.error('Error saving link click:', {
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/link-clicks', async (req, res) => {
  try {
    const linkClicks = await LinkClick.find();
    res.status(200).json(linkClicks);
  } catch (err) {
    console.error('Error fetching link clicks:', {
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;