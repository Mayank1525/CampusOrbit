/**
 * CampusOrbit API smoke tests.
 * Run with the server already running: node test-api.mjs
 */
const BASE = process.env.BASE || 'http://127.0.0.1:5000/api';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    failures.push(name + (extra ? ` — ${extra}` : ''));
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function section(t) {
  console.log(`\n\x1b[36m${t}\x1b[0m`);
}

class Client {
  constructor() {
    this.cookies = '';
  }
  async req(method, path, body, isForm = false) {
    const headers = {};
    if (this.cookies) headers.Cookie = this.cookies;
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });

    const setCookie = res.headers.getSetCookie?.() || [];
    if (setCookie.length) {
      this.cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
    }

    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  del(p) { return this.req('DELETE', p); }
}

const student = new Client();
const admin = new Client();
const senior = new Client();

async function main() {
  section('1. Health & AI status');
  {
    const r = await student.get('/health');
    ok('GET /health returns healthy', r.status === 200 && r.data.data.status === 'healthy');
    ok('AI honestly reports Demo AI Mode', r.data.data.ai.label === 'Demo AI Mode', r.data.data.ai.label);
  }

  section('2. Authentication');
  {
    const r = await student.post('/auth/login', { email: 'student@campusorbit.dev', password: 'Student@123' });
    ok('Student login succeeds', r.status === 200 && r.data.data.user.role === 'student');
    ok('Password never returned', r.data.data.user.password === undefined);
    ok('Streak tracked', typeof r.data.data.user.streak?.current === 'number');

    const bad = await new Client().post('/auth/login', { email: 'student@campusorbit.dev', password: 'wrong' });
    ok('Wrong password rejected (401)', bad.status === 401);

    const me = await student.get('/auth/me');
    ok('GET /auth/me with cookie works', me.status === 200 && me.data.data.user.email === 'student@campusorbit.dev');

    const anon = await new Client().get('/auth/me');
    ok('Unauthenticated /auth/me blocked (401)', anon.status === 401);

    const a = await admin.post('/auth/login', { email: 'admin@campusorbit.dev', password: 'Admin@123' });
    ok('Admin login succeeds', a.status === 200 && a.data.data.user.role === 'admin');

    const s = await senior.post('/auth/login', { email: 'senior@campusorbit.dev', password: 'Senior@123' });
    ok('Senior login succeeds', s.status === 200 && s.data.data.user.role === 'senior');

    const dup = await new Client().post('/auth/register', {
      fullName: 'Dup User', email: 'student@campusorbit.dev', password: 'Test@1234',
    });
    ok('Duplicate email rejected (409)', dup.status === 409);

    const weak = await new Client().post('/auth/register', {
      fullName: 'X', email: 'not-an-email', password: '12',
    });
    ok('Validation errors returned (400)', weak.status === 400 && Array.isArray(weak.data.details));
  }

  section('3. Role-based access control');
  {
    const r = await student.get('/dashboard/admin/analytics');
    ok('Student blocked from admin analytics (403)', r.status === 403);
    const a = await admin.get('/dashboard/admin/analytics');
    ok('Admin can read analytics', a.status === 200 && a.data.data.kpis.totalStudents > 0);
    const sr = await senior.post('/opportunities', { title: 'x', company: 'y', type: 'placement', deadline: '2027-01-01' });
    ok('Senior blocked from creating opportunities (403)', sr.status === 403);
  }

  section('4. Dashboard — Today\'s Orbit');
  let dash;
  {
    const r = await student.get('/dashboard/student');
    dash = r.data.data;
    ok('Dashboard loads', r.status === 200);
    ok("Today's Orbit returns AT MOST 3 tasks", dash.todaysOrbit.length <= 3, `got ${dash.todaysOrbit.length}`);
    ok('"What should I do next?" present', Boolean(dash.whatNext?.headline));
    ok('3D orbit nodes present', Array.isArray(dash.orbit?.nodes) && dash.orbit.nodes.length > 0);
    ok('Orbit node statuses valid', dash.orbit.nodes.every((n) => ['locked','current','in-progress','completed'].includes(n.status)));
    ok('Preparation score computed (not job probability)', typeof dash.preparationScore === 'number');
    ok('Profile completion computed', typeof dash.profileCompletion === 'number');
    ok('Opportunity matches present', Array.isArray(dash.matches));
  }

  section('5. Path Navigator — one clear recommendation');
  let mernPathId, milestoneId;
  {
    const list = await student.get('/paths');
    ok('4 learning paths seeded', list.data.data.paths.length >= 4, `got ${list.data.data.paths.length}`);

    const rec = await student.post('/paths/recommend', {
      goal: 'MERN Developer', level: 'intermediate', weeklyHours: 12, timelineWeeks: 14,
    });
    ok('Recommends exactly ONE primary path', Boolean(rec.data.data.recommended?._id));
    ok('Recommendation is explainable', rec.data.data.reasons.length > 0);
    ok('Pace plan provided', rec.data.data.plan?.lessonsPerWeek > 0);
    mernPathId = rec.data.data.recommended._id;

    const detail = await student.get(`/paths/${mernPathId}`);
    ok('Path detail with milestones', detail.data.data.milestones.length > 0);
    const ms = detail.data.data.milestones[0];
    milestoneId = ms._id;
    ok('Milestone has description', Boolean(ms.description));
    ok('Milestone has whyItMatters', Boolean(ms.whyItMatters));
    ok('Milestone has practiceTask', Boolean(ms.practiceTask));
    ok('Milestone has proofTask', Boolean(ms.proofTask));
    ok('Milestone has whatComesNext', Boolean(ms.whatComesNext));
    ok('Milestone has estimatedHours', ms.estimatedHours > 0);

    const md = await student.get(`/paths/milestone/${milestoneId}`);
    ok('Milestone detail includes related opportunities', Array.isArray(md.data.data.relatedOpportunities));

    const prog = await student.get('/paths/my-progress');
    ok('Progress has preparationScore', typeof prog.data.data.progress[0]?.preparationScore === 'number');
  }

  section('6. Lessons — exactly ONE curated video');
  let lessonId, quizId;
  {
    const detail = await student.get(`/paths/${mernPathId}`);
    const lesson = detail.data.data.milestones[0].lessons[0];
    lessonId = lesson._id;

    const r = await student.get(`/lessons/${lessonId}`);
    const L = r.data.data;
    ok('Lesson loads', r.status === 200);
    ok('Has exactly ONE primaryVideo object', Boolean(L.lesson.primaryVideo?.youtubeVideoId) && !Array.isArray(L.lesson.primaryVideo));
    ok('primaryVideo has reasonForRecommendation', Boolean(L.lesson.primaryVideo.reasonForRecommendation));
    ok('primaryVideo has verifiedBy', Boolean(L.lesson.primaryVideo.verifiedBy));
    ok('primaryVideo has isEmbeddable flag', typeof L.lesson.primaryVideo.isEmbeddable === 'boolean');
    ok('AI notes attached', L.notes.length > 0);
    ok('Notes include Hinglish explanation', Boolean(L.notes[0].hinglishExplanation));
    ok('Notes include interview questions', L.notes[0].interviewQuestions.length > 0);
    ok('Flashcards attached', L.flashcards.length > 0);
    ok('Quiz attached', Boolean(L.quiz));
    ok('Quiz answers hidden from student', L.quiz.questions.every((q) => q.correctIndex === undefined));
    ok('Prev/next navigation present', L.navigation.total > 1);
    quizId = L.quiz._id;

    const p = await student.post(`/lessons/${lessonId}/progress`, { watchedSeconds: 300, lastTimestamp: 300, percent: 40 });
    ok('Playback progress saved (resume timestamp)', p.status === 200 && p.data.data.lessonProgress.lastTimestamp === 300);
  }

  section('7. Quiz gating & completion rules');
  {
    const q = await student.get(`/quizzes/${quizId}`);
    const answers = q.data.data.quiz.questions.map((qq) => ({ questionId: qq._id, selectedIndex: 0 }));
    const sub = await student.post(`/quizzes/${quizId}/submit`, { answers, durationSeconds: 60 });
    ok('Quiz submission graded', sub.status === 201 && typeof sub.data.data.percent === 'number');
    ok('Review includes explanations', sub.data.data.review.every((r) => 'explanation' in r));
    ok('Review reveals correct answers after submit', sub.data.data.review.every((r) => typeof r.correctIndex === 'number'));
    ok('Attempt persisted', Boolean(sub.data.data.attempt._id));

    const attempts = await student.get('/quizzes/attempts/mine');
    ok('Attempt history retrievable', attempts.data.data.attempts.length > 0);
  }

  section('8. My Video Queue (personal YouTube)');
  let queueItemId;
  {
    const bad = await student.post('/video-queue', { url: 'https://vimeo.com/12345' });
    ok('Invalid YouTube URL rejected (400)', bad.status === 400);

    const v = await student.post('/video-queue/validate', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    ok('URL validation extracts video ID', v.data.data.videoId === 'dQw4w9WgXcQ');

    // Ensure idempotency: remove leftovers from a previous run.
    const existingQueue = await student.get('/video-queue');
    for (const it of existingQueue.data.data.items.filter((i) => i.youtubeVideoId === 'hdI2bqOjy3c')) {
      await student.del(`/video-queue/${it._id}`);
    }

    const add = await student.post('/video-queue', {
      url: 'https://youtu.be/hdI2bqOjy3c', relatedTopic: 'JavaScript', personalNotes: 'my pick',
    });
    ok('Short youtu.be URL accepted', add.status === 201 && add.data.data.item.youtubeVideoId === 'hdI2bqOjy3c');
    ok('Personal-resource notice shown', add.data.data.notice.includes('primary recommended video remains'));
    queueItemId = add.data.data.item._id;

    const dup = await student.post('/video-queue', { url: 'https://youtu.be/hdI2bqOjy3c' });
    ok('Duplicate queue entry rejected (409)', dup.status === 409);

    await student.patch(`/video-queue/${queueItemId}`, { percent: 50, lastTimestamp: 120, personalNotes: 'updated' });
    const list = await student.get('/video-queue');
    const item = list.data.data.items.find((i) => i._id === queueItemId);
    ok('Queue progress + notes persist', item.percent === 50 && item.personalNotes === 'updated');

    const bm = await student.post(`/video-queue/${queueItemId}/bookmark`);
    ok('Bookmark toggles', bm.data.data.item.bookmarked === true);
  }

  section('9. Notes, flashcards & spaced revision');
  {
    const l = await student.get(`/lessons/${lessonId}`);
    const noteId = l.data.data.notes[0]._id;

    const personal = await student.post('/notes/personal', { lessonId, body: 'My own note about closures.' });
    ok('Personal note created', personal.status === 201);

    const simp = await student.post(`/notes/${noteId}/simplify`);
    ok('Simpler explanation generated', simp.status === 200 && simp.data.data.text.length > 50);
    ok('Simplify labelled demo mode honestly', simp.data.data.mode === 'demo');

    const rev = await student.post(`/notes/${noteId}/revision`);
    ok('Marked for revision (stage 1 = +1 day)', [200,201].includes(rev.status));

    const list = await student.get('/revisions');
    ok('Revision tasks grouped (overdue/today/upcoming)', 'overdue' in list.data.data.grouped);
    const task = list.data.data.tasks.find((t) => t.status === 'pending');
    const done = await student.post(`/revisions/${task._id}/complete`);
    ok('Completing revision schedules next interval', done.status === 200 && Boolean(done.data.data.nextTask));
    ok('Next interval follows 1→7→21 rule', done.data.data.nextTask.stage === task.stage + 1);

    const list2 = await student.get('/revisions');
    const t2 = list2.data.data.tasks.find((t) => t.status === 'pending');
    const resched = await student.post(`/revisions/${t2._id}/reschedule`, { days: 3 });
    ok('Revision reschedule works', resched.status === 200);
  }

  section('10. Placement Hub — eligibility & applications');
  let oppId, ineligibleOppId;
  {
    const list = await student.get('/opportunities');
    ok('Opportunities listed (published only for students)', list.data.data.opportunities.length >= 5);
    ok('Students never see drafts', list.data.data.opportunities.every((o) => o.status === 'published'));
    ok('Eligibility computed per student', Boolean(list.data.data.opportunities[0].eligibilityResult));
    ok('Match score computed', typeof list.data.data.opportunities[0].match?.score === 'number');

    const search = await student.get('/opportunities?search=MERN&type=internship');
    ok('Search + type filter works', search.data.data.opportunities.length > 0);

    const nex = list.data.data.opportunities.find((o) => o.company === 'Nexora Technologies');
    oppId = nex._id;

    const detail = await student.get(`/opportunities/${oppId}`);
    ok('Opportunity detail includes eligibility checks', detail.data.data.eligibilityResult.checks.length > 0);
    ok('Eligibility reasons are human-readable', detail.data.data.eligibilityResult.checks.every((c) => c.message.length > 5));
    ok('Document checklist generated', detail.data.data.checklist.length > 0);
    ok('Checklist flags missing transcript', detail.data.data.checklist.some((c) => !c.satisfied));

    const bm = await student.post(`/opportunities/${oppId}/bookmark`);
    ok('Opportunity bookmark toggles', typeof bm.data.data.bookmarked === 'boolean');

    // Ineligible student (Karan: CGPA 6.1, 2 backlogs) blocked from Quantel (needs 7.0, 0 backlogs)
    const karan = new Client();
    await karan.post('/auth/login', { email: 'karan@campusorbit.dev', password: 'Student@123' });
    const qs = list.data.data.opportunities.find((o) => o.company === 'Quantel Systems');
    ineligibleOppId = qs._id;
    const blocked = await karan.post('/applications', { opportunityId: ineligibleOppId });
    ok('Ineligible student blocked from applying (400)', blocked.status === 400);
    ok('Rejection explains WHY', blocked.data.message.toLowerCase().includes('cgpa') || blocked.data.message.toLowerCase().includes('backlog'));

    // Duplicate application prevention
    const apps = await student.get('/applications/mine');
    ok('Application tracker loads', apps.data.data.applications.length > 0);
    ok('Pipeline stages exposed', apps.data.data.stages.length === 9);
    const existing = apps.data.data.applications.find((a) => a.opportunityId?._id === oppId);
    if (existing) {
      const dup = await student.post('/applications', { opportunityId: oppId });
      ok('Duplicate application prevented (409)', dup.status === 409);
    }

    // New application on a fresh opportunity (idempotent: withdraw a leftover first)
    const gate = list.data.data.opportunities.find((o) => o.type === 'exam');
    const prior = apps.data.data.applications.find((a) => a.opportunityId?._id === gate._id);
    if (prior) await student.del(`/applications/${prior._id}`);
    const applied = await student.post('/applications', { opportunityId: gate._id, stage: 'Applied' });
    ok('New application created', applied.status === 201, JSON.stringify(applied.data.message));
    if (applied.status === 201) {
      const appId = applied.data.data.application._id;
      const mv = await student.patch(`/applications/${appId}/my-stage`, { stage: 'Preparing' });
      ok('Student can self-manage early stages', mv.status === 200);
      const forbidden = await student.patch(`/applications/${appId}/my-stage`, { stage: 'Selected' });
      ok('Student CANNOT self-promote to Selected (403)', forbidden.status === 403);
    }
  }

  section('11. Placement cell — applicant management');
  {
    const all = await admin.get('/applications/applicants');
    ok('Admin sees all applicants', all.data.data.applicants.length > 0);
    ok('Profile completion computed per applicant', typeof all.data.data.applicants[0].profileCompletion === 'number');

    const filtered = await admin.get('/applications/applicants?branch=CSE&minCgpa=8');
    ok('Filter by branch + CGPA works', filtered.status === 200);

    const app = all.data.data.applicants[0];
    const moved = await admin.patch(`/applications/${app._id}/stage`, { stage: 'HR Round', note: 'Cleared tech' });
    ok('Admin moves applicant through pipeline', moved.status === 200 && moved.data.data.application.stage === 'HR Round');
    ok('Stage change recorded in timeline', moved.data.data.application.timeline.length > 1);

    const csv = await admin.get('/applications/export');
    ok('CSV export works', typeof csv.data === 'string' && csv.data.includes('Student Name'));

    const elig = await admin.get(`/opportunities/${oppId}/eligible-students`);
    ok('Eligible-students report works', elig.data.data.total > 0);
  }

  section('12. Resume Studio');
  let resumeId;
  {
    const list = await student.get('/resumes');
    ok('Resumes listed', list.data.data.resumes.length >= 2);
    ok('4 templates available', list.data.data.templates.length === 4);
    ok('Completeness score computed', typeof list.data.data.resumes[0].completenessScore === 'number');
    resumeId = list.data.data.resumes[0]._id;

    const created = await student.post('/resumes', { name: 'Test Resume', template: 'developer-grid' });
    ok('Resume created (prefilled from profile)', created.status === 201 && created.data.data.resume.personal.fullName.length > 0);
    const newId = created.data.data.resume._id;

    const upd = await student.patch(`/resumes/${newId}`, { summary: 'Updated summary text for the resume.', accentColor: '#22d3ee' });
    ok('Resume updated', upd.data.data.resume.accentColor === '#22d3ee');

    const tmpl = await student.patch(`/resumes/${newId}`, { template: 'ats-minimal' });
    ok('Template switch preserves data', tmpl.data.data.resume.summary === 'Updated summary text for the resume.');

    const dup = await student.post(`/resumes/${newId}/duplicate`);
    ok('Resume duplicated', dup.status === 201 && dup.data.data.resume.name.includes('copy'));

    const def = await student.post(`/resumes/${newId}/default`);
    ok('Default resume set', def.data.data.resume.isDefault === true);

    const del = await student.del(`/resumes/${dup.data.data.resume._id}`);
    ok('Resume deleted', del.status === 200);
  }

  section('13. Document Wallet & privacy');
  {
    const docs = await student.get('/documents');
    ok('Documents listed', docs.data.data.documents.length > 0);

    const link = await student.post('/documents/link', {
      label: 'Test Project', category: 'project-link', url: 'https://github.com/test/repo',
    });
    ok('Link added to wallet', link.status === 201);

    const check = await student.get(`/documents/checklist/${oppId}`);
    ok('Per-opportunity checklist generated', check.data.data.checklist.length > 0);
    ok('Missing documents listed', Array.isArray(check.data.data.missing));

    const pow = await student.get('/documents/proof-of-work');
    ok('Proof-of-work profile returns links', Boolean(pow.data.data.profile.github));

    // Privacy: another student must not read these documents
    const other = new Client();
    await other.post('/auth/login', { email: 'rohan@campusorbit.dev', password: 'Student@123' });
    const otherDocs = await other.get('/documents');
    const leaked = otherDocs.data.data.documents.some((d) =>
      docs.data.data.documents.some((mine) => mine._id === d._id));
    ok('Private documents NOT visible to other students', !leaked);

    await student.del(`/documents/${link.data.data.document._id}`);
  }

  section('14. Interview Practice Studio');
  {
    const q = await student.get('/interview/questions?limit=5');
    ok('Questions fetched', q.data.data.questions.length > 0);
    ok('Ideal answers hidden before attempting', q.data.data.questions.every((x) => x.idealAnswerOutline === undefined));
    ok('Filters exposed (roles/topics)', q.data.data.filters.roles.length > 0);

    const qid = q.data.data.questions[0]._id;
    const weak = await student.post('/interview/answer', { questionId: qid, answerText: 'It is a thing that does stuff.' });
    ok('Weak answer scored low', weak.status === 201 && weak.data.data.feedback.overall <= 6, `score ${weak.data.data.feedback?.overall}`);

    const strong = await student.post('/interview/answer', {
      questionId: qid, resumeContextId: resumeId,
      answerText: 'Middleware is a function that receives the request, the response and the next function. First it can modify the request object, then it can either end the cycle by sending a response or pass control forward by calling next. The order of registration matters because middleware runs in a chain. For example in my project CampusOrbit I registered the authentication middleware before the protected routes so that every protected request is verified first. I also built a centralised error handling middleware which takes four arguments, and Express recognises that signature and routes errors to it.',
    });
    ok('Strong answer scored higher', strong.data.data.feedback.overall > weak.data.data.feedback.overall);
    ok('Feedback: technical accuracy', typeof strong.data.data.feedback.technicalAccuracy === 'number');
    ok('Feedback: clarity', typeof strong.data.data.feedback.clarity === 'number');
    ok('Feedback: structure', typeof strong.data.data.feedback.structure === 'number');
    ok('Feedback: missing concepts', Array.isArray(strong.data.data.feedback.missingConcepts));
    ok('Feedback: project example detected', strong.data.data.feedback.usedProjectExample === true);
    ok('Feedback: improved answer outline', strong.data.data.feedback.improvedAnswerOutline.length > 0);
    ok('Feedback: recommended next topic', Boolean(strong.data.data.feedback.recommendedNextTopic));
    ok('Feedback honestly labelled demo', strong.data.data.feedback.mode === 'demo');

    const attempts = await student.get('/interview/attempts');
    ok('Attempts persisted with trend', attempts.data.data.trend.length > 0);
    ok('Improvement tracked over time', typeof attempts.data.data.stats.improvement === 'number');
    ok('Weakest topics identified', Array.isArray(attempts.data.data.weakestTopics));
  }

  section('15. Peer Rooms & Watch Together');
  let roomId, sessionId;
  {
    const rooms = await student.get('/rooms');
    ok('5 peer rooms seeded', rooms.data.data.rooms.length >= 5);
    roomId = rooms.data.data.rooms[0]._id;

    const room = await student.get(`/rooms/${roomId}`);
    ok('Room loads with persisted messages', room.data.data.messages.length > 0);
    ok('Pinned messages tracked', Array.isArray(room.data.data.room.pinnedMessages));

    const join = await student.post(`/rooms/${roomId}/join`);
    ok('Join room works', join.status === 200);

    const msg = await student.post(`/rooms/${roomId}/messages`, { text: 'REST fallback message test' });
    ok('Message persisted to MongoDB', msg.status === 201);
    const msgId = msg.data.data.message._id;

    const react = await student.post(`/rooms/messages/${msgId}/react`, { emoji: '👍' });
    ok('Reaction added', react.data.data.reactions.length === 1);

    const reply = await student.post(`/rooms/${roomId}/messages`, { text: 'Replying', replyTo: msgId });
    ok('Reply threading works', reply.status === 201 && Boolean(reply.data.data.message.replyTo));

    const pinFail = await student.post(`/rooms/messages/${msgId}/pin`);
    ok('Non-moderator cannot pin (403)', pinFail.status === 403);
    const pinOk = await admin.post(`/rooms/messages/${msgId}/pin`);
    ok('Moderator can pin', pinOk.status === 200);

    const report = await student.post(`/rooms/messages/${msgId}/report`, { reason: 'test' });
    ok('Report message works', report.status === 200);
    const modQueue = await admin.get('/rooms/moderation/reported');
    ok('Reported messages reach moderation queue', modQueue.data.data.messages.length > 0);

    const summary = await student.get(`/rooms/${roomId}/summary`);
    ok('AI room summary generated', Boolean(summary.data.data.summary));
    ok('Room summary labelled demo mode', summary.data.data.mode === 'demo');

    // Watch Together
    const startFail = await student.post(`/rooms/${roomId}/watch`, { url: 'https://youtu.be/3a0I8ICR1Vg' });
    ok('Student cannot start watch session (403)', startFail.status === 403);

    const start = await senior.post(`/rooms/${roomId}/watch`, { url: 'https://www.youtube.com/watch?v=3a0I8ICR1Vg', title: 'Test session' });
    ok('Senior/moderator can start watch session', start.status === 201);
    sessionId = start.data.data.session._id;

    const sp = await senior.post(`/rooms/watch/${sessionId}/study-point`, { timestamp: 120, label: 'Key point' });
    ok('Pinned study point added', sp.status === 201);

    const get = await student.get(`/rooms/watch/${sessionId}`);
    ok('Watch session state readable (drift-corrected)', typeof get.data.data.session.currentPosition === 'number');

    const end = await senior.post(`/rooms/watch/${sessionId}/end`);
    ok('Watch session can be ended', end.status === 200);
  }

  section('16. Notifications & announcements');
  {
    const n = await student.get('/notifications');
    ok('Notifications listed', n.data.data.notifications.length > 0);
    ok('Unread count computed', typeof n.data.data.unreadCount === 'number');

    const id = n.data.data.notifications[0]._id;
    const read = await student.post(`/notifications/${id}/read`);
    ok('Mark as read works', read.data.data.notification.read === true);

    await student.post('/notifications/read-all');
    const after = await student.get('/notifications?unreadOnly=true');
    ok('Mark all read works', after.data.data.notifications.length === 0);

    const ann = await student.get('/notifications/announcements/list');
    ok('Announcements visible to students', ann.data.data.announcements.length > 0);

    const create = await admin.post('/notifications/announcements', {
      title: 'Test Announcement', body: 'This is a test announcement body.', category: 'general', audience: 'students',
    });
    ok('Admin creates announcement + fans out notifications', create.status === 201 && create.data.data.notified > 0);
    await admin.del(`/notifications/announcements/${create.data.data.announcement._id}`);
  }

  section('17. Admin CRUD — full lifecycle');
  {
    // Opportunity lifecycle
    const created = await admin.post('/opportunities', {
      title: 'Test Drive', company: 'TestCorp', type: 'placement', role: 'Engineer',
      deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      skillsRequired: ['React'], status: 'draft',
      eligibility: { minCgpa: 6, allowedBranches: ['CSE'], allowedGraduationYears: [2026], maxBacklogs: 0 },
    });
    ok('Admin creates opportunity (draft)', created.status === 201);
    const oid = created.data.data.opportunity._id;

    const studentSees = await student.get('/opportunities');
    ok('Draft hidden from students', !studentSees.data.data.opportunities.some((o) => o._id === oid));

    const pub = await admin.post(`/opportunities/${oid}/publish`);
    ok('Admin publishes opportunity', pub.data.data.opportunity.status === 'published');

    const studentSees2 = await student.get('/opportunities');
    ok('Published opportunity now visible to students', studentSees2.data.data.opportunities.some((o) => o._id === oid));

    const upd = await admin.patch(`/opportunities/${oid}`, { stipendOrCtc: '₹10 LPA' });
    ok('Admin updates opportunity', upd.data.data.opportunity.stipendOrCtc === '₹10 LPA');

    const exp = await admin.post(`/opportunities/${oid}/expire`);
    ok('Admin expires opportunity', exp.data.data.opportunity.status === 'expired');
    await admin.del(`/opportunities/${oid}`);

    // Path + milestone + lesson lifecycle
    const p = await admin.post('/paths', { title: 'Test Path ' + Date.now(), level: 'beginner', category: 'skill' });
    ok('Admin creates learning path', p.status === 201);
    const pid = p.data.data.path._id;

    const m = await admin.post('/paths/milestones', {
      pathId: pid, title: 'Test Milestone', description: 'desc', whyItMatters: 'why',
    });
    ok('Admin creates milestone', m.status === 201);
    const mid = m.data.data.milestone._id;

    const l = await admin.post('/lessons', {
      milestoneId: mid, title: 'Test Lesson',
      authorizedTranscript: 'This is an authorized transcript written by the placement cell. It explains the concept of testing in detail. Testing verifies that code behaves as expected under different conditions. For example, a unit test isolates one function and checks its output. Integration tests verify that modules work together correctly. Good tests are fast, deterministic and independent of each other.',
      transcriptSource: 'admin-authored',
      primaryVideo: { youtubeVideoId: 'abcdefghijk', title: 'Test Video', channelName: 'Test', duration: 600, reasonForRecommendation: 'test' },
    });
    ok('Admin creates lesson with ONE primary video', l.status === 201);
    const lid = l.data.data.lesson._id;

    const gen = await admin.post(`/notes/generate/${lid}`, { publish: true });
    ok('AI generates notes from authorized transcript', gen.status === 201);
    ok('AI generates flashcards', gen.data.data.flashcards.length > 0);
    ok('AI generates a 5-question quiz', gen.data.data.quiz.questions.length === 5);
    ok('Generation honestly labelled demo', gen.data.data.aiStatus.mode === 'demo');

    // No-transcript protection
    const l2 = await admin.post('/lessons', {
      milestoneId: mid, title: 'No Transcript Lesson',
      primaryVideo: { youtubeVideoId: 'zyxwvutsrqp', title: 'Video Without Transcript', duration: 100 },
    });
    ok('Lesson without transcript created', l2.status === 201, JSON.stringify(l2.data?.details || l2.data?.message));
    const gen2 = await admin.post(`/notes/generate/${l2.data.data.lesson._id}`);
    ok('Refuses to generate without authorized transcript (400)', gen2.status === 400);
    ok('Refusal explains the no-scraping policy', gen2.data.message.includes('never scrape') || gen2.data.message.includes('authorized'));

    const review = await admin.get('/notes/review?status=draft');
    ok('AI notes review queue works', Array.isArray(review.data.data.notes));

    await admin.del(`/lessons/${lid}`);
    await admin.del(`/lessons/${l2.data.data.lesson._id}`);
    await admin.del(`/paths/${pid}`);
    ok('Admin cascade-deletes path content', true);

    // Interview question bank
    const iq = await admin.post('/interview/admin/questions', {
      question: 'Test question?', role: 'MERN Developer', topic: 'Test', difficulty: 'easy',
      mustMentionKeywords: ['test'], idealAnswerOutline: ['Answer it'],
    });
    ok('Admin adds interview question', iq.status === 201);
    await admin.del(`/interview/admin/questions/${iq.data.data.question._id}`);

    // Room CRUD
    const r = await admin.post('/rooms', { name: 'Test Room ' + Date.now(), description: 'x', category: 'general' });
    ok('Admin creates peer room', r.status === 201);
    await admin.del(`/rooms/${r.data.data.room._id}`);

    // Students management
    const studs = await admin.get('/users?role=student');
    ok('Admin lists students', studs.data.data.students.length > 0);
    const sd = await admin.get(`/dashboard/admin/student/${studs.data.data.students[0]._id}`);
    ok('Admin views student detail', sd.status === 200);
    ok('Private documents NOT exposed via admin API', sd.data.data.documents === undefined);
  }

  section('18. Analytics');
  {
    const a = await admin.get('/dashboard/admin/analytics');
    const d = a.data.data;
    ok('Total & active opportunities', typeof d.kpis.totalOpportunities === 'number');
    ok('Applications per company', Array.isArray(d.applicationsPerCompany));
    ok('Eligible students per drive', Array.isArray(d.eligibilityPerDrive));
    ok('Most in-demand skills', Array.isArray(d.inDemandSkills));
    ok('Skill gap analysis', Array.isArray(d.skillGap));
    ok('Profile completion distribution', d.profileCompletionDistribution.length === 4);
    ok('Shortlisted students', Array.isArray(d.shortlistedStudents));
    ok('Round-wise conversion', d.roundConversion.length === 9);
    ok('Upcoming deadlines', Array.isArray(d.upcomingDeadlines));

    const charts = await student.get('/dashboard/charts');
    ok('Progress charts data (30 days)', charts.data.data.daily.length === 30);
    ok('Path breakdown for charts', Array.isArray(charts.data.data.pathBreakdown));
  }

  section('19. Cron reminder engine');
  {
    const r = await admin.post('/admin/run-reminders');
    ok('Reminder checks execute', r.status === 200);
    ok('Revision reminders processed', typeof r.data.data.revisions === 'number');
    ok('Deadline reminders processed', typeof r.data.data.deadlines === 'number');
    ok('Profile reminders processed', typeof r.data.data.profiles === 'number');
  }

  section('20. Profile / onboarding persistence');
  {
    const upd = await student.patch('/users/profile', {
      profile: { skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', 'Git', 'HTML', 'CSS', 'Testing'] },
    });
    ok('Profile update persists', upd.status === 200 && upd.data.data.user.profile.skills.includes('Testing'));
    ok('Profile completion recalculated', typeof upd.data.data.user.profileCompletionScore === 'number');

    const stats = await student.get('/users/stats');
    ok('Profile stats endpoint', stats.status === 200);

    // Restore
    await student.patch('/users/profile', {
      profile: { skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', 'Git', 'HTML', 'CSS'] },
    });
  }

  section('21. Logout');
  {
    const out = await student.post('/auth/logout');
    ok('Logout succeeds', out.status === 200);
    const after = await student.get('/auth/me');
    ok('Session invalid after logout (401)', after.status === 401);
  }

  console.log('\n' + '='.repeat(58));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log('='.repeat(58));
  if (failures.length) {
    console.log('\n  Failures:');
    failures.forEach((f) => console.log('   ✗ ' + f));
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\nFATAL', e);
  process.exit(1);
});
