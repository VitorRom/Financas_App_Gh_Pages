import { Router } from 'express';
import { validate } from '../../shared/middleware/validate.js';
import { purgeSchema } from './maintenance.schema.js';
import * as controller from './maintenance.controller.js';

const router = Router();

router.post('/purge', validate(purgeSchema), controller.purge);

export default router;
