/**
 * CampusOrbit seed script.
 * Usage: npm run seed
 *
 * Wipes the CampusOrbit collections and inserts a coherent demo dataset:
 * users, 4 learning paths, milestones, 20+ lessons with ONE curated primary
 * video each, AI notes/flashcards/quizzes from authorized transcripts,
 * opportunities, applications, resumes, documents, rooms, messages,
 * interview questions/attempts, revision tasks and notifications.
 */
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import {
  User,
  LearningPath,
  Milestone,
  Lesson,
  StudentProgress,
  VideoQueueItem,
  Note,
  Flashcard,
  Quiz,
  QuizAttempt,
  RevisionTask,
  Opportunity,
  Application,
  Document,
  Resume,
  InterviewQuestion,
  InterviewAttempt,
  PeerRoom,
  Message,
  WatchSession,
  MeetSession,
  Notification,
  Announcement,
} from './models/index.js';
import { learningPaths } from './data/paths.data.js';
import { demoUsers, opportunities, peerRooms, interviewQuestions, announcements } from './data/seed.data.js';
import {
  generateNotesFromTranscript,
  generateFlashcards,
  generateQuiz,
  evaluateInterviewAnswer,
} from './services/ai.service.js';
import { checkEligibility, buildDocumentChecklist } from './services/eligibility.service.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const log = (...args) => console.log('  ', ...args);

async function clearAll() {
  console.log('\n🧹 Clearing existing CampusOrbit data...');
  await Promise.all([
    User.deleteMany({}),
    LearningPath.deleteMany({}),
    Milestone.deleteMany({}),
    Lesson.deleteMany({}),
    StudentProgress.deleteMany({}),
    VideoQueueItem.deleteMany({}),
    Note.deleteMany({}),
    Flashcard.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    RevisionTask.deleteMany({}),
    Opportunity.deleteMany({}),
    Application.deleteMany({}),
    Document.deleteMany({}),
    Resume.deleteMany({}),
    InterviewQuestion.deleteMany({}),
    InterviewAttempt.deleteMany({}),
    PeerRoom.deleteMany({}),
    Message.deleteMany({}),
    WatchSession.deleteMany({}),
    MeetSession.deleteMany({}),
    Notification.deleteMany({}),
    Announcement.deleteMany({}),
  ]);
  log('all collections cleared');
}

async function seedUsers() {
  console.log('\n👥 Seeding users...');
  const created = [];
  for (const data of demoUsers) {
    // Use save() so the pre-save bcrypt hook runs.
    const user = new User(data);
    // eslint-disable-next-line no-await-in-loop
    await user.save();
    created.push(user);
    log(`${user.role.padEnd(7)} ${user.email}`);
  }
  return created;
}

async function seedPaths(admin) {
  console.log('\n🛰️  Seeding learning paths, milestones and lessons...');
  const result = { paths: [], milestones: [], lessons: [] };

  for (const pathData of learningPaths) {
    const { milestones: milestoneList, ...pathFields } = pathData;
    // eslint-disable-next-line no-await-in-loop
    const path = await LearningPath.create({ ...pathFields, createdBy: admin._id });
    result.paths.push(path);

    let order = 1;
    for (const m of milestoneList) {
      const { lessons: lessonList = [], ...milestoneFields } = m;
      const total = milestoneList.length;
      // eslint-disable-next-line no-await-in-loop
      const milestone = await Milestone.create({
        ...milestoneFields,
        pathId: path._id,
        slug: slugify(m.title),
        order,
        orbit: {
          radius: 3.4 + (order % 3) * 0.85,
          angle: ((order - 1) / total) * Math.PI * 2,
          height: (((order - 1) % 4) - 1.5) * 0.75,
        },
      });
      result.milestones.push(milestone);

      let lessonOrder = 1;
      for (const l of lessonList) {
        // eslint-disable-next-line no-await-in-loop
        const lesson = await Lesson.create({
          ...l,
          milestoneId: milestone._id,
          pathId: path._id,
          slug: `${slugify(l.title)}`,
          order: lessonOrder,
          transcriptSource: l.authorizedTranscript ? 'admin-authored' : 'none',
          createdBy: admin._id,
          primaryVideo: {
            ...l.primaryVideo,
            thumbnail:
              l.primaryVideo.thumbnail ||
              `https://i.ytimg.com/vi/${l.primaryVideo.youtubeVideoId}/hqdefault.jpg`,
            isEmbeddable: l.primaryVideo.isEmbeddable !== false,
          },
        });
        result.lessons.push(lesson);
        lessonOrder += 1;
      }
      order += 1;
    }
    log(`${path.title.padEnd(24)} ${milestoneList.length} milestones, ${milestoneList.reduce((s, m) => s + (m.lessons?.length || 0), 0)} lessons`);
  }
  return result;
}

