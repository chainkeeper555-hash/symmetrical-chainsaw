const Schedule = require('../models/Schedule');

exports.getSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.find();
    res.status(200).json({ schedule });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ message: 'Server error' });
  }
};