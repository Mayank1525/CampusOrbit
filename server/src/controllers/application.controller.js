import { z } from 'zod';
import { Application, Opportunity, User, Document, Resume } from '../models/index.js';
import { APPLICATION_STAGES } from '../models/Application.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { checkEligibility, buildDocumentChecklist } from '../services/eligibility.service.js';
import { notify } from '../services/notification.service.js';

export const applySchema = z.object({
  opportunityId: z.string().min(1),
  resumeId: z.string().optional().nullable(),
  coverNote: z.string().max(3000).optional(),
  attachedLinks: z
    .object({
      github: z.string().optional(),
      portfolio: z.string().optional(),
      projects: z.array(z.string()).optional(),
    })
    .optional(),
  stage: z.enum(APPLICATION_STAGES).optional(),
});

export const stageSchema = z.object({
  stage: z.enum(APPLICATION_STAGES),
  note: z.string().max(500).optional(),
});

/** Student applies (or saves) an opportunity. Duplicate applications are impossible. */
export const applyToOpportunity = asyncHandler(async (req, res) => {
  const { opportunityId, resumeId, coverNote = '', attachedLinks = {}, stage = 'Applied' } = req.body;

  const opportunity = await Opportunity.findById(opportunityId);
  if (!opportunity) throw ApiError.notFound('Opportunity not found');
  if (opportunity.status !== 'published') throw ApiError.badRequest('This opportunity is not open');
  if (new Date(opportunity.deadline) < new Date() && stage !== 'Saved') {
    throw ApiError.badRequest('The deadline for this opportunity has passed');
  }

  const existing = await Application.findOne({ userId: req.user._id, opportunityId });
  if (existing && existing.stage !== 'Saved') {
    throw ApiError.conflict('You have already applied to this opportunity');
  }

  const eligibility = checkEligibility(req.user, opportunity);
  if (!eligibility.eligible && stage !== 'Saved') {
    throw ApiError.badRequest(
      `You are not eligible for this drive: ${eligibility.reasons.join(' ')}`,
      eligibility.checks
    );
  }

  const [docs, resumes] = await Promise.all([
    Document.find({ userId: req.user._id }).lean(),
    Resume.find({ userId: req.user._id }).lean(),
  ]);
  const checklist = buildDocumentChecklist(req.user, opportunity, docs, resumes);

  let chosenResume = resumeId;
  if (!chosenResume && stage === 'Applied') {
    const def = resumes.find((r) => r.isDefault) || resumes[0];
    if (!def) throw ApiError.badRequest('Create a resume in Resume Studio before applying');
    chosenResume = def._id;
  }

  const timelineEntry = { stage, note: 'Application created', changedBy: req.user._id, at: new Date() };

  let application;
  if (existing) {
    existing.stage = stage;
    existing.resumeId = chosenResume || existing.resumeId;
    existing.coverNote = coverNote || existing.coverNote;
    existing.attachedLinks = { ...existing.attachedLinks, ...attachedLinks };
    existing.eligibilitySnapshot = { eligible: eligibility.eligible, reasons: eligibility.reasons };
    existing.documentChecklist = checklist;
    existing.timeline.push(timelineEntry);
    if (stage === 'Applied') existing.appliedAt = new Date();
    await existing.save();
    application = existing;
  } else {
    application = await Application.create({
      userId: req.user._id,
      opportunityId,
      stage,
      resumeId: chosenResume || null,
      coverNote,
      attachedLinks: {
        github: attachedLinks.github || req.user.profile?.githubUrl || '',
        portfolio: attachedLinks.portfolio || req.user.profile?.portfolioUrl || '',
        projects: attachedLinks.projects || [],
      },
      eligibilitySnapshot: { eligible: eligibility.eligible, reasons: eligibility.reasons },
      documentChecklist: checklist,
      timeline: [timelineEntry],
      appliedAt: stage === 'Applied' ? new Date() : null,
    });
  }

  await notify({
    userId: req.user._id,
    type: 'application-status',
    title: stage === 'Saved' ? 'Opportunity saved' : `Applied to ${opportunity.company}`,
    body:
      stage === 'Saved'
        ? `${opportunity.title} is in your tracker. Move it to Preparing when you start.`
        : `Your application for ${opportunity.title} was submitted. Track it in Applications.`,
    link: '/applications',
    icon: 'send',
  });

  return created(res, { application }, stage === 'Saved' ? 'Saved to your tracker' : 'Application submitted');
});

