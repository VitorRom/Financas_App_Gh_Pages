import { Router } from 'express';
import {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transactions.js';

export default (prisma) => {
  const router = Router();

  router.get('/', getTransactions(prisma));
  router.get('/:id', getTransaction(prisma));
  router.post('/', createTransaction(prisma));
  router.put('/:id', updateTransaction(prisma));
  router.delete('/:id', deleteTransaction(prisma));

  return router;
};