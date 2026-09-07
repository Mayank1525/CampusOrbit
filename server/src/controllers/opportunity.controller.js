import { z } from 'zod';
import { Opportunity, Application, User, Document, Resume } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { checkEligibility, buildDocumentChecklist, matchScore } from '../services/eligibility.service.js';
import { notify } from '../services/notification.service.js';

export const opportunitySchema = z.object({
  title: z.string().min(3),
  company: z.string().min(1),
  type: z.enum(['placement', 'internship', 'hackathon', 'scholarship', 'exam']),
  role: z.string().optional(),
  location: z.string().optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  description: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  skillsRequired: z.array(z.string()).optional(),
  stipendOrCtc: z.string().optional(),
  deadline: z.string().min(4),
  driveDate: z.string().optional().nullable(),
  eligibility: z
    .object({
      minCgpa: z.coerce.number().min(0).max(10).optional(),
      allowedBranches: z.array(z.string()).optional(),
      allowedGraduationYears: z.array(z.coerce.number()).optional(),
      maxBacklogs: z.coerce.number().min(0).max(99).optional(),
    })
    .optional(),
  requiredDocuments: z.array(z.string()).optional(),
  rounds: z
    .array(z.object({ name: z.string(), description: z.string().optional(), order: z.coerce.number().optional() }))
    .optional(),
  officialLink: z.string().optional(),
  status: z.enum(['draft', 'published', 'expired', 'closed']).optional(),
  seatsAvailable: z.coerce.number().optional(),
  tags: z.array(z.string()).optional(),
  companyLogoText: z.string().optional(),
});

/** Public/student listing with rich filters. */
export const listOpportunities = asyncHandler(async (req, res) => {
  const {
    search = '',
    type,
    company,
    skill,
    location,
    status,
    sort = 'deadline',
    includeExpired = 'false',
    page = 1,
    limit = 24,
  } = req.query;

  const query = {};
  const isAdmin = req.user?.role === 'admin';

  if (isAdmin && status) query.status = status;
  else if (!isAdmin) query.status = 'published';

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { role: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { skillsRequired: { $regex: search, $options: 'i' } },
    ];
  }
  if (type) query.type = type;
  if (company) query.company = { $regex: company, $options: 'i' };
  if (skill) query.skillsRequired = { $regex: skill, $options: 'i' };
  if (location) query.location = { $regex: location, $options: 'i' };
  if (includeExpired !== 'true' && !isAdmin) query.deadline = { $gte: new Date() };

  const sortMap = {
    deadline: { deadline: 1 },
    newest: { createdAt: -1 },
    company: { company: 1 },
  };

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Opportunity.find(query).sort(sortMap[sort] || sortMap.deadline).skip(skip).limit(Number(limit)).lean(),
    Opportunity.countDocuments(query),
  ]);

  // Attach per-student eligibility + match + application state.
  let enriched = items;
  if (req.user && req.user.role === 'student') {
    const apps = await Application.find({
      userId: req.user._id,
      opportunityId: { $in: items.map((i) => i._id) },
    }).lean();

    enriched = items.map((o) => {
      const el = checkEligibility(req.user, o);
      const ms = matchScore(req.user, o);
      const app = apps.find((a) => String(a.opportunityId) === String(o._id));
      return {
        ...o,
        eligibility: o.eligibility,
        eligibilityResult: el,
        match: ms,
        bookmarked: (req.user.bookmarkedOpportunities || []).some((b) => String(b) === String(o._id)),
        application: app ? { _id: app._id, stage: app.stage } : null,
      };
    });
  }

  return ok(res, {
    opportunities: enriched,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
});

export const getOpportunity = asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(req.params.id).lean();
  if (!o) throw ApiError.notFound('Opportunity not found');
  if (o.status !== 'published' && req.user?.role !== 'admin') {
    throw ApiError.forbidden('This opportunity is not published yet');
  }

  let eligibilityResult = null;
  let checklist = null;
  let application = null;
  let match = null;

  if (req.user && req.user.role === 'student') {
    eligibilityResult = checkEligibility(req.user, o);
    match = matchScore(req.user, o);
    const [docs, resumes] = await Promise.all([
      Document.find({ userId: req.user._id }).lean(),
      Resume.find({ userId: req.user._id }).lean(),
    ]);
    checklist = buildDocumentChecklist(req.user, o, docs, resumes);
    application = await Application.findOne({ userId: req.user._id, opportunityId: o._id }).lean();
  }

  const applicantCount = await Application.countDocuments({ opportunityId: o._id });

  return ok(res, { opportunity: o, eligibilityResult, checklist, application, match, applicantCount });
});

