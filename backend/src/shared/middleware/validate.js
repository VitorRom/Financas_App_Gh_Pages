import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      return next(new AppError(message, 400));
    }

    req.body = result.data;
    next();
  };
}
