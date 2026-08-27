import { Router } from 'express';
import { updateTransaction, deleteTransaction } from '../controllers/investmentTransactions.js';

export default (prisma) => {
  const router = Router();

  router.put('/:id', updateTransaction(prisma));
  router.delete('/:id', deleteTransaction(prisma));

  return router;
};
