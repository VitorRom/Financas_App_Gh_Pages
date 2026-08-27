import * as service from './subscriptions.service.js';

export async function getPlans(req, res, next) {
  try {
    res.json(await service.getPlans());
  } catch (error) {
    next(error);
  }
}

export async function getSubscription(req, res, next) {
  try {
    res.json(await service.getSubscription(req.user.id));
  } catch (error) {
    next(error);
  }
}

export async function subscribe(req, res, next) {
  try {
    res.json(await service.subscribe(req.user.id, req.body.planId));
  } catch (error) {
    next(error);
  }
}

export async function cancel(req, res, next) {
  try {
    res.json(await service.cancel(req.user.id));
  } catch (error) {
    next(error);
  }
}
