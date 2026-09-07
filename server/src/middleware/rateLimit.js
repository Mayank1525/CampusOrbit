import rateLimit from 'express-rate-limit';

const message = (msg) => ({ success: false, message: msg, details: null });

/**
 * Automated suites legitimately fire more auth requests than a human ever
 * would. Rather than weakening the real limits, allow an explicit opt-out that
 * is impossible to enable in production:
 *   - NODE_ENV must NOT be 'production', AND
 *   - E2E_TEST_MODE must be exactly 'true'
 * Both conditions are re-read per request so a stray env var cannot silently
 * disable protection on a deployed server.
 */
const skipForTests = () =>
  process.env.NODE_ENV !== 'production' && process.env.E2E_TEST_MODE === 'true';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipForTests,
  message: message('Too many authentication attempts. Please try again in a few minutes.'),
});

export const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('AI request limit reached. Please wait a moment before generating again.'),
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many requests, slow down a little.'),
});
