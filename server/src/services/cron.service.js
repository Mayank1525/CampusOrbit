import cron from 'node-cron';
import {
  RevisionTask,
  Opportunity,
  Application,
  User,
  Lesson,
  StudentProgress,
  Quiz,
  QuizAttempt,
} from '../models/index.js';
import { notify } from './notification.service.js';
import { checkEligibility } from './eligibility.service.js';

/** Revision tasks due today or overdue. */
async function checkRevisions() {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const due = await RevisionTask.find({ status: 'pending', dueDate: { $lte: endOfToday } });
  for (const task of due) {
    const key = `rev-${task._id}-${new Date().toISOString().slice(0, 10)}`;
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: task.userId,
      type: 'revision-due',
      title: `Revision due: ${task.topic}`,
      body: `Stage ${task.stage} spaced revision. A quick 10-minute review now saves hours later.`,
      link: '/learn?tab=revision',
      icon: 'repeat',
      dedupeKey: key,
    });
    task.notifiedAt = new Date();
    // eslint-disable-next-line no-await-in-loop
    await task.save();
  }
  return due.length;
}

/** Opportunities closing within 3 days that the student has not applied to. */
async function checkDeadlines() {
  const now = new Date();
  const in3Days = new Date(Date.now() + 3 * 86400000);

  const closing = await Opportunity.find({
    status: 'published',
    deadline: { $gte: now, $lte: in3Days },
  });
  if (!closing.length) return 0;

  const students = await User.find({ role: 'student', isActive: true });
  let count = 0;

  for (const opp of closing) {
    const applied = await Application.find({ opportunityId: opp._id }).select('userId').lean();
    const appliedIds = new Set(applied.map((a) => String(a.userId)));

    for (const student of students) {
      if (appliedIds.has(String(student._id))) continue;
      if (!checkEligibility(student, opp).eligible) continue;

      const daysLeft = Math.ceil((new Date(opp.deadline) - now) / 86400000);
      // eslint-disable-next-line no-await-in-loop
      await notify({
        userId: student._id,
        type: 'deadline',
        title: `⏰ ${daysLeft} day(s) left: ${opp.title}`,
        body: `${opp.company} closes on ${new Date(opp.deadline).toDateString()}. You are eligible.`,
        link: `/opportunities/${opp._id}`,
        icon: 'alarm-clock',
        priority: 'high',
        dedupeKey: `deadline-${opp._id}-${daysLeft}`,
      });
      count += 1;
    }
  }
  return count;
}

/** Nudge students with an unfinished profile. */
async function checkProfiles() {
  const students = await User.find({ role: 'student', isActive: true });
  let count = 0;
  for (const s of students) {
    const completion = s.profileCompletion();
    if (completion >= 80) continue;
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: s._id,
      type: 'profile-incomplete',
      title: `Your profile is ${completion}% complete`,
      body: 'Placement filters use CGPA, branch, skills and links. Incomplete profiles get filtered out.',
      link: '/profile',
      icon: 'user-check',
      dedupeKey: `profile-${s._id}-${new Date().toISOString().slice(0, 7)}`,
    });
    count += 1;
  }
  return count;
}

/** Remind about lessons watched but whose quiz was never attempted. */
async function checkPendingQuizzes() {
  const progressList = await StudentProgress.find({ status: 'active' });
  let count = 0;

  for (const progress of progressList) {
    const started = (progress.lessons || []).filter((l) => !l.completed && (l.percent || 0) >= 40);
    for (const entry of started) {
      // eslint-disable-next-line no-await-in-loop
      const quiz = await Quiz.findOne({ lessonId: entry.lessonId });
      if (!quiz) continue;
      // eslint-disable-next-line no-await-in-loop
      const attempted = await QuizAttempt.exists({ userId: progress.userId, quizId: quiz._id });
      if (attempted) continue;
      // eslint-disable-next-line no-await-in-loop
      const lesson = await Lesson.findById(entry.lessonId).select('title');
      if (!lesson) continue;

      // eslint-disable-next-line no-await-in-loop
      await notify({
        userId: progress.userId,
        type: 'quiz-pending',
        title: `Quiz pending: ${lesson.title}`,
        body: 'You watched most of this lesson. Take the 5-question quiz to lock it in and mark it complete.',
        link: `/learn/${entry.lessonId}`,
        icon: 'clipboard-check',
        dedupeKey: `quiz-${entry.lessonId}-${progress.userId}`,
      });
      count += 1;
    }
  }
  return count;
}

/** Auto-expire opportunities past their deadline. */
async function expireOpportunities() {
  const result = await Opportunity.updateMany(
    { status: 'published', deadline: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
  return result.modifiedCount || 0;
}

export async function runAllChecks() {
  const [revisions, deadlines, profiles, quizzes, expired] = await Promise.all([
    checkRevisions(),
    checkDeadlines(),
    checkProfiles(),
    checkPendingQuizzes(),
    expireOpportunities(),
  ]);
  return { revisions, deadlines, profiles, quizzes, expired };
}

export function startCronJobs() {
  // Every day at 07:00 - revision + deadline + profile reminders
  cron.schedule('0 7 * * *', async () => {
    try {
      const result = await runAllChecks();
      console.log('[cron] daily reminders:', result);
    } catch (err) {
      console.error('[cron] daily reminder error:', err.message);
    }
  });

  // Every hour - expire past-deadline opportunities
  cron.schedule('0 * * * *', async () => {
    try {
      const expired = await expireOpportunities();
      if (expired) console.log(`[cron] expired ${expired} opportunities`);
    } catch (err) {
      console.error('[cron] expiry error:', err.message);
    }
  });

  // Every 30 minutes - revision due checks (keeps the demo lively)
  cron.schedule('*/30 * * * *', async () => {
    try {
      await checkRevisions();
    } catch (err) {
      console.error('[cron] revision check error:', err.message);
    }
  });

  console.log('[cron] scheduled: daily 07:00 reminders, hourly expiry, 30-min revision checks');
}
