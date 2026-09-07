/**
 * Browser suite: (1) Google Sign-In + Forgot Password are fully removed,
 *                (2) the dedicated Live Sessions section works end to end.
 *
 * Requires: API :5000 (E2E_TEST_MODE=true), Vite :5173, DB seeded.
 *
 * SELECTOR NOTE: the room sidebar Tabs render role="tab", NOT role="button".
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
let pass = 0, fail = 0;
const failures = [];
const check = (n, c, x = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; failures.push(n); console.log(`  ✗ ${n}${x ? ` — ${x}` : ''}`); }
};

const browser = await chromium.launch();
const IGNORE = /401 \(Unauthorized\)|favicon|net::ERR/;

async function session(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text());
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 25000 });
  return { page, errs };
}

const api = async (path, opts = {}) => {
  const r = await fetch(`http://127.0.0.1:5000/api${path}`, opts);
  return { status: r.status, body: await r.json().catch(() => null) };
};

console.log('\n=== CampusOrbit — auth removal + Live Sessions ===\n');

/* ══════════ PART 1: removal ══════════ */
console.log('1. Google Sign-In / Forgot Password are gone (server)');
for (const [label, path, method] of [
  ['POST /auth/google', '/auth/google', 'POST'],
  ['POST /auth/forgot-password', '/auth/forgot-password', 'POST'],
  ['POST /auth/reset-password', '/auth/reset-password', 'POST'],
  ['GET  /auth/config', '/auth/config', 'GET'],
]) {
  const r = await api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  });
  check(`${label} → 404`, r.status === 404, `got ${r.status}`);
}
{
  const r = await api('/auth/reset-password/verify?token=abc');
  check('GET  /auth/reset-password/verify → 404', r.status === 404, `got ${r.status}`);
}

console.log('\n2. Login page is clean');
const { page: anon } = await (async () => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  return { page: await ctx.newPage() };
})();
await anon.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await anon.waitForTimeout(1200);
const loginTxt = await anon.locator('body').innerText();
check('no "Continue with Google"', !/continue with google|sign in with google/i.test(loginTxt));
check('no "Forgot password?" link', !/forgot password/i.test(loginTxt));
check('no "or" divider left behind', (await anon.getByText(/^or$/i).count()) === 0);
check('email + password fields still present',
  await anon.locator('#email').isVisible() && await anon.locator('#password').isVisible());
check('Sign in button works', await anon.getByRole('button', { name: /^sign in$/i }).isVisible());

console.log('\n3. Removed routes no longer resolve');
for (const path of ['/forgot-password', '/reset-password']) {
  await anon.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await anon.waitForTimeout(900);
  const t = await anon.locator('body').innerText();
  check(`${path} → 404 page`, /not found|404|lost in space/i.test(t), t.slice(0, 60));
}

await anon.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await anon.waitForTimeout(1000);
check('register page has no Google button',
  !/continue with google|sign up with google/i.test(await anon.locator('body').innerText()));

console.log('\n4. Password login still works');
const { page: student, errs: sErr } = await session('student@campusorbit.dev', 'Student@123');
check('student logged in', !student.url().includes('/login'));

/* ══════════ PART 2: the dedicated section ══════════ */
console.log('\n5. Live Sessions is its own destination');
// The sidebar animates in; isVisible() immediately after login is a false negative.
const navLink = student.getByRole('link', { name: /live sessions/i });
await navLink.waitFor({ state: 'visible', timeout: 15000 });
check('nav link present', await navLink.isVisible());
await navLink.click();
await student.waitForURL('**/live-sessions', { timeout: 15000 });
await student.getByRole('heading', { name: /live sessions/i }).waitFor({ state: 'visible', timeout: 15000 });
await student.waitForTimeout(1800);
check('page renders at /live-sessions', student.url().includes('/live-sessions'));

console.log('\n6. Headline stats');
for (const label of ['Live now', "Upcoming", "You're attending", 'All sessions']) {
  check(`stat "${label}"`, (await student.getByText(label, { exact: false }).count()) > 0);
}

console.log('\n7. Live session hero');
check('"Happening right now" hero', await student.getByText(/happening right now/i).isVisible());
check('live session listed', await student.getByText(/mock interview: dsa round/i).first().isVisible());
check('Join Google Meet available', await student.getByRole('button', { name: /join google meet/i }).first().isVisible());
check('honest disclaimer on page',
  await student.getByText(/calls run on\s*google meet, not inside campusorbit/i).isVisible());

console.log('\n8. Filters');
check('scope controls', (await student.getByRole('button', { name: /^upcoming$/i }).count()) > 0
  && (await student.getByRole('button', { name: /^past$/i }).count()) > 0
  && (await student.getByRole('button', { name: /^all$/i }).count()) > 0);
check('type chips', (await student.getByRole('button', { name: /mock interview/i }).count()) > 0);
check('search box', await student.getByPlaceholder(/search sessions/i).isVisible());

