import { z } from 'zod';
import User from '../models/User.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { notify } from '../services/notification.service.js';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['student', 'admin', 'senior']).optional().default('student'),
});

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const AVATAR_COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#34d399', '#fb7185', '#818cf8'];

function publicUser(user) {
  const obj = user.toObject({ virtuals: true });
  delete obj.password;
  return obj;
}

/**
 * Advance the login streak.
 */
function applyLoginStreak(user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = user.streak?.lastActiveDate ? new Date(user.streak.lastActiveDate) : null;
  if (last) last.setHours(0, 0, 0, 0);
  const dayMs = 86400000;

  if (!last) {
    user.streak = {
      current: 1,
      longest: Math.max(1, user.streak?.longest || 0),
      lastActiveDate: today,
    };
    return;
  }

  const diff = Math.round((today - last) / dayMs);
  if (diff === 1) {
    const current = (user.streak.current || 0) + 1;
    user.streak = {
      current,
      longest: Math.max(current, user.streak.longest || 0),
      lastActiveDate: today,
    };
  } else if (diff > 1) {
    user.streak = { current: 1, longest: user.streak.longest || 1, lastActiveDate: today };
  }
}

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role } = req.body;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw ApiError.conflict('An account with this email already exists');

  // Admin accounts cannot be self-registered in the demo build.
  const safeRole = role === 'admin' ? 'student' : role;

  const user = await User.create({
    fullName,
    email,
    password,
    role: safeRole,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  });

  const token = signToken(user);
  setAuthCookie(res, token);

  await notify({
    userId: user._id,
    type: 'profile-incomplete',
    title: 'Welcome to CampusOrbit 🚀',
    body: 'Finish your onboarding so we can recommend the right learning path for you.',
    link: '/onboarding',
    icon: 'sparkles',
    priority: 'high',
    dedupeKey: 'welcome',
  });

  return created(res, { user: publicUser(user), token }, 'Account created');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  // Google-only account with no password yet: say so instead of a blank 401,
  // otherwise the user has no idea why correct-looking details keep failing.
  if (!user.hasPassword()) {
    throw ApiError.unauthorized(
      'This account was created with Google. Use "Continue with Google", or reset your password to set one.'
    );
  }

  const match = await user.comparePassword(password);
  if (!match) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');

  user.lastLoginAt = new Date();
  applyLoginStreak(user);

  await user.save({ validateBeforeSave: false });

  const token = signToken(user);
  setAuthCookie(res, token);

  const fresh = await User.findById(user._id);
  return ok(res, { user: publicUser(fresh), token }, 'Logged in');
});

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  return ok(res, null, 'Logged out');
});

export const me = asyncHandler(async (req, res) => {
  return ok(res, { user: publicUser(req.user) }, 'Current user');
});
