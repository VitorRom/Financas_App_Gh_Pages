import { Router } from 'express';
import { authMiddleware } from '../../shared/middleware/auth.js';
import * as controller from './subscriptions.controller.js';

const router = Router();

router.get('/plans', controller.getPlans);
router.get('/', authMiddleware, controller.getSubscription);
router.post('/subscribe', authMiddleware, controller.subscribe);
router.post('/cancel', authMiddleware, controller.cancel);

export default router;
