/**
 * Regression suite for concurrency / duplicate-key handling.
 *
 * Guards the bug where clicking "Start this path" twice (or React StrictMode
 * double-firing in dev) raced two inserts against the unique index on
 * StudentProgress { userId, pathId } and surfaced the nonsensical error
 * "That userId is already in use" to the student.
 *
 * Run: node server/test-race-conditions.mjs   (API must be running on :5000)
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

// ---------------------------------------------- 1. concurrent path start
let call = session();
const email = `race${Date.now()}@campusorbit.dev`;
await call('POST', '/auth/register', { fullName: 'Race Tester', email, password: 'Race@1234' });

const paths = await call('GET', '/paths');
const pathId = (paths.j.data.paths || paths.j.data)[0]._id;

const burst = await Promise.all(
  [1, 2, 3, 4, 5].map(() => call('POST', `/paths/${pathId}/start`, { weeklyHours: 10, timelineWeeks: 12 }))
);
t('5x concurrent startPath all succeed', burst.every((r) => r.status === 201), burst.map((r) => r.status).join(','));
t(
  'no raw field name leaked to the user',
  !burst.some((r) => /That \w+ is already in use/.test(r.j.message || '')),
  burst.map((r) => r.j.message).join(' | ')
);

const prog = await call('GET', '/paths/my-progress');
const rows = (prog.j.data.progress || prog.j.data || []).filter(
  (p) => String(p.pathId?._id || p.pathId) === String(pathId)
);
t('exactly one StudentProgress document created', rows.length === 1, `got ${rows.length}`);

// ---------------------------------------------- 2. re-start is idempotent
const again = await call('POST', `/paths/${pathId}/start`, { weeklyHours: 14, timelineWeeks: 10 });
t('re-starting the same path is idempotent', again.status === 201, again.j.message);

// ---------------------------------------------- 3. duplicate registration
const dup = await call('POST', '/auth/register', { fullName: 'Race Tester', email, password: 'Race@1234' });
t('duplicate email returns 409', dup.status === 409);
t('duplicate email copy is human-readable', /account with this email already exists/i.test(dup.j.message), dup.j.message);

// ---------------------------------------------- 4. simultaneous registration
const c2 = session();
const email2 = `race2${Date.now()}@campusorbit.dev`;
const regs = await Promise.all(
  [1, 2].map(() => c2('POST', '/auth/register', { fullName: 'Dup Racer', email: email2, password: 'Race@1234' }))
);
t('one concurrent register wins', regs.filter((r) => r.status === 201).length === 1, regs.map((r) => r.status).join(','));
t(
  'index-level collision still yields friendly copy',
  regs.every((r) => r.status === 201 || /account with this email already exists/i.test(r.j.message)),
  regs.map((r) => r.j.message).join(' | ')
);

// ---------------------------------------------- 5. login unaffected
const c3 = session();
const logins = await Promise.all([1, 2, 3].map(() => c3('POST', '/auth/login', { email, password: 'Race@1234' })));
t('3x concurrent login all succeed', logins.every((r) => r.status === 200), logins.map((r) => r.status).join(','));

console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
