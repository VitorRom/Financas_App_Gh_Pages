import * as service from './goals.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json(await service.create(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await service.remove(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function updateInstallment(req, res, next) {
  try {
    res.json(await service.updateInstallment(req.user.id, req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}
