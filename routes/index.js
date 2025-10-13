const express = require('express');
const router = express.Router();

console.log('Mounting API routes');
router.use('/shorts', require('./shortsRoutes'));
router.use('/videos', require('./videosRoutes'));
router.use('/giveaway', require('./giveawayRoutes'));
router.use('/leaderboard', require('./leaderboardRoutes'));
router.use('/schedule', require('./scheduleRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/giveaway-content', require('./giveawayContentRoutes'));
router.use('/contact', require('./contactRoutes'));
router.use('/tracking', require('./trackingRoutes'));
router.use('/news', require('./newsRoutes'));

module.exports = router;