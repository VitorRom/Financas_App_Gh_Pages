import { Router } from 'express';
import multer from 'multer';
import * as controller from './imports.controller.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/statement', upload.single('file'), controller.importStatement);
router.get('/batches', controller.listBatches);
router.delete('/batches/:id', controller.deleteBatch);

export default router;
