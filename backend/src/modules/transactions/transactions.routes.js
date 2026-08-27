import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { createTransactionSchema, updateTransactionSchema } from './transactions.schema.js';
import * as controller from './transactions.controller.js';

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', validate(createTransactionSchema), controller.create);
router.put('/:id', validate(updateTransactionSchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
