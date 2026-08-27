import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { createAccountSchema, updateAccountSchema } from './accounts.schema.js';
import * as controller from './accounts.controller.js';

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/balance', controller.getBalance);
router.post('/', validate(createAccountSchema), controller.create);
router.put('/:id', validate(updateAccountSchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
