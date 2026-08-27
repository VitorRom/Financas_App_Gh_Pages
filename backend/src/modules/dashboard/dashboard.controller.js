import * as service from './dashboard.service.js';

export async function getSummary(req, res, next) {
  try {
    res.json(await service.getSummary(req.user.id, req.query));
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyData(req, res, next) {
  try {
    res.json(await service.getMonthlyData(req.user.id, req.query.year));
  } catch (error) {
    next(error);
  }
}
