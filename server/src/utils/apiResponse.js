/** Consistent API envelope: { success, message, data, meta } */
export function ok(res, data = null, message = 'OK', meta = undefined) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(200).json(payload);
}

export function created(res, data = null, message = 'Created') {
  return res.status(201).json({ success: true, message, data });
}

export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'Not authenticated') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'Not allowed') {
    return new ApiError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new ApiError(409, msg);
  }
}

/** Wrap async controllers so rejected promises reach the error handler. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
