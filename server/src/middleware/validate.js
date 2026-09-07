import { ApiError } from '../utils/apiResponse.js';

/**
 * Zod validation middleware.
 * usage: validate(schema) validates req.body; validate(schema, 'query') validates query.
 */
export const validate =
  (schema, source = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    if (source === 'body') req.body = result.data;
    else req.validated = result.data;
    next();
  };
