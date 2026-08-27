import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, res, next) => {
    console.log('VALIDATION MIDDLEWARE CALLED');
    const result = schema.safeParse(req.body);
    console.log('Validation result:', result);

    if (!result.success) {
      console.log('Validation failed:', result.error);
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      return next(new AppError(message, 400));
    }

    console.log('Validation passed');
    req.body = result.data;
    next();
  };
}
