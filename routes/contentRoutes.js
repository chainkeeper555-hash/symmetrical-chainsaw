const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const News = require('../models/News');
const Short = require('../models/Short');
const Video = require('../models/Video');

const visitorSchema = new mongoose.Schema({
    sessionId: String,
    createdAt: { type: Date, default: Date.now }
});

const linkClickSchema = new mongoose.Schema({
    url: String,
    createdAt: { type: Date, default: Date.now }
});

const contactSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
});

const Visitor = mongoose.model('Visitor', visitorSchema);
const LinkClick = mongoose.model('LinkClick', linkClickSchema);
const Contact = mongoose.model('Contact', contactSchema);

router.post('/contact', [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('phone').optional().trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const contact = new Contact({ ...req.body, createdAt: new Date() });
            await contact.save();
            res.status(201).json({ message: 'Message sent successfully!' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
]);

router.get('/contact', async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ createdAt: -1 });
        res.json(contacts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

router.delete('/contact/:id', async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) return res.status(404).json({ message: 'Contact not found' });
        await contact.deleteOne();
        res.json({ message: 'Contact deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

router.get('/news', async (req, res) => {
    try {
        const news = await News.find().sort({ createdAt: -1 });
        res.status(200).json({ news });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/news', [
    body('text').trim().notEmpty().withMessage('News text is required'),
    body('link').optional({ checkFalsy: true }).trim().isURL({ require_protocol: true }).withMessage('Valid URL is required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { text, link } = req.body;
            console.log('Creating news:', { text, link });
            const news = new News({ text, link });
            await news.save();
            res.status(201).json({ message: 'News item added successfully!', news });
        } catch (err) {
            console.error('Error creating news:', err);
            res.status(500).json({ error: 'Failed to add news' });
        }
    }
]);

router.delete('/news/:id', async (req, res) => {
    try {
        const news = await News.findById(req.params.id);
        if (!news) return res.status(404).json({ message: 'News item not found' });
        await news.deleteOne();
        res.json({ message: 'News item deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete news' });
    }
});

router.get('/shorts', async (req, res) => {
    try {
        const shorts = await Short.find().sort({ createdAt: -1 });
        res.status(200).json({ shorts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/shorts', [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('image').trim().isURL({ require_protocol: true }).withMessage('Valid image URL is required'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const { title, description, image } = req.body;
            console.log('Creating short:', { title, description, image });
            const short = new Short({ title, description, image });
            await short.save();
            res.status(201).json({ message: 'Short added successfully!', short });
        } catch (err) {
            console.error('Error creating short:', err);
            res.status(500).json({ error: 'Failed to add short' });
        }
    }
]);

router.delete('/shorts/:id', async (req, res) => {
    try {
        const short = await Short.findById(req.params.id);
        if (!short) return res.status(404).json({ message: 'Short not found' });
        await short.deleteOne();
        res.json({ message: 'Short deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete short' });
    }
});

router.get('/videos', async (req, res) => {
    try {
        const videos = await Video.find().sort({ createdAt: -1 });
        res.status(200).json({ videos });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/trackVisitor', async (req, res) => {
    const { sessionId } = req.body;
    try {
        const visitor = new Visitor({ sessionId });
        await visitor.save();
        res.status(201).json({ message: 'Visitor tracked' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/visitors', async (req, res) => {
    try {
        const visitors = await Visitor.find();
        res.status(200).json(visitors);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/trackLinkClick', async (req, res) => {
    const { url } = req.body;
    try {
        const linkClick = new LinkClick({ url });
        await linkClick.save();
        res.status(201).json({ message: 'Link click tracked' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/link-clicks', async (req, res) => {
    try {
        const linkClicks = await LinkClick.find();
        res.status(200).json(linkClicks);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
