import { Router } from 'express';
import { getTickerQuote, refreshAllPrices, getIndices, getIndexHistory } from '../controllers/marketData.js';

export default (prisma) => {
  const router = Router();

  router.get('/quote/:ticker', getTickerQuote());
  router.post('/refresh-all', refreshAllPrices(prisma));
  router.get('/indices', getIndices());
  router.get('/index-history', getIndexHistory(prisma));

  return router;
};
