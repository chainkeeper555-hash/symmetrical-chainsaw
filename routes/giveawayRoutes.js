// routes/giveawayRoutes.js
import express from 'express';
const router = express.Router();

import {
  getGiveawayContent,
  submitGiveawayEntry,
  submitSpinResult,
  getGiveawayEntries
} from '../controllers/giveawayController.js';

// PUBLIC
router.get('/content', getGiveawayContent);
router.post('/submit-entry', submitGiveawayEntry);
router.post('/spin-result', submitSpinResult);

// ADMIN (add authenticateToken in server.js)
router.get('/entries', getGiveawayEntries);

export default router;