await student.getByRole('button', { name: /^past$/i }).click();
await student.waitForTimeout(1600);
check('Past filter shows ended sessions', /gate dbms|ended|recap/i.test(await student.locator('main').innerText()));

await student.getByRole('button', { name: /^upcoming$/i }).click();
await student.waitForTimeout(1500);
await student.getByPlaceholder(/search sessions/i).fill('resume');
await student.waitForTimeout(1800);
const searched = await student.locator('main').innerText();
check('search narrows results', /resume review clinic/i.test(searched) && !/tcs nqt/i.test(searched));
await student.getByPlaceholder(/search sessions/i).fill('');
await student.waitForTimeout(1600);

console.log('\n9. Students cannot host');
check('no "Host a session" button for student',
  (await student.getByRole('button', { name: /host a session/i }).count()) === 0);
check('no "Hosted by me" filter for student',
  (await student.getByRole('button', { name: /hosted by me/i }).count()) === 0);

console.log('\n10. Alumni can host from the section');
const { page: senior, errs: aErr } = await session('senior@campusorbit.dev', 'Senior@123');
await senior.goto(`${BASE}/live-sessions`, { waitUntil: 'networkidle' });
await senior.getByRole('heading', { name: /live sessions/i }).waitFor({ state: 'visible', timeout: 15000 });
await senior.waitForTimeout(1800);

check('alumni sees "Host a session"', await senior.getByRole('button', { name: /host a session/i }).isVisible());
check('alumni sees "Hosted by me" filter', await senior.getByRole('button', { name: /hosted by me/i }).isVisible());
check('host controls on own live session', await senior.getByText(/host controls/i).first().isVisible());

await senior.getByRole('button', { name: /host a session/i }).click();
await senior.locator('#m-title').waitFor({ state: 'visible', timeout: 10000 });
check('schedule form opens', await senior.locator('#m-link').isVisible());
check('room picker present (section-level hosting)', await senior.locator('#m-room').isVisible());
check('room picker is populated', (await senior.locator('#m-room option').count()) >= 4);

console.log('\n11. Meet-link validation');
const submit = senior.getByRole('button', { name: /schedule session/i });
await senior.locator('#m-title').fill('Playwright: Section Hosting Test');
const when = new Date(Date.now() + 4 * 3600000);
await senior.locator('#m-when').fill(
  new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
);
await senior.locator('#m-link').fill('https://zoom.us/j/999');
await senior.waitForTimeout(600);
check('Zoom link rejected', await submit.isDisabled());
await senior.locator('#m-link').fill('https://meet.google.com/abc-defg-hij');
await senior.waitForTimeout(600);
check('valid Meet link accepted', !(await submit.isDisabled()));

console.log('\n12. Create → appears → cross-user visible');
await submit.click();
await senior.waitForTimeout(3000);
check('form closed', (await senior.locator('#m-title').count()) === 0);
check('new session visible to host',
  await senior.getByText(/playwright: section hosting test/i).first().isVisible());

await senior.getByRole('button', { name: /hosted by me/i }).click();
await senior.waitForTimeout(1800);
check('"Hosted by me" includes it',
  await senior.getByText(/playwright: section hosting test/i).first().isVisible());

await student.reload({ waitUntil: 'networkidle' });
await student.waitForTimeout(2500);
check('student sees the new session',
  await student.getByText(/playwright: section hosting test/i).first().isVisible());

console.log('\n13. Rooms page still links in');
await student.goto(`${BASE}/rooms`, { waitUntil: 'networkidle' });
await student.waitForTimeout(2200);
check('strip still on /rooms', await student.getByText(/live sessions with alumni/i).isVisible());
check('"See all" links to the section',
  await student.getByRole('link', { name: /see all/i }).isVisible());
check('room Callout mentions Google Meet',
  /google meet/i.test(await student.locator('main').innerText()));

console.log('\n14. Room Live tab still works');
await student.goto(`${BASE}/rooms/dsa-arrays-and-strings`, { waitUntil: 'networkidle' });
const tab = student.getByRole('tab', { name: 'Live' });
await tab.waitFor({ state: 'visible', timeout: 20000 });
await tab.click();
await student.waitForTimeout(1800);
check('in-room panel intact', await student.getByText('Live Sessions').first().isVisible());
check('in-room session listed', await student.getByText(/mock interview: dsa round/i).first().isVisible());

console.log('\n15. Console health');
const all = [...sErr, ...aErr];
check('no unexpected JS errors', all.length === 0, all.slice(0, 3).join(' | '));

await senior.screenshot({ path: 'shots/live-host.png', animations: 'disabled', timeout: 15000 }).catch(() => {});
await browser.close();

console.log(`\n${'─'.repeat(58)}`);
console.log(`  ${pass} passed / ${fail} failed`);
if (fail) { console.log('\n  Failures:'); failures.forEach((f) => console.log(`    - ${f}`)); }
console.log(`${'─'.repeat(58)}\n`);
process.exit(fail ? 1 : 0);
