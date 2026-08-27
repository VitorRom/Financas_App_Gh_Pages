import * as service from './imports.service.js';

export async function importStatement(req, res, next) {
  try {
    const result = await service.importStatement(req.user.id, req.file, req.body.accountId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listBatches(req, res, next) {
  try {
    res.json(await service.listBatches(req.user.id, req.query.accountId));
  } catch (error) {
    next(error);
  }
}

export async function deleteBatch(req, res, next) {
  try {
    res.json(await service.deleteBatch(req.user.id, req.params.id));
  } catch (error) {
    next(error);
  }
}

export async function applyRuleFromTransaction(req, res, next) {
  try {
    res.json(await service.applyRuleFromTransaction(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}
