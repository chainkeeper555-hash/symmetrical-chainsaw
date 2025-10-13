const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const News = require('../models/News');

router.get('/', async (req, res) => {
    try {
        const news = await News.find().sort({ createdAt: -1 });
        res.status(200).json({ news });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/', [
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

router.delete('/:id', async (req, res) => {
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

module.exports = router;