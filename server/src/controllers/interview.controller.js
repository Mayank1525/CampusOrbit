import { z } from 'zod';
import { InterviewQuestion, InterviewAttempt, Resume } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';
import { evaluateInterviewAnswer, aiStatus } from '../services/ai.service.js';

export const answerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().min(10, 'Write at least a couple of sentences').max(8000),
  resumeContextId: z.string().optional().nullable(),
  sessionId: z.string().optional(),
});

/** Fetch a practice set filtered by role/topic/difficulty. */
export const getQuestions = asyncHandler(async (req, res) => {
  const { role, topic, difficulty, category, limit = 10 } = req.query;
  const q = { isActive: true };
  if (role) q.role = role;
  if (topic) q.topic = topic;
  if (difficulty) q.difficulty = difficulty;
  if (category) q.category = category;

  const questions = await InterviewQuestion.find(q)
    .select('-idealAnswerOutline -mustMentionKeywords')
    .limit(Number(limit))
    .lean();

  const [roles, topics] = await Promise.all([
    InterviewQuestion.distinct('role', { isActive: true }),
    InterviewQuestion.distinct('topic', { isActive: true }),
  ]);

  return ok(res, { questions, filters: { roles, topics }, aiStatus: aiStatus() });
});

/** Submit a written answer and receive structured feedback. */
export const submitAnswer = asyncHandler(async (req, res) => {
  const { questionId, answerText, resumeContextId, sessionId = '' } = req.body;

  const question = await InterviewQuestion.findById(questionId);
  if (!question) throw ApiError.notFound('Question not found');

  let resumeContext = null;
  if (resumeContextId) {
    resumeContext = await Resume.findOne({ _id: resumeContextId, userId: req.user._id }).lean();
  }

  const feedback = evaluateInterviewAnswer({ question, answer: answerText, resumeContext });

  const attempt = await InterviewAttempt.create({
    userId: req.user._id,
    questionId: question._id,
    questionText: question.question,
    role: question.role,
    topic: question.topic,
    difficulty: question.difficulty,
    answerText,
    wordCount: answerText.trim().split(/\s+/).filter(Boolean).length,
    resumeContextId: resumeContext?._id || null,
    feedback,
    sessionId,
  });

  return created(
    res,
    {
      attempt,
      feedback,
      idealAnswerOutline: question.idealAnswerOutline,
      followUps: question.followUps,
      aiStatus: aiStatus(),
    },
    'Answer evaluated'
  );
});

/** Attempt history + improvement trend. */
export const myAttempts = asyncHandler(async (req, res) => {
  const attempts = await InterviewAttempt.find({ userId: req.user._id })
    .sort({ createdAt: 1 })
    .lean();

  const trend = attempts.map((a, i) => ({
    index: i + 1,
    date: a.createdAt,
    overall: a.feedback?.overall || 0,
    technical: a.feedback?.technicalAccuracy || 0,
    clarity: a.feedback?.clarity || 0,
    structure: a.feedback?.structure || 0,
    topic: a.topic,
  }));

  const avg = (key) =>
    attempts.length
      ? Math.round((attempts.reduce((s, a) => s + (a.feedback?.[key] || 0), 0) / attempts.length) * 10) / 10
      : 0;

  const recent = attempts.slice(-5);
  const earlier = attempts.slice(0, Math.max(0, attempts.length - 5));
  const recentAvg = recent.length
    ? recent.reduce((s, a) => s + (a.feedback?.overall || 0), 0) / recent.length
    : 0;
  const earlierAvg = earlier.length
    ? earlier.reduce((s, a) => s + (a.feedback?.overall || 0), 0) / earlier.length
    : 0;

  // Weakest topics by average score
  const byTopic = {};
  attempts.forEach((a) => {
    const t = a.topic || 'General';
    byTopic[t] = byTopic[t] || { total: 0, count: 0 };
    byTopic[t].total += a.feedback?.overall || 0;
    byTopic[t].count += 1;
  });
  const topicScores = Object.entries(byTopic)
    .map(([topic, v]) => ({ topic, average: Math.round((v.total / v.count) * 10) / 10, attempts: v.count }))
    .sort((a, b) => a.average - b.average);

  return ok(res, {
    attempts: attempts.slice().reverse(),
    trend,
    stats: {
      total: attempts.length,
      averageOverall: avg('overall'),
      averageTechnical: avg('technicalAccuracy'),
      averageClarity: avg('clarity'),
      averageStructure: avg('structure'),
      improvement: Math.round((recentAvg - earlierAvg) * 10) / 10,
    },
    weakestTopics: topicScores.slice(0, 3),
    strongestTopics: topicScores.slice(-3).reverse(),
  });
});

export const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await InterviewAttempt.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!attempt) throw ApiError.notFound('Attempt not found');
  const question = await InterviewQuestion.findById(attempt.questionId).lean();
  return ok(res, { attempt, question });
});

/** ---- Admin question bank CRUD ---- */

export const createQuestion = asyncHandler(async (req, res) => {
  const question = await InterviewQuestion.create({ ...req.body, createdBy: req.user._id });
  return created(res, { question }, 'Question added to the bank');
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await InterviewQuestion.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!question) throw ApiError.notFound('Question not found');
  return ok(res, { question }, 'Question updated');
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await InterviewQuestion.findByIdAndDelete(req.params.id);
  if (!question) throw ApiError.notFound('Question not found');
  return ok(res, { id: req.params.id }, 'Question deleted');
});

export const listAllQuestions = asyncHandler(async (req, res) => {
  const questions = await InterviewQuestion.find().sort({ createdAt: -1 }).lean();
  return ok(res, { questions });
});