async function seedNotesAndQuizzes(lessons, admin) {
  console.log('\n🧠 Generating AI notes, flashcards and quizzes from authorized transcripts...');
  let notes = 0;
  let cards = 0;
  let quizzes = 0;

  for (const lesson of lessons) {
    if (!lesson.authorizedTranscript) continue;

    const generated = generateNotesFromTranscript({
      title: lesson.title,
      topic: lesson.topic || lesson.title,
      transcript: lesson.authorizedTranscript,
      duration: lesson.primaryVideo?.duration || 0,
    });
    if (!generated) continue;

    // eslint-disable-next-line no-await-in-loop
    const note = await Note.create({
      lessonId: lesson._id,
      kind: 'ai',
      title: generated.title,
      summary: generated.summary,
      keyConcepts: generated.keyConcepts,
      definitions: generated.definitions,
      practicalExamples: generated.practicalExamples,
      sections: generated.sections,
      interviewQuestions: generated.interviewQuestions,
      beginnerExplanation: generated.beginnerExplanation,
      hinglishExplanation: generated.hinglishExplanation,
      revisionSummary: generated.revisionSummary,
      generationMode: generated.mode,
      generatedFrom: 'authorized-transcript',
      status: 'published',
      reviewedBy: admin._id,
    });
    notes += 1;

    const flashcards = generateFlashcards(generated, lesson.topic || lesson.title);
    if (flashcards.length) {
      // eslint-disable-next-line no-await-in-loop
      const saved = await Flashcard.insertMany(
        flashcards.map((c) => ({
          ...c,
          lessonId: lesson._id,
          noteId: note._id,
          generationMode: generated.mode,
        }))
      );
      cards += saved.length;
    }

    const quizData = generateQuiz(generated, lesson.title, lesson.topic || lesson.title);
    if (quizData?.questions?.length) {
      // eslint-disable-next-line no-await-in-loop
      await Quiz.create({
        lessonId: lesson._id,
        milestoneId: lesson.milestoneId,
        title: quizData.title,
        description: quizData.description,
        questions: quizData.questions,
        passPercent: quizData.passPercent,
        generationMode: quizData.mode,
      });
      quizzes += 1;
    }
  }

  // Leave two notes in draft so the Admin "AI Notes Review" queue is not empty.
  // Take them from the END so early/demo lessons keep published notes.
  const drafts = await Note.find({ kind: 'ai' }).sort({ createdAt: -1 }).limit(2);
  for (const d of drafts) {
    d.status = 'draft';
    // eslint-disable-next-line no-await-in-loop
    await d.save();
  }

  log(`${notes} AI notes, ${cards} flashcards, ${quizzes} quizzes (2 notes left as drafts for review)`);
}

async function seedOpportunities(admin) {
  console.log('\n💼 Seeding opportunities...');
  const created = await Opportunity.insertMany(
    opportunities.map((o) => ({ ...o, postedBy: admin._id }))
  );
  created.forEach((o) => log(`${o.status.padEnd(9)} ${o.company} — ${o.title}`));
  return created;
}

async function seedProgress(student, paths, milestones, lessons) {
  console.log('\n📈 Seeding student progress on the MERN path...');
  const mern = paths.find((p) => p.slug === 'mern-developer');
  const pathMilestones = milestones
    .filter((m) => String(m.pathId) === String(mern._id))
    .sort((a, b) => a.order - b.order);
  const pathLessons = lessons
    .filter((l) => String(l.pathId) === String(mern._id))
    .sort((a, b) => a.order - b.order);

  // First two milestones complete, third in progress.
  const milestoneStates = pathMilestones.map((m, i) => {
    if (i < 2) return { milestoneId: m._id, status: 'completed', completedAt: new Date(Date.now() - (10 - i * 3) * 86400000), proofSubmitted: i === 0, proofUrl: i === 0 ? 'https://github.com/aarav-sharma/js-todo-app' : '' };
    if (i === 2) return { milestoneId: m._id, status: 'in-progress' };
    return { milestoneId: m._id, status: 'locked' };
  });

  const completedMilestoneIds = pathMilestones.slice(0, 2).map((m) => String(m._id));
  const inProgressId = String(pathMilestones[2]._id);

  const lessonStates = pathLessons
    .filter(
      (l) =>
        completedMilestoneIds.includes(String(l.milestoneId)) ||
        String(l.milestoneId) === inProgressId
    )
    .map((l, i) => {
      const isDone = completedMilestoneIds.includes(String(l.milestoneId));
      const duration = l.primaryVideo?.duration || 1800;
      return {
        lessonId: l._id,
        milestoneId: l.milestoneId,
        watchedSeconds: isDone ? duration : Math.round(duration * 0.45),
        lastTimestamp: isDone ? duration : Math.round(duration * 0.45),
        percent: isDone ? 100 : 45,
        quizPassed: isDone,
        practiceDone: isDone,
        completed: isDone,
        completedAt: isDone ? new Date(Date.now() - (9 - i) * 86400000) : null,
        updatedAt: new Date(),
      };
    });

  const completedTopics = pathMilestones
    .slice(0, 2)
    .flatMap((m) => (m.topicTags || []).map((t) => t.toLowerCase()));

  const progress = await StudentProgress.create({
    userId: student._id,
    pathId: mern._id,
    status: 'active',
    startedAt: new Date(Date.now() - 21 * 86400000),
    weeklyHours: 14,
    targetTimelineWeeks: 14,
    lessons: lessonStates,
    milestones: milestoneStates,
    completedTopics,
    recommendationReason:
      'Your goal "MERN Developer" matched this path directly, it fits your 14 hrs/week schedule, and it is designed for your intermediate level.',
    lastAccessedLessonId: pathLessons.find((l) => String(l.milestoneId) === inProgressId)?._id || null,
  });

  await User.findByIdAndUpdate(student._id, { activePathId: mern._id });
  log(`2 milestones completed, 1 in progress, ${lessonStates.filter((l) => l.completed).length} lessons done`);
  return { progress, mern, pathLessons };
}

