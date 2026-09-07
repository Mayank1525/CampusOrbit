import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, RotateCcw, Trophy,
  Lightbulb, Clock, HelpCircle, Target,
} from 'lucide-react';
import { quizAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Badge, ProgressBar, Spinner, ProgressRing } from './ui/Primitives';
import { formatDuration } from '../utils/helpers';

export default function QuizRunner({ quiz, onCompleted, compact = false }) {
  const toast = useToast();
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(Date.now());

  useEffect(() => {
    if (result) return undefined;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [result]);

  if (!quiz?.questions?.length) {
    return (
      <div className="text-center py-10">
        <HelpCircle size={26} className="text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No quiz is attached to this lesson yet.</p>
      </div>
    );
  }

  const questions = quiz.questions;
  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const select = (qid, optIndex) => {
    if (result) return;
    setAnswers((a) => ({ ...a, [qid]: optIndex }));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        answers: questions.map((q) => ({
          questionId: q._id,
          selectedIndex: answers[q._id] ?? -1,
        })),
        durationSeconds: Math.floor((Date.now() - startedRef.current) / 1000),
      };
      const res = await quizAPI.submit(quiz._id, payload);
      setResult(res);
      toast[res.passed ? 'success' : 'warning'](
        res.passed
          ? `Passed with ${res.percent}% — well done!`
          : `Scored ${res.percent}%. Read the explanations, then retry.`
      );
      onCompleted?.(res);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setElapsed(0);
    startedRef.current = Date.now();
  };

  /* -------------------------------------------------------- results view */
  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div
          className={`rounded-2xl border p-6 text-center relative overflow-hidden ${
            result.passed
              ? 'border-emerald-400/30 bg-emerald-500/[0.07]'
              : 'border-amber-400/30 bg-amber-500/[0.07]'
          }`}
        >
          <div
            className={`absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-3xl ${
              result.passed ? 'bg-emerald-400/20' : 'bg-amber-400/18'
            }`}
          />
          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="mb-4"
            >
              <ProgressRing
                value={result.percent}
                size={104}
                stroke={8}
                tone={result.passed ? 'mint' : 'amber'}
                sublabel="score"
              />
            </motion.div>
            <h3 className="text-xl font-bold text-white font-display mb-1.5">
              {result.passed ? 'Quiz passed 🎉' : 'Not quite yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              You got <strong className="text-white">{result.score}</strong> of{' '}
              <strong className="text-white">{result.total}</strong> correct in {formatDuration(elapsed)}.
              {!result.passed && ` You need ${quiz.passPercent || 60}% to pass.`}
            </p>
            <div className="flex gap-2.5 flex-wrap justify-center">
              <button onClick={retry} className="btn-secondary btn-sm">
                <RotateCcw size={14} /> Try again
              </button>
              {result.passed && (
                <Badge tone="mint" icon={Trophy}>Counted towards your preparation score</Badge>
              )}
            </div>
          </div>
        </div>

        {/* full review with explanations */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Lightbulb size={12} /> Review — every answer explained
          </p>
          {result.review.map((r, i) => (
            <motion.div
              key={r.questionId}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border p-4 ${
                r.correct ? 'border-emerald-400/22 bg-emerald-400/[0.045]' : 'border-rose-400/22 bg-rose-400/[0.045]'
              }`}
            >
              <div className="flex items-start gap-2.5 mb-3">
                {r.correct ? (
                  <CheckCircle2 size={17} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={17} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <p className="text-sm font-semibold text-slate-100 leading-snug">
                  {i + 1}. {r.question}
                </p>
              </div>
              <div className="space-y-1.5 ml-7">
                {r.options.map((o, oi) => {
                  const isCorrect = oi === r.correctIndex;
                  const isChosen = oi === r.selectedIndex;
                  return (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] ${
                        isCorrect
                          ? 'bg-emerald-500/12 text-emerald-200 border border-emerald-400/25'
                          : isChosen
                          ? 'bg-rose-500/12 text-rose-200 border border-rose-400/25'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="w-4 text-[11px] font-bold opacity-70">{String.fromCharCode(65 + oi)}</span>
                      <span className="flex-1">{o}</span>
                      {isCorrect && <span className="text-[10px] font-bold uppercase">Correct</span>}
                      {isChosen && !isCorrect && <span className="text-[10px] font-bold uppercase">Your answer</span>}
                    </div>
                  );
                })}
              </div>
              {r.explanation && (
                <div className="ml-7 mt-3 rounded-lg bg-white/[0.035] border border-white/[0.07] px-3 py-2.5">
                  <p className="text-[12px] text-slate-300 leading-relaxed">
                    <strong className="text-slate-200">Why: </strong>
                    {r.explanation}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  /* ---------------------------------------------------------- quiz view */
  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white font-display">{quiz.title}</h3>
            {quiz.generationMode === 'demo' && <Badge tone="amber">Demo AI Mode</Badge>}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {questions.length} questions · pass at {quiz.passPercent || 60}%
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-slate-400 tabular-nums">
          <Clock size={13} /> {formatDuration(elapsed)}
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span>Question {index + 1} of {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <ProgressBar value={(answeredCount / questions.length) * 100} tone="cyan" height="h-1.5" />
      </div>

      {/* question dots */}
      <div className="flex gap-1.5 flex-wrap">
        {questions.map((q, i) => (
          <button
            key={q._id}
            onClick={() => setIndex(i)}
            aria-label={`Go to question ${i + 1}`}
            className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
              i === index
                ? 'bg-orbit-violet text-white scale-110'
                : answers[q._id] !== undefined
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-white/[0.05] text-slate-500 border border-white/10 hover:border-white/25'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* question card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current._id}
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -22 }}
          transition={{ duration: 0.22 }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5"
        >
          <div className="flex items-start gap-2.5 mb-4">
            <Target size={16} className="text-orbit-violet shrink-0 mt-1" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white leading-snug">{current.question}</p>
              {current.topic && <p className="text-[11px] text-slate-500 mt-1">Topic: {current.topic}</p>}
            </div>
          </div>

          <div className="space-y-2">
            {current.options.map((o, oi) => {
              const selected = answers[current._id] === oi;
              return (
                <motion.button
                  key={oi}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => select(current._id, oi)}
                  className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    selected
                      ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white'
                      : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25 hover:bg-white/[0.045]'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 border ${
                      selected ? 'bg-orbit-violet border-orbit-violet text-white' : 'border-white/20 text-slate-400'
                    }`}
                  >
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="text-sm">{o}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* nav */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="btn-secondary btn-sm"
        >
          <ArrowLeft size={14} /> Previous
        </button>

        {index < questions.length - 1 ? (
          <button onClick={() => setIndex((i) => i + 1)} className="btn-primary btn-sm">
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <button onClick={submit} disabled={!allAnswered || submitting} className="btn-primary btn-sm">
            {submitting ? <><Spinner size={13} /> Grading…</> : <><CheckCircle2 size={14} /> Submit quiz</>}
          </button>
        )}
      </div>

      {!allAnswered && index === questions.length - 1 && (
        <p className="text-[11px] text-amber-300 text-center">
          Answer all {questions.length} questions before submitting ({questions.length - answeredCount} left).
        </p>
      )}
    </div>
  );
}
