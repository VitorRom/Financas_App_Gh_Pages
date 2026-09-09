import { Router } from 'express';
import * as controller from './market.controller.js';

const router = Router();

router.get('/quote/:ticker', controller.getTickerQuote);
router.get('/search', controller.searchMarketAssets);
router.get('/treasury', controller.listTreasuryTitles);
router.post('/refresh-all', controller.refreshAll);
router.get('/indices', controller.getIndices);
router.get('/index-history', controller.getIndexHistory);

export default router;