async function seedQuizAttempts(student, lessons) {
  console.log('\n📝 Seeding quiz attempts...');
  const quizzes = await Quiz.find({ lessonId: { $in: lessons.map((l) => l._id) } }).limit(6);
  let count = 0;

  for (let i = 0; i < quizzes.length; i += 1) {
    const quiz = quizzes[i];
    // Earlier attempts weaker, later attempts stronger (visible improvement).
    const correctRatio = i < 2 ? 0.6 : i < 4 ? 0.8 : 1;
    const answers = quiz.questions.map((q, qi) => {
      const correct = qi / quiz.questions.length < correctRatio;
      return {
        questionId: String(q._id),
        selectedIndex: correct ? q.correctIndex : (q.correctIndex + 1) % q.options.length,
        correct,
      };
    });
    const score = answers.filter((a) => a.correct).length;
    const total = quiz.questions.length;
    const percent = Math.round((score / total) * 100);

    // eslint-disable-next-line no-await-in-loop
    await QuizAttempt.create({
      userId: student._id,
      quizId: quiz._id,
      lessonId: quiz.lessonId,
      answers,
      score,
      total,
      percent,
      passed: percent >= quiz.passPercent,
      durationSeconds: 120 + i * 20,
      createdAt: new Date(Date.now() - (12 - i * 2) * 86400000),
    });
    count += 1;
  }
  log(`${count} quiz attempts`);
}

async function seedRevisions(student, lessons) {
  console.log('\n🔁 Seeding spaced revision tasks (1 → 7 → 21 days)...');
  const targets = lessons.slice(0, 5);
  const specs = [
    { stage: 1, offsetDays: -1, status: 'pending' }, // overdue
    { stage: 1, offsetDays: 0, status: 'pending' }, // due today
    { stage: 2, offsetDays: 3, status: 'pending' }, // upcoming
    { stage: 3, offsetDays: 14, status: 'pending' },
    { stage: 1, offsetDays: -5, status: 'completed' },
  ];

  for (let i = 0; i < targets.length; i += 1) {
    const due = new Date();
    due.setDate(due.getDate() + specs[i].offsetDays);
    due.setHours(9, 0, 0, 0);
    // eslint-disable-next-line no-await-in-loop
    await RevisionTask.create({
      userId: student._id,
      lessonId: targets[i]._id,
      topic: targets[i].title,
      stage: specs[i].stage,
      dueDate: due,
      status: specs[i].status,
      completedAt: specs[i].status === 'completed' ? new Date() : null,
    });
  }
  log('5 revision tasks (1 overdue, 1 due today, 2 upcoming, 1 completed)');
}

async function seedResumes(student) {
  console.log('\n📄 Seeding resumes...');
  const base = {
    userId: student._id,
    personal: {
      fullName: student.fullName,
      title: 'Full Stack Developer (MERN)',
      email: student.email,
      phone: student.profile.phone,
      location: student.profile.location,
      github: student.profile.githubUrl,
      linkedin: student.profile.linkedinUrl,
      portfolio: student.profile.portfolioUrl,
    },
    summary:
      'Final-year Computer Science student with hands-on experience building and deploying full-stack MERN applications. Comfortable across React, Node.js, Express and MongoDB, with a focus on clean API design and secure authentication. Looking for a software engineering role where I can ship user-facing features.',
    education: [
      {
        institution: 'Dr. A.P.J. Abdul Kalam Technical University',
        degree: 'B.Tech',
        field: 'Computer Science and Engineering',
        startYear: '2022',
        endYear: '2026',
        score: '8.2 CGPA',
      },
      {
        institution: 'City Montessori School, Lucknow',
        degree: 'Senior Secondary (CBSE)',
        field: 'PCM with Computer Science',
        startYear: '2020',
        endYear: '2022',
        score: '92.4%',
      },
    ],
    skills: [
      { category: 'Languages', items: ['JavaScript', 'C++', 'HTML5', 'CSS3', 'SQL'] },
      { category: 'Frontend', items: ['React', 'Redux Toolkit', 'Tailwind CSS', 'Framer Motion'] },
      { category: 'Backend', items: ['Node.js', 'Express.js', 'REST APIs', 'JWT', 'Socket.IO'] },
      { category: 'Database & Tools', items: ['MongoDB', 'Mongoose', 'Git', 'Postman', 'Vite'] },
    ],
    projects: [
      {
        name: 'CampusOrbit — Placement Preparation Platform',
        description:
          'A full-stack platform that replaces scattered DSA sheets and playlists with one guided learning path, integrated placement tracking and text-based interview practice.',
        techStack: ['React', 'Node.js', 'Express', 'MongoDB', 'Socket.IO'],
        repoUrl: 'https://github.com/aarav-sharma/campusorbit',
        liveUrl: 'https://campusorbit-demo.vercel.app',
        highlights: [
          'Built role-based JWT authentication with HTTP-only cookies across 3 user roles',
          'Designed 20+ Mongoose models with compound indexes preventing duplicate applications',
          'Implemented real-time group chat and synchronised watch sessions using Socket.IO',
        ],
      },
      {
        name: 'DevTrack — Developer Habit Tracker',
        description:
          'A MERN application for tracking daily coding habits with streaks, spaced revision reminders and analytics.',
        techStack: ['React', 'Express', 'MongoDB', 'Recharts'],
        repoUrl: 'https://github.com/aarav-sharma/devtrack',
        liveUrl: 'https://devtrack-demo.netlify.app',
        highlights: [
          'Implemented a spaced-repetition scheduler improving 7-day retention by 40% in user testing',
          'Reduced dashboard load time from 2.4s to 0.8s by adding compound indexes and pagination',
        ],
      },
    ],
    experience: [],
    internships: [
      {
        company: 'Webcraft Solutions',
        role: 'Web Development Intern',
        duration: 'Jun 2025 – Aug 2025',
        description:
          'Built responsive React components for a client dashboard and integrated 12 REST endpoints. Fixed 30+ UI bugs and improved mobile Lighthouse score from 62 to 94.',
      },
    ],
    certificates: [
      { name: 'Meta Front-End Developer Professional Certificate', issuer: 'Coursera', year: '2025', url: '' },
      { name: 'MongoDB Node.js Developer Path', issuer: 'MongoDB University', year: '2025', url: '' },
    ],
    achievements: [
      'Solved 350+ data structures and algorithms problems on LeetCode',
      'Finalist, Smart India Hackathon internal round 2025',
      'Department rank 4 out of 120 students',
    ],
    codingProfiles: [
      { platform: 'LeetCode', url: 'https://leetcode.com/aarav-sharma', rating: '1720' },
      { platform: 'GitHub', url: 'https://github.com/aarav-sharma', rating: '32 repositories' },
    ],
    languages: ['English', 'Hindi'],
    links: [{ label: 'Portfolio', url: 'https://aarav-sharma.dev' }],
  };

  const primary = await Resume.create({
    ...base,
    name: 'MERN Developer Resume',
    template: 'orbit-modern',
    accentColor: '#7c5cff',
    isDefault: true,
  });

  const ats = await Resume.create({
    ...base,
    name: 'ATS Resume (Mass Recruiters)',
    template: 'ats-minimal',
    accentColor: '#111827',
    isDefault: false,
  });

  log(`2 resumes (default: "${primary.name}", completeness ${primary.completeness()}%)`);
  return [primary, ats];
}

