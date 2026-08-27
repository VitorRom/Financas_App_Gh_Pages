import { Router } from 'express';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
} from '../controllers/accounts.js';

export default (prisma) => {
  const router = Router();

  router.get('/', getAccounts(prisma));
  router.get('/:id', getAccount(prisma));
  router.post('/', createAccount(prisma));
  router.put('/:id', updateAccount(prisma));
  router.delete('/:id', deleteAccount(prisma));

  return router;
};