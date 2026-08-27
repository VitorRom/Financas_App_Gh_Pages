import express from 'express';
import multer from 'multer';
import { importStatement } from '../controllers/imports.js';

const upload = multer({ storage: multer.memoryStorage() });

export default function importRoutes(prisma) {
  const router = express.Router();
  router.post('/statement', upload.single('file'), importStatement(prisma));
  return router;
}