async function seedDocuments(student) {
  console.log('\n🗂️  Seeding document wallet...');
  const docs = await Document.insertMany([
    {
      userId: student._id,
      label: 'GitHub Profile',
      category: 'coding-profile',
      kind: 'link',
      url: 'https://github.com/aarav-sharma',
      isPrivate: false,
    },
    {
      userId: student._id,
      label: 'CampusOrbit Project Repository',
      category: 'project-link',
      kind: 'link',
      url: 'https://github.com/aarav-sharma/campusorbit',
      isPrivate: false,
    },
    {
      userId: student._id,
      label: 'DevTrack Live Demo',
      category: 'project-link',
      kind: 'link',
      url: 'https://devtrack-demo.netlify.app',
      isPrivate: false,
    },
    {
      userId: student._id,
      label: 'Meta Front-End Certificate',
      category: 'certificate',
      kind: 'link',
      url: 'https://coursera.org/verify/example',
      isPrivate: false,
      verified: true,
    },
    {
      userId: student._id,
      label: 'LeetCode Profile',
      category: 'coding-profile',
      kind: 'link',
      url: 'https://leetcode.com/aarav-sharma',
      isPrivate: false,
    },
  ]);
  log(`${docs.length} wallet entries (transcript & photo intentionally missing to demo the checklist)`);
  return docs;
}

async function seedApplications(students, opps, resumes) {
  console.log('\n📨 Seeding applications...');
  const [aarav, , , rohan, sneha] = students;
  const mernIntern = opps.find((o) => o.company === 'Nexora Technologies');
  const sde = opps.find((o) => o.company === 'Quantel Systems');
  const frontend = opps.find((o) => o.company === 'Lumen Design Labs');
  const hackathon = opps.find((o) => o.type === 'hackathon');
  const scholarship = opps.find((o) => o.type === 'scholarship');

  const docs = await Document.find({ userId: aarav._id }).lean();
  const resumeList = await Resume.find({ userId: aarav._id }).lean();

  const build = (user, opp, stage, timeline, resumeId = null) => {
    const el = checkEligibility(user, opp);
    return {
      userId: user._id,
      opportunityId: opp._id,
      stage,
      resumeId,
      coverNote:
        stage === 'Saved'
          ? ''
          : `I have built two deployed MERN applications and am confident with ${(opp.skillsRequired || [])
              .slice(0, 3)
              .join(', ')}. I would like to contribute to ${opp.company}.`,
      attachedLinks: {
        github: user.profile?.githubUrl || '',
        portfolio: user.profile?.portfolioUrl || '',
        projects: ['https://github.com/aarav-sharma/campusorbit'],
      },
      eligibilitySnapshot: { eligible: el.eligible, reasons: el.reasons },
      documentChecklist: buildDocumentChecklist(user, opp, docs, resumeList),
      timeline,
      appliedAt: stage === 'Saved' || stage === 'Preparing' ? null : timeline[timeline.length - 1].at,
    };
  };

  const ago = (d) => new Date(Date.now() - d * 86400000);

  const apps = [
    build(aarav, mernIntern, 'Technical Round', [
      { stage: 'Saved', note: 'Saved from Placement Hub', at: ago(14) },
      { stage: 'Preparing', note: 'Revising Node and MongoDB', at: ago(12) },
      { stage: 'Applied', note: 'Application submitted', at: ago(10) },
      { stage: 'Shortlisted', note: 'Profile shortlisted by placement cell', at: ago(7) },
      { stage: 'Assessment', note: 'Cleared online assessment with 82%', at: ago(5) },
      { stage: 'Technical Round', note: 'Technical interview scheduled', at: ago(2) },
    ], resumes[0]._id),
    build(aarav, frontend, 'Applied', [
      { stage: 'Saved', note: 'Saved from Placement Hub', at: ago(6) },
      { stage: 'Applied', note: 'Applied with portfolio link', at: ago(4) },
    ], resumes[0]._id),
    build(aarav, hackathon, 'Saved', [{ stage: 'Saved', note: 'Looking for teammates', at: ago(3) }]),
    build(rohan, sde, 'Shortlisted', [
      { stage: 'Applied', note: 'Application submitted', at: ago(9) },
      { stage: 'Shortlisted', note: 'Strong DSA profile', at: ago(4) },
    ]),
    build(rohan, mernIntern, 'Applied', [{ stage: 'Applied', note: 'Application submitted', at: ago(8) }]),
    build(sneha, scholarship, 'Applied', [{ stage: 'Applied', note: 'Application submitted', at: ago(5) }]),
    build(sneha, hackathon, 'Selected', [
      { stage: 'Applied', note: 'Team registered', at: ago(11) },
      { stage: 'Shortlisted', note: 'Idea shortlisted in top 100', at: ago(6) },
      { stage: 'Selected', note: 'Team confirmed for the final round', at: ago(1) },
    ]),
  ];

  const created = await Application.insertMany(apps);
  log(`${created.length} applications across ${new Set(created.map((a) => String(a.userId))).size} students`);
  return created;
}

