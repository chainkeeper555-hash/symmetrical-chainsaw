const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    date: { type: Date, required: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

const ScheduleEvent = mongoose.model('ScheduleEvent', scheduleSchema);

// GET schedule events
router.get('/', async (req, res) => {
    try {
        const schedule = await ScheduleEvent.find().sort({ date: 1 });
        res.status(200).json(schedule);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST new schedule event
router.post('/', async (req, res) => {
    const { title, date, description } = req.body;
    if (!title || !date) {
        return res.status(400).json({ message: 'Title and date are required' });
    }
    try {
        const event = new ScheduleEvent({ title, date, description });
        await event.save();
        res.status(201).json({ message: 'Event scheduled' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
