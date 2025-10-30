// routes/index.js
import express from 'express';
const router = express.Router();

console.log('Mounting API routes');

// PUBLIC (no auth)
router.use('/giveaway', (await import('./giveawayRoutes.js')).default);
router.use('/leaderboard', (await import('./leaderboardRoutes.js')).default);

// PROTECTED (auth applied in server.js)
router.use('/shorts', (await import('./shortsRoutes.js')).default);
router.use('/videos', (await import('./videosRoutes.js')).default);
router.use('/schedule', (await import('./scheduleRoutes.js')).default);
router.use('/reviews', (await import('./reviewRoutes.js')).default);
router.use('/giveaway-content', (await import('./giveawayContentRoutes.js')).default);
router.use('/contact', (await import('./contactRoutes.js')).default);
router.use('/tracking', (await import('./trackingRoutes.js')).default);
router.use('/news', (await import('./newsRoutes.js')).default);

export default router;