async function seedRooms(users) {
  console.log('\n💬 Seeding peer rooms and messages...');
  const [aarav, admin, ishita, rohan, sneha] = users;

  const rooms = [];
  for (const r of peerRooms) {
    // eslint-disable-next-line no-await-in-loop
    const room = await PeerRoom.create({
      ...r,
      moderators: [admin._id, ishita._id],
      members: [admin._id, ishita._id, aarav._id, rohan._id, sneha._id],
      resourceLinks: [
        {
          label: 'Official path resource',
          url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
          addedBy: ishita._id,
        },
      ],
      lastActivityAt: new Date(),
    });
    rooms.push(room);
  }

  const conversations = {
    'mern-developer-path': [
      { user: ishita, text: 'Welcome everyone 👋 I graduated in 2024 and cleared 3 product-company interviews using this exact path. Ask anything here.' },
      { user: aarav, text: 'Thanks Ishita! I am stuck on the JWT milestone. Why do we prefer HTTP-only cookies over localStorage for the token?' },
      { user: ishita, text: 'Great question. localStorage is readable by any JavaScript on the page, so one XSS bug leaks every token. An HTTP-only cookie cannot be read by JS at all. The trade-off is CSRF, which you handle with SameSite and origin checks.' },
      { user: rohan, text: 'Follow-up: does that mean localStorage is always wrong?' },
      { user: ishita, text: 'Not always, but for anything with real user data I default to HTTP-only cookies. In interviews, mentioning the trade-off matters more than the choice itself.' },
      { user: admin, text: '📌 Pinned: complete the Document Wallet checklist before the Nexora deadline. Incomplete applications get rejected at screening.' },
      { user: aarav, text: 'Deployed my CampusOrbit clone finally! https://github.com/aarav-sharma/campusorbit — feedback welcome 🚀' },
      { user: sneha, text: 'The orbit visualisation is genuinely nice. How did you handle the sync between the 3D nodes and progress state?' },
    ],
    'dsa-arrays-and-strings': [
      { user: rohan, text: 'Today: longest substring without repeating characters. Post your approach BEFORE the code please.' },
      { user: aarav, text: 'Sliding window with a Set. Expand right, and when a duplicate appears shrink from the left until it is gone. O(n) time, O(min(n,m)) space.' },
      { user: rohan, text: 'Correct. A map of last-seen index lets you jump the left pointer directly instead of shrinking one step at a time.' },
      { user: ishita, text: 'Interview tip: always state the pattern name out loud first. Saying "this is a variable-size sliding window" immediately signals you have seen the family of problems.' },
      { user: sneha, text: 'What is the actual difference between two-pointer and sliding window? They feel identical to me.' },
      { user: ishita, text: 'Sliding window is a special case of two pointers where the region between the pointers is the answer. In general two-pointer problems the pointers just meet, the region does not matter.' },
    ],
    'gate-cse-dbms': [
      { user: sneha, text: 'Can someone explain the difference between 3NF and BCNF with an actual example? Every source says the same abstract thing.' },
      { user: ishita, text: 'In 3NF, a dependency is allowed if the right side is a prime attribute even when the left side is not a superkey. BCNF removes that exception: every determinant must be a superkey.' },
      { user: sneha, text: 'So a relation can be 3NF but not BCNF only when there are overlapping candidate keys?' },
      { user: ishita, text: 'Exactly. That is the standard GATE trap. Also remember: BCNF decomposition is always lossless but may not preserve dependencies.' },
      { user: admin, text: 'Previous-year questions on normalisation appear almost every year. Prioritise this over indexing if you are short on time.' },
    ],
    'tcs-nqt-aptitude-sprint': [
      { user: admin, text: 'Daily sprint: 20 quantitative questions in 25 minutes. Post your score and the questions you missed.' },
      { user: rohan, text: '16/20 in 23 minutes. Lost marks on time-speed-distance with relative motion.' },
      { user: aarav, text: '14/20. Percentages and profit-loss are killing me.' },
      { user: ishita, text: 'For profit-loss, always convert to a base of 100. It removes almost all the arithmetic errors under time pressure.' },
    ],
    'react-beginner-room': [
      { user: aarav, text: 'No question is too basic here. Ask freely 🙂' },
      { user: rohan, text: 'Why does my useEffect run twice on mount in development?' },
      { user: aarav, text: 'React StrictMode intentionally double-invokes effects in development to surface missing cleanup. It does not happen in production builds.' },
      { user: rohan, text: 'That explains a lot, thanks! So my duplicate API call is not actually a bug?' },
      { user: ishita, text: 'It is a signal though — add an AbortController in the cleanup and the duplicate becomes harmless. That is the lesson StrictMode is teaching.' },
    ],
  };

  let messageCount = 0;
  for (const room of rooms) {
    const convo = conversations[room.slug] || [];
    let offset = convo.length;
    const created = [];
    for (const m of convo) {
      offset -= 1;
      // eslint-disable-next-line no-await-in-loop
      const msg = await Message.create({
        roomId: room._id,
        userId: m.user._id,
        authorName: m.user.fullName,
        authorRole: m.user.role,
        text: m.text,
        type: 'text',
        createdAt: new Date(Date.now() - offset * 3600000 - 3600000),
        reactions: m.text.includes('📌') || m.text.length > 180
          ? [{ emoji: '👍', userId: aarav._id }, { emoji: '🎯', userId: rohan._id }]
          : [],
        isPinned: m.text.includes('📌'),
      });
      created.push(msg);
      messageCount += 1;
    }
    const pinned = created.filter((m) => m.isPinned).map((m) => m._id);
    if (pinned.length) {
      room.pinnedMessages = pinned;
      // eslint-disable-next-line no-await-in-loop
      await room.save();
    }
  }

  // An active Watch Together session in the MERN room.
  const mernRoom = rooms.find((r) => r.slug === 'mern-developer-path');
  const session = await WatchSession.create({
    roomId: mernRoom._id,
    hostId: ishita._id,
    hostName: ishita.fullName,
    youtubeVideoId: '3a0I8ICR1Vg',
    title: 'Group study: JavaScript Closures Explained',
    thumbnail: 'https://i.ytimg.com/vi/3a0I8ICR1Vg/hqdefault.jpg',
    state: 'paused',
    positionSeconds: 0,
    lastSyncAt: new Date(),
    participants: [ishita._id, aarav._id],
    pinnedStudyPoints: [
      { timestamp: 95, label: 'Definition of a closure', addedBy: ishita._id },
      { timestamp: 260, label: 'Counter example — private state', addedBy: ishita._id },
      { timestamp: 430, label: 'The var-in-a-loop bug', addedBy: aarav._id },
    ],
    isActive: true,
  });
  mernRoom.activeWatchSessionId = session._id;
  await mernRoom.save();

  await Message.create({
    roomId: mernRoom._id,
    userId: aarav._id,
    authorName: aarav.fullName,
    authorRole: 'student',
    text: 'This part about the loop bug finally made it click for me',
    type: 'timestamp',
    videoTimestamp: 430,
    watchSessionId: session._id,
  });
  messageCount += 1;

  // ---- Google Meet live sessions hosted by alumni / placement cell ----
  // aarav / admin / ishita / rohan / sneha are already destructured above.
  const placement = admin;

  const dsaRoom = rooms.find((r) => r.slug === 'dsa-arrays-and-strings');
  const gateRoom = rooms.find((r) => r.slug === 'gate-cse-dbms');
  const tcsRoom = rooms.find((r) => r.slug === 'tcs-nqt-aptitude-sprint');

  const hoursFromNow = (h) => new Date(Date.now() + h * 3600000);

  const meetSessions = [
    {
      roomId: dsaRoom._id,
      hostId: ishita._id,
      title: 'Mock Interview: DSA round with an SDE-2',
      description:
        'Live 1:1 style mock interview on arrays and strings. I will interview two volunteers while everyone else observes, then we debrief on what a real interviewer is scoring.',
      topic: 'Arrays & Strings',
      sessionType: 'mock-interview',
      meetLink: 'https://meet.google.com/kxq-mnbv-cyt',
      scheduledAt: hoursFromNow(0.15), // live in ~9 min -> inside the 10-min window
      durationMinutes: 60,
      maxSeats: 25,
      status: 'scheduled',
      rsvps: [
        { userId: ishita._id, status: 'going' },
        { userId: aarav._id, status: 'going' },
        { userId: rohan._id, status: 'going' },
        { userId: sneha._id, status: 'maybe' },
      ],
    },
    {
      roomId: mernRoom._id,
      hostId: ishita._id,
      title: 'Resume Review Clinic — MERN projects',
      description:
        'Bring your resume. We go line by line on how to describe a MERN project so it survives a 30-second recruiter scan.',
      topic: 'Resume',
      sessionType: 'resume-review',
      meetLink: 'https://meet.google.com/rzp-wtqa-jln',
      scheduledAt: hoursFromNow(26),
      durationMinutes: 45,
      maxSeats: 15,
      status: 'scheduled',
      rsvps: [
        { userId: ishita._id, status: 'going' },
        { userId: aarav._id, status: 'going' },
      ],
    },
    {
      roomId: tcsRoom._id,
      hostId: placement._id,
      title: 'Placement Cell Briefing: TCS NQT 2026 pattern',
      description:
        'Official walkthrough of the exam pattern, cutoffs and the CampusOrbit prep plan. Attendance is recorded.',
      topic: 'TCS NQT',
      sessionType: 'guest-talk',
      meetLink: 'https://meet.google.com/vbn-hjkl-qwe',
      scheduledAt: hoursFromNow(72),
      durationMinutes: 90,
      maxSeats: 0,
      status: 'scheduled',
      rsvps: [
        { userId: placement._id, status: 'going' },
        { userId: aarav._id, status: 'going' },
        { userId: rohan._id, status: 'going' },
        { userId: sneha._id, status: 'going' },
      ],
    },
    {
      roomId: gateRoom._id,
      hostId: ishita._id,
      title: 'GATE DBMS: normalisation doubts',
      description: 'Open doubt session on 3NF vs BCNF with past-year questions.',
      topic: 'DBMS',
      sessionType: 'doubt-clearing',
      meetLink: 'https://meet.google.com/plm-okjn-ijb',
      scheduledAt: hoursFromNow(-26),
      durationMinutes: 60,
      status: 'ended',
      startedAt: hoursFromNow(-26),
      endedAt: hoursFromNow(-25),
      recapNotes:
        'Covered: functional dependencies, lossless join decomposition, why BCNF can lose dependency preservation. Practice Q4 and Q7 from the 2023 paper before next week.',
      rsvps: [
        { userId: ishita._id, status: 'going', attended: true, joinedAt: hoursFromNow(-26) },
        { userId: aarav._id, status: 'going', attended: true, joinedAt: hoursFromNow(-26) },
        { userId: sneha._id, status: 'going', attended: true, joinedAt: hoursFromNow(-25.9) },
        { userId: rohan._id, status: 'going', attended: false },
      ],
    },
  ];

  await MeetSession.insertMany(meetSessions);

  log(
    `${rooms.length} rooms, ${messageCount} messages, 1 active watch session, ${meetSessions.length} Google Meet sessions`
  );
  return rooms;
}

