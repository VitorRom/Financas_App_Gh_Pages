import { Router } from 'express';
import * as controller from './dashboard.controller.js';

const router = Router();

router.get('/summary', controller.getSummary);
router.get('/monthly', controller.getMonthlyData);

export default router;
