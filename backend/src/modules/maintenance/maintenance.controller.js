import * as service from './maintenance.service.js';

export async function purge(req, res, next) {
  try {
    res.json(await service.purge(req.user.id, req.body));
  } catch (error) {
    next(error);
  }
}