async function seedInterview(student, admin, resumes) {
  console.log('\n🎤 Seeding interview question bank and attempts...');
  const questions = await InterviewQuestion.insertMany(
    interviewQuestions.map((q) => ({ ...q, createdBy: admin._id }))
  );

  // Attempts showing genuine improvement over time.
  const sampleAnswers = [
    {
      q: questions.find((x) => x.topic === 'Express'),
      answer: 'Middleware is a function in express. It runs between request and response.',
      daysAgo: 20,
    },
    {
      q: questions.find((x) => x.topic === 'React Basics'),
      answer:
        'Props are passed from the parent component and are read only. State is managed inside the component itself and when state changes the component re-renders. A component cannot change its own props.',
      daysAgo: 16,
    },
    {
      q: questions.find((x) => x.topic === 'Authentication'),
      answer:
        'In my project I implemented JWT authentication. First, when a user registers I hash the password using bcrypt with a salt before storing it, so no plain password is ever saved. On login I compare the submitted password with the stored hash. If it matches I sign a token containing the user id and role with a secret and an expiry. I store that token in an HTTP-only cookie so client-side JavaScript cannot read it, which protects against XSS token theft. Then on every protected request a middleware reads the cookie, verifies the signature and expiry, loads the user and attaches it to the request. A separate role middleware checks whether the user role is allowed for that route. For example in CampusOrbit only admins can publish opportunities.',
      daysAgo: 9,
    },
    {
      q: questions.find((x) => x.topic === 'Database'),
      answer:
        'I chose MongoDB because the access patterns in my project were document shaped. For instance a student profile with nested preferences, skills and goals is read as one unit, so embedding avoids joins entirely. For data that grows without bound, like chat messages in a peer room, I used referencing instead with an index on the room id, because embedding would eventually hit the 16MB document limit and rewrite the whole parent on every insert. I used Mongoose to enforce a schema at the application layer with validation and pre-save hooks. The trade-off I accepted is weaker multi-document transactions compared to a relational database. If the project needed complex reporting joins across many entities, PostgreSQL would have been the better fit.',
      daysAgo: 4,
    },
    {
      q: questions.find((x) => x.topic === 'System Design'),
      answer:
        'To prevent duplicate applications I used two layers. First, in the controller I query for an existing application with the same user id and opportunity id and return a 409 conflict if found. But that check alone is not enough because two concurrent requests can both pass it before either writes. So the real guarantee is at the database level: I created a compound unique index on userId and opportunityId in the Application model. MongoDB then rejects the second insert with a duplicate key error, which I catch in my centralised error handler and convert into a clean 409 response. On the frontend I also disable the apply button and show the existing application stage so the user never attempts it twice.',
      daysAgo: 1,
    },
  ].filter((s) => s.q);

  for (const s of sampleAnswers) {
    const feedback = evaluateInterviewAnswer({ question: s.q, answer: s.answer, resumeContext: null });
    // eslint-disable-next-line no-await-in-loop
    await InterviewAttempt.create({
      userId: student._id,
      questionId: s.q._id,
      questionText: s.q.question,
      role: s.q.role,
      topic: s.q.topic,
      difficulty: s.q.difficulty,
      answerText: s.answer,
      wordCount: s.answer.trim().split(/\s+/).length,
      resumeContextId: resumes[0]._id,
      feedback,
      createdAt: new Date(Date.now() - s.daysAgo * 86400000),
    });
  }

  log(`${questions.length} questions, ${sampleAnswers.length} attempts (scores improve over time)`);
  return questions;
}