/** Student's application tracker. */
export const myApplications = asyncHandler(async (req, res) => {
  const apps = await Application.find({ userId: req.user._id })
    .populate('opportunityId')
    .populate('resumeId', 'name template')
    .sort({ updatedAt: -1 })
    .lean();

  const byStage = APPLICATION_STAGES.reduce((acc, s) => {
    acc[s] = apps.filter((a) => a.stage === s).length;
    return acc;
  }, {});

  return ok(res, { applications: apps, byStage, stages: APPLICATION_STAGES });
});

export const getApplication = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id)
    .populate('opportunityId')
    .populate('resumeId', 'name template')
    .populate('userId', 'fullName email profile');
  if (!app) throw ApiError.notFound('Application not found');

  const isOwner = String(app.userId._id) === String(req.user._id);
  if (!isOwner && req.user.role !== 'admin') throw ApiError.forbidden('Not your application');

  return ok(res, { application: app });
});

/** Student can move their own application through preparation stages. */
export const updateMyStage = asyncHandler(async (req, res) => {
  const { stage, note = '' } = req.body;
  const app = await Application.findOne({ _id: req.params.id, userId: req.user._id });
  if (!app) throw ApiError.notFound('Application not found');

  const selfManageable = ['Saved', 'Preparing', 'Applied'];
  if (!selfManageable.includes(stage)) {
    throw ApiError.forbidden(
      'Only the placement cell can move an application beyond "Applied". This keeps the pipeline honest.'
    );
  }

  app.stage = stage;
  if (stage === 'Applied' && !app.appliedAt) app.appliedAt = new Date();
  app.timeline.push({ stage, note, changedBy: req.user._id, at: new Date() });
  await app.save();

  return ok(res, { application: app }, `Moved to ${stage}`);
});

export const withdrawApplication = asyncHandler(async (req, res) => {
  const app = await Application.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!app) throw ApiError.notFound('Application not found');
  return ok(res, { id: req.params.id }, 'Application withdrawn');
});

/** ---- Placement cell: applicant management ---- */

export const listApplicants = asyncHandler(async (req, res) => {
  const {
    opportunityId,
    stage,
    branch,
    minCgpa,
    maxBacklogs,
    graduationYear,
    skill,
    minProfileCompletion,
    search,
  } = req.query;

  const query = {};
  if (opportunityId) query.opportunityId = opportunityId;
  if (stage) query.stage = stage;

  let apps = await Application.find(query)
    .populate('userId', 'fullName email profile avatarColor')
    .populate('opportunityId', 'title company type deadline')
    .populate('resumeId', 'name template')
    .sort({ updatedAt: -1 })
    .lean();

  apps = apps.filter((a) => a.userId);

  // Student-attribute filters applied in memory (explainable + simple).
  if (branch) apps = apps.filter((a) => (a.userId.profile?.branch || '').toLowerCase() === branch.toLowerCase());
  if (minCgpa) apps = apps.filter((a) => (a.userId.profile?.cgpa ?? 0) >= Number(minCgpa));
  if (maxBacklogs !== undefined && maxBacklogs !== '')
    apps = apps.filter((a) => (a.userId.profile?.backlogCount ?? 0) <= Number(maxBacklogs));
  if (graduationYear)
    apps = apps.filter((a) => a.userId.profile?.graduationYear === Number(graduationYear));
  if (skill)
    apps = apps.filter((a) =>
      (a.userId.profile?.skills || []).some((s) => s.toLowerCase().includes(skill.toLowerCase()))
    );
  if (search)
    apps = apps.filter(
      (a) =>
        a.userId.fullName.toLowerCase().includes(search.toLowerCase()) ||
        a.userId.email.toLowerCase().includes(search.toLowerCase())
    );

  // Compute profile completion for each applicant.
  const withCompletion = apps.map((a) => {
    const p = a.userId.profile || {};
    const checks = [
      Boolean(a.userId.fullName),
      Boolean(a.userId.email),
      Boolean(p.college),
      Boolean(p.branch),
      Boolean(p.graduationYear),
      p.cgpa !== null && p.cgpa !== undefined,
      (p.skills || []).length >= 3,
      Boolean(p.currentLevel),
      Boolean(p.weeklyStudyHours),
      (p.careerGoals || []).length > 0,
      Boolean(p.githubUrl),
      Boolean(p.linkedinUrl),
      Boolean(p.codingProfileUrl),
      Boolean(p.portfolioUrl),
      Boolean(p.phone),
    ];
    const completion = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    return { ...a, profileCompletion: completion };
  });

  const filtered = minProfileCompletion
    ? withCompletion.filter((a) => a.profileCompletion >= Number(minProfileCompletion))
    : withCompletion;

  return ok(res, { applicants: filtered, count: filtered.length, stages: APPLICATION_STAGES });
});

