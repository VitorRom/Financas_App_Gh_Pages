import express from 'express';
import { getPlans, getSubscription, subscribe, cancelSubscription } from '../controllers/subscriptions.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Rotas públicas
router.get('/plans', getPlans);

// Rotas protegidas
router.get('/', authMiddleware, getSubscription);
router.post('/subscribe', authMiddleware, subscribe);
router.post('/cancel', authMiddleware, cancelSubscription);

export default router;