async function seedVideoQueue(student, lessons) {
  console.log('\n📺 Seeding personal video queue...');
  const items = await VideoQueueItem.insertMany([
    {
      userId: student._id,
      youtubeVideoId: 'W6NZfCO5SIk',
      originalUrl: 'https://www.youtube.com/watch?v=W6NZfCO5SIk',
      title: 'JavaScript Tutorial for Beginners',
      channelName: 'Programming with Mosh',
      thumbnail: 'https://i.ytimg.com/vi/W6NZfCO5SIk/hqdefault.jpg',
      relatedTopic: 'JavaScript',
      relatedLessonId: lessons[0]?._id || null,
      personalNotes: 'Good refresher before the JS fundamentals quiz. Watch the first 30 minutes again.',
      lastTimestamp: 640,
      watchedSeconds: 640,
      percent: 35,
      bookmarked: true,
      order: 0,
    },
    {
      userId: student._id,
      youtubeVideoId: 'PkZNo7MFNFg',
      originalUrl: 'https://www.youtube.com/watch?v=PkZNo7MFNFg',
      title: 'Learn JavaScript - Full Course for Beginners',
      channelName: 'freeCodeCamp.org',
      thumbnail: 'https://i.ytimg.com/vi/PkZNo7MFNFg/hqdefault.jpg',
      relatedTopic: 'JavaScript',
      personalNotes: 'Backup resource. Only for topics I could not follow in the primary video.',
      lastTimestamp: 0,
      percent: 0,
      order: 1,
    },
  ]);
  log(`${items.length} personal videos (primary path videos remain the official resource)`);
}

