import { ApiError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details || null;

  // Mongoose validation
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Duplicate key (unique index violation).
  //
  // Never leak raw schema field names at the user. "That userId is already in
  // use" is meaningless to a student -- the collection tells us what actually
  // happened, so translate it into a sentence a human can act on.
  if (err.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    const collection = err.message?.match(/collection: \S+\.(\w+)/)?.[1] || '';

    const BY_COLLECTION = {
      users: 'An account with this email already exists. Try signing in instead.',
      studentprogresses: 'You are already enrolled in this learning path.',
      applications: 'You have already applied to this opportunity.',
      videoqueueitems: 'This video is already in your queue.',
      learningpaths: 'A learning path with this name already exists.',
      peerrooms: 'A room with this name already exists.',
    };

    if (BY_COLLECTION[collection]) {
      message = BY_COLLECTION[collection];
    } else if (fields.includes('email')) {
      message = 'An account with this email already exists. Try signing in instead.';
    } else if (fields.includes('slug')) {
      message = 'Something with that name already exists. Pick a different name.';
    } else {
      message = 'That record already exists.';
    }

    // Keep the technical detail for developers without showing it in the copy.
    details = env.NODE_ENV === 'development' ? { duplicateKey: err.keyValue || null } : null;
  }

  // Bad ObjectId
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    success: false,
    message,
    details,
    ...(env.NODE_ENV === 'development' && status >= 500 ? { stack: err.stack } : {}),
  });
}
