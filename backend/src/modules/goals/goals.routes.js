import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { createGoalSchema, updateInstallmentSchema } from './goals.schema.js';
import * as controller from './goals.controller.js';

const router = Router();

router.get('/', controller.list);
router.post('/', validate(createGoalSchema), controller.create);
router.delete('/:id', controller.remove);
router.patch('/installments/:id', validate(updateInstallmentSchema), controller.updateInstallment);

export default router;
