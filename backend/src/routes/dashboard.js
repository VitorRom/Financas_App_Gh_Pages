import { Router } from 'express';
import { getSummary, getMonthlyData } from '../controllers/dashboard.js';

export default (prisma) => {
  const router = Router();

  router.get('/summary', getSummary(prisma));
  router.get('/monthly', getMonthlyData(prisma));

  return router;
};