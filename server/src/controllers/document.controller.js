import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { Document, Opportunity, Resume } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { buildDocumentChecklist } from '../services/eligibility.service.js';

export const linkSchema = z.object({
  label: z.string().min(1).max(120),
  category: z.enum([
    'resume',
    'marksheet',
    'certificate',
    'photo',
    'government-id',
    'project-link',
    'coding-profile',
    'other',
  ]),
  url: z.string().min(4).max(400),
  notes: z.string().max(500).optional(),
});

export const listDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  const grouped = documents.reduce((acc, d) => {
    acc[d.category] = acc[d.category] || [];
    acc[d.category].push(d);
    return acc;
  }, {});
  return ok(res, { documents, grouped });
});

export const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose a file to upload');
  const { label, category = 'other', notes = '' } = req.body;

  const doc = await Document.create({
    userId: req.user._id,
    label: label || req.file.originalname,
    category,
    kind: 'file',
    fileName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    notes,
    isPrivate: true,
  });

  return created(res, { document: doc }, 'Document uploaded to your private wallet');
});

export const addLink = asyncHandler(async (req, res) => {
  const doc = await Document.create({
    userId: req.user._id,
    label: req.body.label,
    category: req.body.category,
    kind: 'link',
    url: req.body.url,
    notes: req.body.notes || '',
    isPrivate: false,
  });
  return created(res, { document: doc }, 'Link added');
});

/** Private download — only the owner can stream their file. */
export const downloadDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw ApiError.notFound('Document not found');
  if (String(doc.userId) !== String(req.user._id)) {
    throw ApiError.forbidden('Private documents are only accessible to their owner');
  }
  if (doc.kind !== 'file') throw ApiError.badRequest('This entry is a link, not a file');

  const filePath = path.join(UPLOAD_ROOT, doc.storedName);
  if (!fs.existsSync(filePath)) throw ApiError.notFound('File missing on server');

  res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
  return fs.createReadStream(filePath).pipe(res);
});

export const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await Document.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!doc) throw ApiError.notFound('Document not found');
  if (doc.kind === 'file' && doc.storedName) {
    const filePath = path.join(UPLOAD_ROOT, doc.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  return ok(res, { id: req.params.id }, 'Document deleted');
});

/** Checklist for a specific opportunity. */
export const checklistForOpportunity = asyncHandler(async (req, res) => {
  const opportunity = await Opportunity.findById(req.params.opportunityId).lean();
  if (!opportunity) throw ApiError.notFound('Opportunity not found');

  const [docs, resumes] = await Promise.all([
    Document.find({ userId: req.user._id }).lean(),
    Resume.find({ userId: req.user._id }).lean(),
  ]);

  const checklist = buildDocumentChecklist(req.user, opportunity, docs, resumes);
  const ready = checklist.every((c) => c.satisfied);

  return ok(res, {
    opportunity: { _id: opportunity._id, title: opportunity.title, company: opportunity.company },
    checklist,
    ready,
    missing: checklist.filter((c) => !c.satisfied).map((c) => c.label),
  });
});

/** Proof-of-work profile (public-safe: links only, never private files). */
export const proofOfWork = asyncHandler(async (req, res) => {
  const links = await Document.find({
    userId: req.user._id,
    kind: 'link',
    category: { $in: ['project-link', 'coding-profile', 'certificate'] },
  }).lean();

  return ok(res, {
    links,
    profile: {
      github: req.user.profile?.githubUrl || '',
      linkedin: req.user.profile?.linkedinUrl || '',
      portfolio: req.user.profile?.portfolioUrl || '',
      codingProfile: req.user.profile?.codingProfileUrl || '',
    },
  });
});
