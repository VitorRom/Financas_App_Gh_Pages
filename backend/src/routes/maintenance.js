import { Router } from 'express';
import { purgeData } from '../controllers/maintenance.js';

export default (prisma) => {
  const router = Router();
  router.post('/purge', purgeData(prisma));
  return router;
};

