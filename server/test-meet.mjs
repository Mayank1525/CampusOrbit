/**
 * CampusOrbit — Google Meet sessions in Peer Rooms.
 * Run with the API up:  node server/test-meet.mjs
 */
const BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

let pass = 0, fail = 0;
const failures = [];
const check = (n, c, x = '') => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; failures.push(n); console.log(`  ✗ ${n}${x ? ` — ${x}` : ''}`); }
};

async function req(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, body: json };
}

const login = async (email, password) => {
  const r = await req('POST', '/auth/login', { email, password });
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${r.body?.message}`);
  return r.body.data.token;
};

console.log('\n=== CampusOrbit — Google Meet sessions ===\n');

const senior = await login('senior@campusorbit.dev', 'Senior@123');
const student = await login('student@campusorbit.dev', 'Student@123');
const admin = await login('admin@campusorbit.dev', 'Admin@123');
const other = await login('rohan@campusorbit.dev', 'Student@123');

const rooms = await req('GET', '/rooms', null, senior);
const room = rooms.body.data.rooms[0];
console.log(`Using room: ${room.name} (${room._id})\n`);

const soon = new Date(Date.now() + 45 * 60000).toISOString();      // 45 min out
const past = new Date(Date.now() - 3 * 60 * 60000).toISOString();  // 3 h ago
const nowish = new Date(Date.now() + 2 * 60000).toISOString();     // 2 min -> live window

/* 1. Permissions */
console.log('1. Only alumni/admin can host');
{
  const r = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Student tries to host', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledAt: soon,
  }, student);
  check('student cannot create a session -> 403', r.status === 403, `got ${r.status}`);
  check('error explains who may host', /alumni|senior|placement/i.test(r.body?.message || ''), r.body?.message);

  const s = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Senior hosts', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledAt: soon,
  }, senior);
  check('senior CAN create -> 201', s.status === 201, `got ${s.status} ${s.body?.message}`);

  const a = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Admin hosts', meetLink: 'https://meet.google.com/xyz-mnop-qrs', scheduledAt: soon,
  }, admin);
  check('admin CAN create -> 201', a.status === 201, `got ${a.status}`);
}

/* 2. Link validation */
console.log('\n2. Meet link validation');
{
  const bad = [
    ['https://zoom.us/j/123', 'zoom rejected'],
    ['https://evil.com/abc-defg-hij', 'non-google host rejected'],
    ['https://meet.google.com.evil.com/abc-defg-hij', 'lookalike domain rejected'],
    ['https://meet.google.com/short', 'malformed code rejected'],
    ['not a link', 'garbage rejected'],
  ];
  for (const [link, label] of bad) {
    const r = await req('POST', `/rooms/${room._id}/meet`, {
      title: 'Bad link test', meetLink: link, scheduledAt: soon,
    }, senior);
    check(label, r.status === 400, `got ${r.status}`);
  }

  const norm = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Normalisation test', meetLink: 'meet.google.com/qwe-rtyu-iop?authuser=1', scheduledAt: soon,
  }, senior);
  check('bare host + query normalised -> 201', norm.status === 201, `got ${norm.status}`);
}

/* 3. Past date rejected */
console.log('\n3. Scheduling rules');
{
  const r = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Time traveller', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledAt: past,
  }, senior);
  check('past datetime rejected -> 400', r.status === 400, `got ${r.status}`);

  const short = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'X', meetLink: 'https://meet.google.com/abc-defg-hij', scheduledAt: soon,
  }, senior);
  check('too-short title rejected -> 400', short.status === 400, `got ${short.status}`);
}

/* 4. Create the session we will drive */
console.log('\n4. Create a session with seats');
let sid;
{
  const r = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Mock Interview: DSA round with an SDE-2',
    description: 'Live mock interview, arrays and strings. Bring your resume.',
    topic: 'DSA', sessionType: 'mock-interview',
    meetLink: 'https://meet.google.com/mno-pqrs-tuv',
    scheduledAt: soon, durationMinutes: 45, maxSeats: 2,
  }, senior);
  check('created -> 201', r.status === 201, `got ${r.status} ${r.body?.message}`);
  sid = r.body?.data?.session?._id;
  check('returns an id', Boolean(sid));
  check('host auto-RSVP going', r.body?.data?.session?.goingCount === 1, `got ${r.body?.data?.session?.goingCount}`);
  check('host sees isHost', r.body?.data?.session?.isHost === true);
  check('state is scheduled', r.body?.data?.session?.state === 'scheduled', r.body?.data?.session?.state);
}

/* 5. Link privacy */
console.log('\n5. Meet link is not leaked');
{
  const asStudent = await req('GET', `/rooms/meet/${sid}`, null, student);
  check('student sees the session', asStudent.status === 200);
  check('link hidden before RSVP', asStudent.body?.data?.session?.meetLink === null, 'link exposed!');
  check('reason given', /rsvp/i.test(asStudent.body?.data?.session?.linkHiddenReason || ''));
  check('attendee list hidden from students', asStudent.body?.data?.session?.rsvps === undefined);

  const asHost = await req('GET', `/rooms/meet/${sid}`, null, senior);
  check('host sees attendee list', Array.isArray(asHost.body?.data?.session?.rsvps));

  const join = await req('POST', `/rooms/meet/${sid}/join`, null, student);
  check('cannot join before the window -> 400', join.status === 400, `got ${join.status}`);
  check('explains the 10-minute rule', /10 minutes|opens/i.test(join.body?.message || ''), join.body?.message);
}

/* 6. RSVP + seat limit */
console.log('\n6. RSVP and seat limits');
{
  const r1 = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'going' }, student);
  check('student RSVP going -> 200', r1.status === 200, `got ${r1.status}`);
  check('goingCount now 2', r1.body?.data?.session?.goingCount === 2, `got ${r1.body?.data?.session?.goingCount}`);
  check('myRsvp reflected', r1.body?.data?.session?.myRsvp === 'going');
  check('still no link (not live yet)', r1.body?.data?.session?.meetLink === null);

  const r2 = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'going' }, other);
  check('third RSVP blocked (2 seats) -> 400', r2.status === 400, `got ${r2.status}`);
  check('says it is full', /full/i.test(r2.body?.message || ''), r2.body?.message);

  const r3 = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'maybe' }, other);
  check('maybe still allowed -> 200', r3.status === 200, `got ${r3.status}`);

  const r4 = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'not-going' }, student);
  check('change to not-going -> 200', r4.status === 200);
  check('goingCount back to 1', r4.body?.data?.session?.goingCount === 1, `got ${r4.body?.data?.session?.goingCount}`);

  const r5 = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'going' }, student);
  check('re-RSVP going -> 200', r5.status === 200);

  const bad = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'banana' }, student);
  check('invalid status -> 400', bad.status === 400, `got ${bad.status}`);
}

/* 7. Live window + join */
console.log('\n7. Live session and attendance');
let liveId;
{
  const c = await req('POST', `/rooms/${room._id}/meet`, {
    title: 'Doubt clearing: React hooks deep dive',
    meetLink: 'https://meet.google.com/liv-eses-sio',
    scheduledAt: nowish, durationMinutes: 60, sessionType: 'doubt-clearing',
  }, senior);
  liveId = c.body?.data?.session?._id;
  check('session starting in 2 min is live', c.body?.data?.session?.state === 'live', c.body?.data?.session?.state);

  const before = await req('GET', `/rooms/meet/${liveId}`, null, student);
  check('student still needs RSVP for link', before.body?.data?.session?.meetLink === null);

  await req('POST', `/rooms/meet/${liveId}/rsvp`, { status: 'going' }, student);
  const after = await req('GET', `/rooms/meet/${liveId}`, null, student);
  check('link revealed after RSVP + live', typeof after.body?.data?.session?.meetLink === 'string', 'still hidden');
  check('link is the google one', /meet\.google\.com/.test(after.body?.data?.session?.meetLink || ''));
  check('canJoinNow true', after.body?.data?.session?.canJoinNow === true);

  const j = await req('POST', `/rooms/meet/${liveId}/join`, null, student);
  check('join -> 200', j.status === 200, `got ${j.status}`);
  check('join returns the link', /meet\.google\.com/.test(j.body?.data?.meetLink || ''));

  const att = await req('GET', `/rooms/meet/${liveId}/attendance`, null, senior);
  check('host can read attendance', att.status === 200, `got ${att.status}`);
  check('attendance records the student', att.body?.data?.rows?.some((r) => r.attended), 'nobody marked attended');
  check('totals present', typeof att.body?.data?.totals?.attended === 'number');

  const denied = await req('GET', `/rooms/meet/${liveId}/attendance`, null, student);
  check('student cannot read attendance -> 403', denied.status === 403, `got ${denied.status}`);
}

/* 8. Host controls */
console.log('\n8. Host controls');
{
  const notMine = await req('PATCH', `/rooms/meet/${liveId}`, { title: 'Hijacked' }, other);
  check('non-host cannot edit -> 403', notMine.status === 403, `got ${notMine.status}`);

  const upd = await req('PATCH', `/rooms/meet/${liveId}`, { title: 'Doubt clearing: React hooks (updated)' }, senior);
  check('host can edit -> 200', upd.status === 200, `got ${upd.status}`);
  check('title changed', upd.body?.data?.session?.title?.includes('updated'));

  const end = await req('POST', `/rooms/meet/${liveId}/end`, null, senior);
  check('host can end -> 200', end.status === 200, `got ${end.status}`);

  const afterEnd = await req('GET', `/rooms/meet/${liveId}`, null, student);
  check('ended session state', afterEnd.body?.data?.session?.state === 'ended', afterEnd.body?.data?.session?.state);
  check('link hidden after end', afterEnd.body?.data?.session?.meetLink === null);

  const recap = await req('POST', `/rooms/meet/${liveId}/recap`, {
    recapNotes: 'Covered useState, useEffect cleanup, and dependency arrays.',
  }, senior);
  check('host can post recap -> 200', recap.status === 200, `got ${recap.status}`);

  const cancel = await req('DELETE', `/rooms/meet/${sid}`, null, senior);
  check('host can cancel -> 200', cancel.status === 200, `got ${cancel.status}`);
  const cancelled = await req('GET', `/rooms/meet/${sid}`, null, student);
  check('cancelled state visible', cancelled.body?.data?.session?.state === 'cancelled');
  const rsvpDead = await req('POST', `/rooms/meet/${sid}/rsvp`, { status: 'going' }, other);
  check('cannot RSVP a cancelled session -> 400', rsvpDead.status === 400, `got ${rsvpDead.status}`);
}

/* 9. Listing */
console.log('\n9. Listings');
{
  const inRoom = await req('GET', `/rooms/${room._id}/meet`, null, student);
  check('room sessions -> 200', inRoom.status === 200);
  check('returns an array', Array.isArray(inRoom.body?.data?.sessions));
  check('includes our sessions', inRoom.body?.data?.sessions.length >= 2, `got ${inRoom.body?.data?.sessions?.length}`);

  const up = await req('GET', '/rooms/meet/upcoming', null, student);
  check('upcoming -> 200', up.status === 200);
  check('excludes cancelled', !up.body?.data?.sessions?.some((s) => s.state === 'cancelled'));

  const anon = await fetch(`${BASE}/rooms/meet/upcoming`);
  check('requires auth -> 401', anon.status === 401, `got ${anon.status}`);
}

/* 9b. Dedicated section: browse endpoint */
console.log('\n9b. Browse endpoint (Live Sessions section)');
{
  const r = await req('GET', '/rooms/meet/browse', null, student);
  check('browse returns 200', r.status === 200, `got ${r.status}`);
  check('browse ships stats', Boolean(r.body?.data?.stats), 'no stats');
  check('stats have the four counters',
    ['live', 'upcoming', 'myRsvps', 'total'].every((k) => typeof r.body?.data?.stats?.[k] === 'number'));
  check('student canHost is false', r.body?.data?.canHost === false);

  const rs = await req('GET', '/rooms/meet/browse', null, senior);
  check('senior canHost is true', rs.body?.data?.canHost === true);

  const past = await req('GET', '/rooms/meet/browse?scope=past', null, student);
  check('scope=past returns 200', past.status === 200);
  check('scope=past excludes future sessions',
    (past.body?.data?.sessions || []).every((x) => new Date(x.scheduledAt) < new Date()));

  const typed = await req('GET', '/rooms/meet/browse?type=resume-review', null, student);
  check('type filter works',
    (typed.body?.data?.sessions || []).every((x) => x.sessionType === 'resume-review'));

  const q = await req('GET', '/rooms/meet/browse?q=resume', null, student);
  check('search filter works',
    (q.body?.data?.sessions || []).every((x) => /resume/i.test(`${x.title} ${x.topic} ${x.description}`)));

  const hosted = await req('GET', '/rooms/meet/browse?hosted=me', null, senior);
  check('hosted=me returns only my sessions',
    (hosted.body?.data?.sessions || []).every((x) => x.isHost === true));

  // browse must respect the same link-secrecy rule as every other endpoint
  const leaks = (past.body?.data?.sessions || []).filter((x) => x.meetLink && x.state !== 'live');
  check('browse never leaks a link for a non-live session', leaks.length === 0,
    `${leaks.length} leaked`);
}

/* 10. Regression */
console.log('\n10. Existing room routes still work');
{
  const r = await req('GET', `/rooms/${room.slug}`, null, student);
  check('GET /rooms/:slug still resolves', r.status === 200, `got ${r.status}`);
  check('did not collide with /meet routes', r.body?.data?.room?.slug === room.slug);

  const msgs = await req('GET', `/rooms/${room._id}/messages`, null, student);
  check('messages endpoint intact', msgs.status === 200, `got ${msgs.status}`);

  const list = await req('GET', '/rooms', null, student);
  check('room list intact', list.status === 200 && Array.isArray(list.body?.data?.rooms));
}

/* ── cleanup: remove sessions this suite created so the DB stays seed-clean ── */
{
  const mongoose = (await import('mongoose')).default;
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusorbit';
  await mongoose.connect(uri);
  const r = await mongoose.connection.db.collection('meetsessions').deleteMany({
    title: { $in: ['Senior hosts', 'Admin hosts', 'Normalisation test', 'Doubt clearing: React hooks (updated)'] },
  });
  const c = await mongoose.connection.db.collection('meetsessions').deleteMany({
    title: 'Mock Interview: DSA round with an SDE-2', status: 'cancelled',
  });
  await mongoose.disconnect();
  console.log(`\n  (cleanup: removed ${r.deletedCount + c.deletedCount} test sessions)`);
}

console.log(`\n${'─'.repeat(56)}`);
console.log(`  ${pass} passed / ${fail} failed`);
if (fail) { console.log('\n  Failures:'); failures.forEach((f) => console.log(`    - ${f}`)); }
console.log(`${'─'.repeat(56)}\n`);
process.exit(fail ? 1 : 0);
