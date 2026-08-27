import { Router } from 'express';
import * as controller from './investments.controller.js';

const router = Router();

// Summary routes (antes de /:id para não conflitar)
router.get('/summary', controller.getSummary);
router.get('/evolution', controller.getEvolution);
router.get('/allocation', controller.getAllocation);
router.get('/dividends', controller.getDividends);

// CRUD
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getById);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Cotação
router.post('/:id/refresh-price', controller.refreshPrice);

// Transações de um investimento
router.get('/:id/transactions', controller.listTransactions);
router.post('/:id/transactions', controller.createTransaction);

export default router;
