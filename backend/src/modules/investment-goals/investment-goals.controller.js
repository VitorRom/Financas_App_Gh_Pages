import * as service from './investment-goals.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.user.id));
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

export async function getProjection(req, res, next) {
  try {
    res.json(await service.getProjection(req.user.id, req.params.id));
  } catch (error) { next(error); }
}
