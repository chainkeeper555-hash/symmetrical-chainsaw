const News = require('../models/News');
const { body, validationResult } = require('express-validator');

exports.validateNews = [
    body('text').trim().notEmpty().withMessage('News text is required'),
    body('link').optional().trim().isURL().withMessage('Valid URL is required')
];

exports.createNews = async (req, res) => {
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
};