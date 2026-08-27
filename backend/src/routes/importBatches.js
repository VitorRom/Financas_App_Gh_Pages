import { Router } from 'express';
import { listImportBatches, deleteImportBatch } from '../controllers/importBatches.js';

export default (prisma) => {
  const router = Router();
  router.get('/batches', listImportBatches(prisma));
  router.delete('/batches/:id', deleteImportBatch(prisma));
  return router;
};

