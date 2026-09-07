import { z } from 'zod';
import { Quiz, QuizAttempt, StudentProgress, Lesson, RevisionTask } from '../models/index.js';
import { ok, created, ApiError, asyncHandler } from '../utils/apiResponse.js';

export const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        selectedIndex: z.coerce.number().int().min(-1).max(10),
      })
    )
    .min(1, 'Answer at least one question'),
  durationSeconds: z.coerce.number().min(0).optional().default(0),
});

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const safe = {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      topic: q.topic,
    })),
  };
  return ok(res, { quiz: safe });
});

/** Submit answers, grade, persist attempt, unlock lesson completion. */
export const submitQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');

  const { answers, durationSeconds } = req.body;

  const graded = answers.map((a) => {
    const q = quiz.questions.id(a.questionId);
    return {
      questionId: a.questionId,
      selectedIndex: a.selectedIndex,
      correct: q ? q.correctIndex === a.selectedIndex : false,
    };
  });

  const score = graded.filter((g) => g.correct).length;
  const total = quiz.questions.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const passed = percent >= (quiz.passPercent || 60);

  const attempt = await QuizAttempt.create({
    userId: req.user._id,
    quizId: quiz._id,
    lessonId: quiz.lessonId,
    answers: graded,
    score,
    total,
    percent,
    passed,
    durationSeconds,
  });

  // Reflect result on the student's path progress.
  if (quiz.lessonId) {
    const lesson = await Lesson.findById(quiz.lessonId);
    if (lesson) {
      let progress = await StudentProgress.findOne({ userId: req.user._id, pathId: lesson.pathId });
      if (progress) {
        let entry = progress.lessons.find((l) => String(l.lessonId) === String(lesson._id));
        if (!entry) {
          progress.lessons.push({ lessonId: lesson._id, milestoneId: lesson.milestoneId });
          entry = progress.lessons[progress.lessons.length - 1];
        }
        if (passed) entry.quizPassed = true;
        await progress.save();
      }

      // Weak topics -> schedule revision sooner.
      if (!passed) {
        const exists = await RevisionTask.findOne({
          userId: req.user._id,
          lessonId: lesson._id,
          status: 'pending',
        });
        if (!exists) {
          const due = new Date();
          due.setDate(due.getDate() + 1);
          await RevisionTask.create({
            userId: req.user._id,
            lessonId: lesson._id,
            topic: `${lesson.title} (quiz needs another attempt)`,
            stage: 1,
            dueDate: due,
          });
        }
      }
    }
  }

  // Full review with correct answers + explanations.
  const review = quiz.questions.map((q) => {
    const given = graded.find((g) => String(g.questionId) === String(q._id));
    return {
      questionId: q._id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      selectedIndex: given ? given.selectedIndex : -1,
      correct: given ? given.correct : false,
      explanation: q.explanation,
    };
  });

  return created(
    res,
    { attempt, review, passed, percent, score, total },
    passed ? `Passed with ${percent}%` : `Scored ${percent}% — review the explanations and try again`
  );
});

export const myAttempts = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ userId: req.user._id })
    .populate('lessonId', 'title slug')
    .populate('quizId', 'title')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return ok(res, { attempts });
});

/** ---- Admin quiz CRUD ---- */

export const upsertQuiz = asyncHandler(async (req, res) => {
  const { lessonId, title, description, questions, passPercent } = req.body;
  if (!lessonId) throw ApiError.badRequest('lessonId is required');
  if (!Array.isArray(questions) || !questions.length) {
    throw ApiError.badRequest('Add at least one question');
  }

  let quiz = await Quiz.findOne({ lessonId });
  if (quiz) {
    quiz.title = title || quiz.title;
    quiz.description = description ?? quiz.description;
    quiz.questions = questions;
    if (passPercent) quiz.passPercent = passPercent;
    quiz.generationMode = 'human';
    await quiz.save();
  } else {
    quiz = await Quiz.create({
      lessonId,
      title: title || 'Lesson quiz',
      description,
      questions,
      passPercent: passPercent || 60,
      generationMode: 'human',
    });
  }
  return ok(res, { quiz }, 'Quiz saved');
});

export const deleteQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findByIdAndDelete(req.params.id);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  return ok(res, { id: req.params.id }, 'Quiz deleted');
});
