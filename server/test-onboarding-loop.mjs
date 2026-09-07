/**
 * Regression suite for the "stuck on onboarding" loop.
 *
 * Symptom: after starting a path the app said the user was already involved in
 * that path, and every route bounced back to /onboarding -- the account could
 * never reach the dashboard.
 *
 * Cause: `activePathId` and `onboardingCompleted` were written by two separate
 * requests. If the second one never landed, the account was left half-onboarded
 * and ProtectedRoute redirected forever.
 *
 * Run: node server/test-onboarding-loop.mjs   (API must be running on :5000)
 */
const B = 'http://localhost:5000/api';

function session() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(B + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return { status: res.status, j: await res.json().catch(() => ({})) };
  };
}

let pass = 0;
let fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log('  ok  ', name);
  } else {
    fail++;
    console.log('  FAIL', name, extra);
  }
};

// /paths is an authenticated route, so sign in first to read the catalogue.
const boot = session();
await boot('POST', '/auth/login', { email: 'student@campusorbit.dev', password: 'Student@123' });
const paths = await boot('GET', '/paths');
const list = paths.j.data.paths || paths.j.data;
const pathA = list[0]._id;
const pathB = list[1]._id;

// ------------------------------------------------- 1. one call completes onboarding
let call = session();
const email = `loop${Date.now()}@campusorbit.dev`;
let r = await call('POST', '/auth/register', { fullName: 'Loop User', email, password: 'Loop@12345' });
t('fresh account starts un-onboarded', r.j.data.user.onboardingCompleted === false);

r = await call('POST', `/paths/${pathA}/start`, { weeklyHours: 10, timelineWeeks: 12 });
t('startPath succeeds', r.status === 201, r.j.message);
t('startPath returns the updated user', Boolean(r.j.data.user), 'no user in payload');
t(
  'startPath completes onboarding atomically',
  r.j.data.user?.onboardingCompleted === true,
  `got ${r.j.data.user?.onboardingCompleted}`
);

// This is the critical assertion: no second request was made, yet the account
// is fully onboarded, so ProtectedRoute will let it through.
r = await call('GET', '/auth/me');
t('user escapes the onboarding redirect', r.j.data.user.onboardingCompleted === true);
t('active path is set', Boolean(r.j.data.user.activePathId));

// ------------------------------------------------- 2. re-login stays escaped
const c2 = session();
r = await c2('POST', '/auth/login', { email, password: 'Loop@12345' });
t('re-login stays onboarded', r.j.data.user.onboardingCompleted === true);

// ------------------------------------------------- 3. restarting is not blocked
r = await c2('POST', `/paths/${pathA}/start`, { weeklyHours: 12, timelineWeeks: 10 });
t('re-starting the same path is allowed', r.status === 201, r.j.message);
t('no "already involved" style rejection', !/already/i.test(r.j.message || ''), r.j.message);

r = await c2('POST', `/paths/${pathB}/start`, { weeklyHours: 12, timelineWeeks: 10 });
t('starting a different path is allowed', r.status === 201, r.j.message);

// ------------------------------------------------- 4. self-heal legacy accounts
// Simulate an account stranded by the OLD two-call flow.
const c3 = session();
const email3 = `legacy${Date.now()}@campusorbit.dev`;
await c3('POST', '/auth/register', { fullName: 'Legacy User', email: email3, password: 'Legacy@123' });
await c3('POST', `/paths/${pathA}/start`, { weeklyHours: 10, timelineWeeks: 12 });
// Force the inconsistent state back on, exactly as the old bug left it.
await c3('PATCH', '/users/profile', { onboardingCompleted: false });

let check = await c3('GET', '/auth/me');
t(
  'stranded account self-heals on next request',
  check.j.data.user.onboardingCompleted === true,
  `still ${check.j.data.user.onboardingCompleted}`
);

console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