export const toggleBookmarkOpportunity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const id = req.params.id;
  const exists = user.bookmarkedOpportunities.some((b) => String(b) === String(id));
  if (exists) {
    user.bookmarkedOpportunities = user.bookmarkedOpportunities.filter((b) => String(b) !== String(id));
  } else {
    user.bookmarkedOpportunities.push(id);
  }
  await user.save({ validateBeforeSave: false });
  return ok(res, { bookmarked: !exists }, exists ? 'Bookmark removed' : 'Bookmarked');
});

export const listBookmarks = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('bookmarkedOpportunities');
  return ok(res, { opportunities: user.bookmarkedOpportunities || [] });
});

/** Personalised matches for the dashboard. */
export const matchedOpportunities = asyncHandler(async (req, res) => {
  const list = await Opportunity.find({ status: 'published', deadline: { $gte: new Date() } }).lean();
  const scored = list
    .map((o) => ({ opportunity: o, ...matchScore(req.user, o) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(req.query.limit || 5));
  return ok(res, { matches: scored });
});

/** ---- Admin / placement cell CRUD ---- */

export const createOpportunity = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    deadline: new Date(req.body.deadline),
    driveDate: req.body.driveDate ? new Date(req.body.driveDate) : null,
    postedBy: req.user._id,
    companyLogoText: req.body.companyLogoText || req.body.company.slice(0, 2).toUpperCase(),
  };
  const opportunity = await Opportunity.create(payload);

  if (opportunity.status === 'published') await notifyMatchingStudents(opportunity);

  return created(res, { opportunity }, `Opportunity ${opportunity.status === 'published' ? 'published' : 'saved as draft'}`);
});

export const updateOpportunity = asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(req.params.id);
  if (!o) throw ApiError.notFound('Opportunity not found');

  const wasPublished = o.status === 'published';
  Object.entries(req.body).forEach(([k, v]) => {
    if (v !== undefined) {
      if (k === 'deadline' || k === 'driveDate') o[k] = v ? new Date(v) : null;
      else o[k] = v;
    }
  });
  await o.save();

  if (!wasPublished && o.status === 'published') await notifyMatchingStudents(o);

  return ok(res, { opportunity: o }, 'Opportunity updated');
});

export const publishOpportunity = asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(req.params.id);
  if (!o) throw ApiError.notFound('Opportunity not found');
  o.status = o.status === 'published' ? 'draft' : 'published';
  await o.save();
  if (o.status === 'published') await notifyMatchingStudents(o);
  return ok(res, { opportunity: o }, `Opportunity ${o.status}`);
});

export const expireOpportunity = asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(req.params.id);
  if (!o) throw ApiError.notFound('Opportunity not found');
  o.status = 'expired';
  await o.save();
  return ok(res, { opportunity: o }, 'Opportunity marked expired');
});

export const deleteOpportunity = asyncHandler(async (req, res) => {
  const o = await Opportunity.findByIdAndDelete(req.params.id);
  if (!o) throw ApiError.notFound('Opportunity not found');
  await Application.deleteMany({ opportunityId: o._id });
  return ok(res, { id: req.params.id }, 'Opportunity deleted');
});

/** Notify eligible students about a newly published opportunity. */
async function notifyMatchingStudents(opportunity) {
  const students = await User.find({ role: 'student', isActive: true });
  const eligible = students.filter((s) => checkEligibility(s, opportunity).eligible);
  for (const s of eligible) {
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: s._id,
      type: 'opportunity-match',
      title: `New opportunity: ${opportunity.title}`,
      body: `${opportunity.company} is hiring. You meet the eligibility criteria. Deadline ${new Date(
        opportunity.deadline
      ).toDateString()}.`,
      link: `/opportunities/${opportunity._id}`,
      icon: 'briefcase',
      priority: 'high',
      dedupeKey: `opp-${opportunity._id}`,
      meta: { opportunityId: opportunity._id },
    });
  }
  return eligible.length;
}

/** Eligible students preview for a drive (placement cell). */
export const eligibleStudents = asyncHandler(async (req, res) => {
  const o = await Opportunity.findById(req.params.id);
  if (!o) throw ApiError.notFound('Opportunity not found');
  const students = await User.find({ role: 'student', isActive: true });
  const rows = students.map((s) => {
    const el = checkEligibility(s, o);
    return {
      _id: s._id,
      fullName: s.fullName,
      email: s.email,
      branch: s.profile?.branch,
      cgpa: s.profile?.cgpa,
      graduationYear: s.profile?.graduationYear,
      backlogCount: s.profile?.backlogCount,
      profileCompletion: s.profileCompletion(),
      eligible: el.eligible,
      reasons: el.reasons,
    };
  });
  return ok(res, {
    students: rows,
    eligibleCount: rows.filter((r) => r.eligible).length,
    total: rows.length,
  });
});