/** Placement cell moves a student through the pipeline. */
export const updateApplicantStage = asyncHandler(async (req, res) => {
  const { stage, note = '' } = req.body;
  const app = await Application.findById(req.params.id).populate('opportunityId', 'title company');
  if (!app) throw ApiError.notFound('Application not found');

  const previous = app.stage;
  app.stage = stage;
  app.timeline.push({ stage, note: note || `Moved from ${previous} to ${stage} by placement cell`, changedBy: req.user._id, at: new Date() });
  await app.save();

  await notify({
    userId: app.userId,
    type: 'application-status',
    title: `Application update: ${stage}`,
    body: `Your application for ${app.opportunityId?.title || 'an opportunity'} at ${
      app.opportunityId?.company || ''
    } moved from ${previous} to ${stage}.${note ? ` Note: ${note}` : ''}`,
    link: '/applications',
    icon: stage === 'Selected' ? 'party-popper' : stage === 'Rejected' ? 'x-circle' : 'activity',
    priority: 'high',
  });

  return ok(res, { application: app }, `Applicant moved to ${stage}`);
});

export const addAdminNote = asyncHandler(async (req, res) => {
  const app = await Application.findById(req.params.id);
  if (!app) throw ApiError.notFound('Application not found');
  app.adminNotes = req.body.note || '';
  await app.save();
  return ok(res, { application: app }, 'Note saved');
});

/** CSV export of applicants. */
export const exportApplicantsCSV = asyncHandler(async (req, res) => {
  const { opportunityId } = req.query;
  const query = opportunityId ? { opportunityId } : {};
  const apps = await Application.find(query)
    .populate('userId', 'fullName email profile')
    .populate('opportunityId', 'title company')
    .lean();

  const header = [
    'Student Name',
    'Email',
    'College',
    'Branch',
    'Graduation Year',
    'CGPA',
    'Backlogs',
    'Skills',
    'GitHub',
    'Portfolio',
    'Opportunity',
    'Company',
    'Stage',
    'Applied At',
  ];

  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = apps
    .filter((a) => a.userId)
    .map((a) =>
      [
        a.userId.fullName,
        a.userId.email,
        a.userId.profile?.college,
        a.userId.profile?.branch,
        a.userId.profile?.graduationYear,
        a.userId.profile?.cgpa,
        a.userId.profile?.backlogCount,
        (a.userId.profile?.skills || []).join('; '),
        a.userId.profile?.githubUrl,
        a.userId.profile?.portfolioUrl,
        a.opportunityId?.title,
        a.opportunityId?.company,
        a.stage,
        a.appliedAt ? new Date(a.appliedAt).toISOString() : '',
      ]
        .map(escape)
        .join(',')
    );

  const csv = [header.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="campusorbit-applicants-${Date.now()}.csv"`);
  return res.status(200).send(csv);
});
