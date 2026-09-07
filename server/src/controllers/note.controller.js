import { z } from 'zod';
import { Lesson, Note, Flashcard, Quiz, RevisionTask } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import {
  generateNotesFromTranscript,
  generateFlashcards,
  generateQuiz,
  simplifyExplanation,
  aiStatus,
} from '../services/ai.service.js';

export const personalNoteSchema = z.object({
  lessonId: z.string().min(1),
  title: z.string().max(160).optional(),
  body: z.string().min(1, 'Write something first').max(20000),
  highlights: z.array(z.string()).optional(),
});

export const getAIStatus = asyncHandler(async (req, res) => ok(res, aiStatus()));

/**
 * Generate AI notes + flashcards + quiz for a lesson.
 * ONLY works when the lesson has an authorized transcript (admin-provided).
 */
export const generateForLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  if (!lesson.authorizedTranscript || lesson.transcriptSource === 'none') {
    throw ApiError.badRequest(
      'This lesson has no authorized transcript. CampusOrbit only generates notes from admin-provided or creator-permitted content — we never scrape arbitrary YouTube videos.'
    );
  }

  const generated = generateNotesFromTranscript({
    title: lesson.title,
    topic: lesson.topic || lesson.title,
    transcript: lesson.authorizedTranscript,
    duration: lesson.primaryVideo?.duration || 0,
  });
  if (!generated) throw ApiError.badRequest('Transcript is too short to generate useful notes');

  const publishNow = req.body?.publish === true;

  let note = await Note.findOne({ lessonId: lesson._id, kind: 'ai' });
  const payload = {
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
    status: publishNow ? 'published' : 'draft',
    reviewedBy: req.user._id,
  };

  if (note) {
    Object.assign(note, payload);
    await note.save();
  } else {
    note = await Note.create(payload);
  }

  // Flashcards
  await Flashcard.deleteMany({ lessonId: lesson._id, userId: null });
  const cards = generateFlashcards(generated, lesson.topic || lesson.title);
  const savedCards = await Flashcard.insertMany(
    cards.map((c) => ({ ...c, lessonId: lesson._id, noteId: note._id, generationMode: generated.mode }))
  );

  // Quiz
  const quizData = generateQuiz(generated, lesson.title, lesson.topic || lesson.title);
  let quiz = await Quiz.findOne({ lessonId: lesson._id });
  if (quiz) {
    quiz.title = quizData.title;
    quiz.description = quizData.description;
    quiz.questions = quizData.questions;
    quiz.generationMode = quizData.mode;
    await quiz.save();
  } else {
    quiz = await Quiz.create({
      lessonId: lesson._id,
      milestoneId: lesson.milestoneId,
      title: quizData.title,
      description: quizData.description,
      questions: quizData.questions,
      passPercent: quizData.passPercent,
      generationMode: quizData.mode,
    });
  }

  return created(
    res,
    { note, flashcards: savedCards, quiz, aiStatus: aiStatus() },
    `Generated notes, ${savedCards.length} flashcards and a ${quiz.questions.length}-question quiz`
  );
});

/** Admin: review queue of AI notes. */
export const listNotesForReview = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const q = { kind: 'ai' };
  if (status) q.status = status;
  const notes = await Note.find(q).populate('lessonId', 'title slug topic').sort({ updatedAt: -1 }).lean();
  return ok(res, { notes });
});

export const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');

  // Students may only edit their own personal notes.
  if (note.kind === 'personal' && String(note.userId) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only edit your own notes');
  }
  if (note.kind === 'ai' && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only admins can edit AI notes');
  }

  const editable = [
    'title',
    'summary',
    'keyConcepts',
    'definitions',
    'practicalExamples',
    'sections',
    'interviewQuestions',
    'beginnerExplanation',
    'hinglishExplanation',
    'revisionSummary',
    'body',
    'highlights',
    'status',
  ];
  editable.forEach((f) => {
    if (req.body[f] !== undefined) note[f] = req.body[f];
  });
  if (note.kind === 'ai' && req.body.status) note.reviewedBy = req.user._id;

  await note.save();
  return ok(res, { note }, 'Note updated');
});

export const publishNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  note.status = note.status === 'published' ? 'draft' : 'published';
  note.reviewedBy = req.user._id;
  await note.save();
  return ok(res, { note }, `Note ${note.status}`);
});

/** ---- Student personal notes ---- */

export const createPersonalNote = asyncHandler(async (req, res) => {
  const { lessonId, title, body, highlights = [] } = req.body;
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');

  const note = await Note.create({
    lessonId,
    userId: req.user._id,
    kind: 'personal',
    title: title || `My notes — ${lesson.title}`,
    body,
    highlights,
    generationMode: 'human',
    generatedFrom: 'student-content',
    status: 'published',
  });
  return created(res, { note }, 'Personal note saved');
});

export const myNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ userId: req.user._id })
    .populate('lessonId', 'title slug')
    .sort({ updatedAt: -1 })
    .lean();
  const bookmarkedAI = await Note.find({ kind: 'ai', bookmarked: true, status: 'published' })
    .populate('lessonId', 'title slug')
    .lean();
  return ok(res, { notes, bookmarkedAI });
});

export const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  if (note.kind === 'personal' && String(note.userId) !== String(req.user._id)) {
    throw ApiError.forbidden('You can only delete your own notes');
  }
  if (note.kind === 'ai' && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only admins can delete AI notes');
  }
  await note.deleteOne();
  return ok(res, { id: req.params.id }, 'Note deleted');
});

export const toggleBookmark = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  note.bookmarked = !note.bookmarked;
  await note.save();
  return ok(res, { note }, note.bookmarked ? 'Bookmarked' : 'Bookmark removed');
});

/** Mark a topic for spaced revision (1 -> 7 -> 21 days). */
export const markForRevision = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id).populate('lessonId', 'title');
  if (!note) throw ApiError.notFound('Note not found');

  note.markedForRevision = true;
  await note.save();

  const due = new Date();
  due.setDate(due.getDate() + 1);

  const existing = await RevisionTask.findOne({
    userId: req.user._id,
    noteId: note._id,
    status: 'pending',
  });
  if (existing) return ok(res, { revisionTask: existing }, 'Already scheduled for revision');

  const task = await RevisionTask.create({
    userId: req.user._id,
    noteId: note._id,
    lessonId: note.lessonId?._id || note.lessonId,
    topic: note.lessonId?.title || note.title || 'Revision topic',
    stage: 1,
    dueDate: due,
  });
  return created(res, { revisionTask: task }, 'Added to revision — first review in 1 day');
});

/** Simpler explanation on demand. */
export const simplify = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  const source = [note.summary, note.beginnerExplanation, note.body].filter(Boolean).join(' ');
  const result = simplifyExplanation(source, note.title);
  return ok(res, { ...result, aiStatus: aiStatus() });
});

export const addHighlight = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text) throw ApiError.badRequest('Nothing to highlight');
  const note = await Note.findById(req.params.id);
  if (!note) throw ApiError.notFound('Note not found');
  if (!note.highlights.includes(text)) note.highlights.push(text);
  await note.save();
  return ok(res, { highlights: note.highlights }, 'Highlight saved');
});
