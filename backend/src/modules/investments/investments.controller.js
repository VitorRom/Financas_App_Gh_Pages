import * as service from './investments.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.user.id, req.query));
  } catch (error) { next(error); }
}

export async function getById(req, res, next) {
  try {
    res.json(await service.getById(req.user.id, req.params.id));
  } catch (error) { next(error); }
}

export async function create(req, res, next) {
  try {
    res.status(201).json(await service.create(req.user.id, req.body));
  } catch (error) { next(error); }
}

export async function update(req, res, next) {
  try {
    res.json(await service.update(req.user.id, req.params.id, req.body));
  } catch (error) { next(error); }
}

export async function remove(req, res, next) {
  try {
    await service.remove(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function refreshPrice(req, res, next) {
  try {
    res.json(await service.refreshPrice(req.user.id, req.params.id));
  } catch (error) { next(error); }
}

// Transações
export async function listTransactions(req, res, next) {
  try {
    res.json(await service.listTransactions(req.user.id, req.params.id));
  } catch (error) { next(error); }
}

export async function createTransaction(req, res, next) {
  try {
    res.status(201).json(await service.createTransaction(req.user.id, req.params.id, req.body));
  } catch (error) { next(error); }
}

export async function updateTransaction(req, res, next) {
  try {
    res.json(await service.updateTransaction(req.user.id, req.params.id, req.body));
  } catch (error) { next(error); }
}

export async function deleteTransaction(req, res, next) {
  try {
    await service.deleteTransaction(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) { next(error); }
}

// Summary / Dashboard
export async function getSummary(req, res, next) {
  try {
    res.json(await service.getSummary(req.user.id));
  } catch (error) { next(error); }
}

export async function getEvolution(req, res, next) {
  try {
    const months = parseInt(req.query.months) || 12;
    res.json(await service.getEvolution(req.user.id, months));
  } catch (error) { next(error); }
}

export async function getAllocation(req, res, next) {
  try {
    res.json(await service.getAllocation(req.user.id));
  } catch (error) { next(error); }
}

export async function getDividends(req, res, next) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json(await service.getDividends(req.user.id, year));
  } catch (error) { next(error); }
}

export async function refreshAllPrices(req, res, next) {
  try {
    res.json(await service.refreshAllPrices(req.user.id));
  } catch (error) { next(error); }
}
