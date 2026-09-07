// Login as the seeded student, then hit every API the client pages call.
const BASE = 'http://127.0.0.1:5000/api';
let cookie = '';
const req = async (path, opts = {}) => {
  const r = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) },
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
};

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const login = await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'student@campusorbit.dev', password: 'Student@123' }) });
check('login', login.status === 200);

const endpoints = [
  ['/dashboard/student', 'Dashboard'],
  ['/dashboard/charts', 'Progress charts'],
  ['/paths', 'PathNavigator list'],
  ['/paths/my-progress', 'MyPath progress'],
  ['/notes/mine', 'Notes'],
  ['/revisions', 'Revision tasks'],
  ['/video-queue', 'VideoQueue'],
  ['/opportunities?limit=48', 'Opportunities'],
  ['/opportunities/bookmarks', 'Bookmarks'],
  ['/applications/mine', 'Applications'],
  ['/resumes', 'ResumeStudio'],
  ['/documents', 'Documents'],
  ['/documents/proof-of-work', 'Proof of work'],
  ['/interview/questions?limit=30', 'Interview questions'],
  ['/interview/attempts', 'Interview attempts'],
  ['/rooms', 'Rooms'],
  ['/notifications', 'Notifications'],
  ['/users/stats', 'Profile stats'],
  ['/quizzes/attempts/mine', 'Quiz attempts'],
  ['/notes/ai-status', 'AI status'],
];
console.log('\n-- GET endpoints used by client pages --');
for (const [p, name] of endpoints) {
  const r = await req(p);
  check(`${name} (${p})`, r.status === 200 && r.body.success, `-> ${r.status} ${JSON.stringify(r.body).slice(0,140)}`);
}

console.log('\n-- deep resources --');
const paths = (await req('/paths')).body.data.paths;
const p1 = await req(`/paths/${paths[0]._id}`);
check('path detail', p1.status === 200 && p1.body.data.milestones.length > 0);
const ms = p1.body.data.milestones[0];
const mm = await req(`/paths/milestone/${ms._id}`);
check('milestone detail (MilestonePanel)', mm.status === 200 && Array.isArray(mm.body.data.lessons), `-> ${mm.status}`);
const lid = ms.lessons[0]._id;
const les = await req(`/lessons/${lid}`);
check('lesson detail', les.status === 200 && les.body.data.lesson.primaryVideo?.youtubeVideoId);
check('lesson has navigation', Boolean(les.body.data.navigation));
const opps = (await req('/opportunities?limit=5')).body.data.opportunities;
const od = await req(`/opportunities/${opps[0]._id}`);
check('opportunity detail + eligibility', od.status === 200 && od.body.data.eligibilityResult);
check('opportunity checklist', Array.isArray(od.body.data.checklist));
const rooms = (await req('/rooms')).body.data.rooms;
const rd = await req(`/rooms/${rooms[0].slug}`);
check('room detail by slug', rd.status === 200 && Array.isArray(rd.body.data.messages), `-> ${rd.status}`);
const rs = await req(`/rooms/${rooms[0]._id}/summary`);
check('room AI summary', rs.status === 200, `-> ${rs.status}`);
const resumes = (await req('/resumes')).body.data.resumes;
check('resume has completenessScore', typeof resumes[0].completenessScore === 'number');
const apps = (await req('/applications/mine')).body.data.applications;
if (apps.length) {
  const ad = await req(`/applications/${apps[0]._id}`);
  check('application detail + timeline', ad.status === 200 && Array.isArray(ad.body.data.application.timeline), `-> ${ad.status}`);
}
const vq = await req('/video-queue/validate', { method: 'POST', body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }) });
check('video URL validation', vq.status === 200 && vq.body.data.videoId === 'dQw4w9WgXcQ', `-> ${vq.status}`);
const rec = await req('/paths/recommend', { method: 'POST', body: JSON.stringify({ goal: 'mern developer', level: 'beginner', weeklyHours: 10, timelineWeeks: 12 }) });
check('path recommend', rec.status === 200 && rec.body.data.recommended, `-> ${rec.status}`);

console.log(`\n${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
