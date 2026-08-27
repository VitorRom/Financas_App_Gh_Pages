import { Router } from 'express';
import {
  listInvestments, getInvestment, createInvestment,
  updateInvestment, deleteInvestment, refreshPrice,
  getSummary, getEvolution, getAllocation, getDividends,
} from '../controllers/investments.js';
import {
  listTransactions, createTransaction,
} from '../controllers/investmentTransactions.js';

export default (prisma) => {
  const router = Router();

  // Rotas de resumo (antes de /:id para não conflitar)
  router.get('/summary', getSummary(prisma));
  router.get('/evolution', getEvolution(prisma));
  router.get('/allocation', getAllocation(prisma));
  router.get('/dividends', getDividends(prisma));

  // CRUD de investimentos
  router.get('/', listInvestments(prisma));
  router.post('/', createInvestment(prisma));
  router.get('/:id', getInvestment(prisma));
  router.put('/:id', updateInvestment(prisma));
  router.delete('/:id', deleteInvestment(prisma));

  // Atualizar cotação de um ativo
  router.post('/:id/refresh-price', refreshPrice(prisma));

  // Transações de um investimento
  router.get('/:id/transactions', listTransactions(prisma));
  router.post('/:id/transactions', createTransaction(prisma));

  return router;
};
