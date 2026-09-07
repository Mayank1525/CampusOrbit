import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/apiResponse.js';

export const COOKIE_NAME = 'co_token';

export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export const protect = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized('Please log in to continue');

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not available');

  // Self-heal a legacy inconsistent state: an account that already has an
  // active learning path is, by definition, past onboarding. Older builds
  // wrote these two fields in separate requests, so a dropped second request
  // could strand a student in an /onboarding redirect loop they could not
  // escape. Repair it silently on the next authenticated request.
  if (user.role === 'student' && user.activePathId && !user.onboardingCompleted) {
    user.onboardingCompleted = true;
    await user.save({ validateBeforeSave: false });
  }

  req.user = user;
  next();
});

/** Role guard: authorize('admin') or authorize('admin','senior') */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires role: ${roles.join(' or ')}`));
    }
    next();
  };

/** Verify a socket handshake cookie/token and return the user. */
export async function authenticateSocket(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.id);
    return user && user.isActive ? user : null;
  } catch {
    return null;
  }
}