async function seedNotifications(users, opps) {
  console.log('\n🔔 Seeding notifications and announcements...');
  const [aarav, admin] = users;
  const mernIntern = opps.find((o) => o.company === 'Nexora Technologies');
  const frontend = opps.find((o) => o.company === 'Lumen Design Labs');

  const ago = (h) => new Date(Date.now() - h * 3600000);

  await Notification.insertMany([
    {
      userId: aarav._id,
      type: 'application-status',
      title: 'Application update: Technical Round',
      body: 'Your application for MERN Stack Developer Intern at Nexora Technologies moved from Assessment to Technical Round.',
      link: '/applications',
      icon: 'activity',
      priority: 'high',
      read: false,
      createdAt: ago(3),
    },
    {
      userId: aarav._id,
      type: 'deadline',
      title: '⏰ 8 days left: Frontend Engineer Intern',
      body: `${frontend.company} closes soon and you are eligible. Your portfolio link is already in your wallet.`,
      link: `/opportunities/${frontend._id}`,
      icon: 'alarm-clock',
      priority: 'high',
      read: false,
      createdAt: ago(8),
    },
    {
      userId: aarav._id,
      type: 'revision-due',
      title: 'Revision due: JavaScript Closures Explained',
      body: 'Stage 1 spaced revision. A quick 10-minute review now saves hours later.',
      link: '/learn?tab=revision',
      icon: 'repeat',
      read: false,
      createdAt: ago(12),
    },
    {
      userId: aarav._id,
      type: 'opportunity-match',
      title: `New opportunity: ${mernIntern.title}`,
      body: `${mernIntern.company} is hiring and you meet every eligibility criterion.`,
      link: `/opportunities/${mernIntern._id}`,
      icon: 'briefcase',
      priority: 'high',
      read: true,
      createdAt: ago(48),
    },
    {
      userId: aarav._id,
      type: 'room-reply',
      title: 'Ishita Verma replied to you',
      body: 'Great question. localStorage is readable by any JavaScript on the page...',
      link: '/peer-rooms',
      icon: 'message-circle',
      read: true,
      createdAt: ago(30),
    },
    {
      userId: aarav._id,
      type: 'profile-incomplete',
      title: 'Add your transcript to complete the Nexora checklist',
      body: 'Your Document Wallet is missing a Transcript, which this drive requires.',
      link: '/document-wallet',
      icon: 'user-check',
      read: false,
      createdAt: ago(20),
    },
  ]);

  await Announcement.insertMany(
    announcements.map((a) => ({ ...a, publishedBy: admin._id, publishedByName: admin.fullName }))
  );

  log('6 notifications, 3 announcements');
}

async function run() {
  const started = Date.now();
  console.log('\n' + '='.repeat(60));
  console.log('  🌌 CampusOrbit — Database Seed');
  console.log('='.repeat(60));

  await connectDB();
  await clearAll();

  const users = await seedUsers();
  const [aarav, admin] = users;

  const { paths, milestones, lessons } = await seedPaths(admin);
  await seedNotesAndQuizzes(lessons, admin);
  const opps = await seedOpportunities(admin);
  const { pathLessons } = await seedProgress(aarav, paths, milestones, lessons);
  await seedQuizAttempts(aarav, pathLessons);
  await seedRevisions(aarav, pathLessons);
  const resumes = await seedResumes(aarav);
  await seedDocuments(aarav);
  await seedApplications(users, opps, resumes);
  await seedRooms(users);
  await seedInterview(aarav, admin, resumes);
  await seedVideoQueue(aarav, pathLessons);
  await seedNotifications(users, opps);

  // ---- Summary ----
  const counts = {
    Users: await User.countDocuments(),
    LearningPaths: await LearningPath.countDocuments(),
    Milestones: await Milestone.countDocuments(),
    Lessons: await Lesson.countDocuments(),
    Notes: await Note.countDocuments(),
    Flashcards: await Flashcard.countDocuments(),
    Quizzes: await Quiz.countDocuments(),
    QuizAttempts: await QuizAttempt.countDocuments(),
    RevisionTasks: await RevisionTask.countDocuments(),
    Opportunities: await Opportunity.countDocuments(),
    Applications: await Application.countDocuments(),
    Resumes: await Resume.countDocuments(),
    Documents: await Document.countDocuments(),
    VideoQueue: await VideoQueueItem.countDocuments(),
    InterviewQuestions: await InterviewQuestion.countDocuments(),
    InterviewAttempts: await InterviewAttempt.countDocuments(),
    PeerRooms: await PeerRoom.countDocuments(),
    Messages: await Message.countDocuments(),
    WatchSessions: await WatchSession.countDocuments(),
    MeetSessions: await MeetSession.countDocuments(),
    Notifications: await Notification.countDocuments(),
    Announcements: await Announcement.countDocuments(),
    StudentProgress: await StudentProgress.countDocuments(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('  ✅ Seed complete in ' + ((Date.now() - started) / 1000).toFixed(1) + 's');
  console.log('='.repeat(60));
  Object.entries(counts).forEach(([k, v]) => console.log(`   ${k.padEnd(20)} ${v}`));

  console.log('\n  🔑 Demo credentials');
  console.log('   ' + '-'.repeat(56));
  console.log('   Student  student@campusorbit.dev   Student@123');
  console.log('   Admin    admin@campusorbit.dev     Admin@123');
  console.log('   Senior   senior@campusorbit.dev    Senior@123');
  console.log('   Extra students: rohan@ / sneha@ / karan@campusorbit.dev (Student@123)');
  console.log('   ' + '-'.repeat(56) + '\n');

  await disconnectDB();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('\n❌ Seed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
