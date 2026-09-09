import { Router } from 'express';
import * as controller from './investments.controller.js';

/**
 * Transações de investimento endereçadas pelo próprio id.
 *
 * Criar e listar ficam sob `/investments/:id/transactions`, porque dependem do
 * ativo. Editar e excluir só precisam do id da transação — e o service já confere
 * o dono antes de tocar em qualquer coisa.
 */
const router = Router();

router.put('/:id', controller.updateTransaction);
router.delete('/:id', controller.deleteTransaction);

export default router;
