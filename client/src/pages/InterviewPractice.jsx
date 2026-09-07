import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Sparkles, RefreshCw, TrendingUp, TrendingDown, Clock,
  CheckCircle2, AlertCircle, Lightbulb, Target, History, ChevronRight, Award,
  FileText, Info, Filter, ArrowRight, Zap, ThumbsUp, ListChecks, Type,
} from 'lucide-react';
import { interviewAPI, resumeAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, ProgressBar, ProgressRing,
} from '../components/ui/Primitives';
import Modal from '../components/ui/Modal';
import { timeAgo, formatDateTime } from '../utils/helpers';

const DIFF_TONE = { easy: 'mint', medium: 'amber', hard: 'coral' };
const CAT_LABEL = {
  technical: 'Technical', project: 'Project deep-dive', hr: 'HR & behavioural',
  aptitude: 'Aptitude', exam: 'Exam oriented',
};

function ScoreBar({ label, value, tone }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px] mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200 font-semibold tabular-nums">{value}/10</span>
      </div>
      <ProgressBar value={value * 10} tone={tone} height="h-1.5" />
    </div>
  );
}

export default function InterviewPractice() {
  const toast = useToast();
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ roles: [], topics: [] });
  const [aiStatus, setAiStatus] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('practice');

  const [query, setQuery] = useState({ role: '', topic: '', difficulty: '', category: '' });
  const [active, setActive] = useState(null);
  const [answer, setAnswer] = useState('');
  const [resumeId, setResumeId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [viewAttempt, setViewAttempt] = useState(null);
  const answerRef = useRef(null);

  const loadQuestions = async (q = query) => {
    try {
      const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v));
      const d = await interviewAPI.questions({ ...params, limit: 30 });
      setQuestions(d.questions || []);
      setFilters(d.filters || { roles: [], topics: [] });
      setAiStatus(d.aiStatus);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadHistory = async () => {
    try {
      const d = await interviewAPI.attempts();
      setHistory(d);
    } catch (e) {
      toast.error(e.message);
    }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadQuestions(), loadHistory()]);
      try {
        const r = await resumeAPI.list();
        setResumes(r.resumes || []);
        const def = (r.resumes || []).find((x) => x.isDefault) || (r.resumes || [])[0];
        if (def) setResumeId(def._id);
      } catch { /* optional */ }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = (patch) => {
    const next = { ...query, ...patch };
    setQuery(next);
    loadQuestions(next);
  };

  const startQuestion = (q) => {
    setActive(q);
    setAnswer('');
    setResult(null);
    setTimeout(() => answerRef.current?.focus(), 250);
  };

  const submit = async () => {
    if (answer.trim().split(/\s+/).filter(Boolean).length < 10) {
      return toast.error('Write at least 10 words — a real interview answer needs substance.');
    }
    setSubmitting(true);
    try {
      const d = await interviewAPI.answer({
        questionId: active._id,
        answerText: answer.trim(),
        resumeContextId: resumeId || undefined,
      });
      setResult(d);
      toast.success(`Evaluated — overall ${d.feedback.overall}/10`);
      loadHistory();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nextQuestion = () => {
    const idx = questions.findIndex((q) => String(q._id) === String(active?._id));
    const next = questions[(idx + 1) % questions.length];
    if (next) startQuestion(next);
  };

  if (loading) return <LoadingScreen label="Loading the interview studio…" />;

  const stats = history?.stats;
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={MessageSquare}
        title="Interview Practice Studio"
        subtitle="Text-only mock interviews with structured feedback. No camera, no mic — just the thinking."
        badge={aiStatus && <Badge tone={aiStatus.mode === 'demo' ? 'amber' : 'violet'} icon={Sparkles}>{aiStatus.label}</Badge>}
        action={
          <Tabs
            tabs={[
              { key: 'practice', label: 'Practice', icon: Zap },
              { key: 'history', label: 'History', icon: History, count: stats?.total || 0 },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {aiStatus?.mode === 'demo' && (
        <Callout tone="amber" icon={Info} title="Demo AI Mode — and we will say so plainly">
          {aiStatus.notice} Feedback is produced by a deterministic rule engine that checks concept coverage,
          sentence structure, answer length and whether you used a real project example. It is genuinely useful for
          practice, but it is <strong>not</strong> a language model reading your answer. Nothing here pretends
          otherwise.
        </Callout>
      )}

      {/* stats */}
      {stats?.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard icon={MessageSquare} label="Attempts" value={stats.total} sub="All time" tone="violet" />
          <StatCard icon={Award} label="Average overall" value={`${stats.averageOverall}/10`} sub={`Technical ${stats.averageTechnical}/10`} tone="cyan" delay={0.06} />
          <StatCard
            icon={stats.improvement >= 0 ? TrendingUp : TrendingDown}
            label="Recent trend"
            value={`${stats.improvement >= 0 ? '+' : ''}${stats.improvement}`}
            sub="Last 5 vs earlier"
            tone={stats.improvement >= 0 ? 'mint' : 'coral'}
            delay={0.12}
          />
          <StatCard icon={Target} label="Weakest topic" value={history.weakestTopics?.[0]?.topic || '—'} sub={history.weakestTopics?.[0] ? `avg ${history.weakestTopics[0].average}/10` : 'Practise more'} tone="amber" delay={0.18} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'practice' ? (
          <motion.div key="practice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
              {/* ------------------------------------------ question list */}
              <div className="space-y-3">
                <MotionCard hover={false} className="p-4">
                  <SectionHeader icon={Filter} title="Pick your questions" className="mb-3.5" />
                  <div className="space-y-2.5">
                    <select className="input text-[13px] py-2" value={query.role} onChange={(e) => applyFilter({ role: e.target.value })} aria-label="Filter by role">
                      <option value="">All roles</option>
                      {filters.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select className="input text-[13px] py-2" value={query.topic} onChange={(e) => applyFilter({ topic: e.target.value })} aria-label="Filter by topic">
                      <option value="">All topics</option>
                      {filters.topics.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input text-[13px] py-2" value={query.difficulty} onChange={(e) => applyFilter({ difficulty: e.target.value })} aria-label="Filter by difficulty">
                        <option value="">Any level</option>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                      <select className="input text-[13px] py-2" value={query.category} onChange={(e) => applyFilter({ category: e.target.value })} aria-label="Filter by category">
                        <option value="">Any type</option>
                        {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                </MotionCard>

                <div className="space-y-2 max-h-[62vh] overflow-y-auto scrollbar-thin pr-1">
                  {questions.length === 0 ? (
                    <MotionCard hover={false} className="p-6">
                      <EmptyState icon={MessageSquare} title="No questions match" description="Widen your filters." />
                    </MotionCard>
                  ) : (
                    questions.map((q, i) => (
                      <motion.button
                        key={q._id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        whileHover={{ x: 3 }}
                        onClick={() => startQuestion(q)}
                        className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                          String(active?._id) === String(q._id)
                            ? 'border-orbit-violet/55 bg-orbit-violet/12'
                            : 'border-white/[0.07] bg-white/[0.025] hover:border-white/22'
                        }`}
                      >
                        <p className="text-[13px] font-medium text-slate-100 leading-snug line-clamp-3 mb-2">
                          {q.question}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge tone={DIFF_TONE[q.difficulty]}>{q.difficulty}</Badge>
                          <Badge tone="slate">{q.topic}</Badge>
                          <Badge tone="cyan">{CAT_LABEL[q.category] || q.category}</Badge>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>

              {/* -------------------------------------------- answer pane */}
              <div className="space-y-4">
                {!active ? (
                  <MotionCard hover={false} className="p-8">
                    <EmptyState
                      icon={MessageSquare}
                      title="Pick a question to begin"
                      description="Choose from the list on the left. Write your answer the way you would say it out loud in the room — full sentences, a concrete example, a trade-off at the end."
                    />
                  </MotionCard>
                ) : (
                  <>
                    <MotionCard hover={false} className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-orbit-violet/15 border border-orbit-violet/28 flex items-center justify-center shrink-0">
                          <MessageSquare size={17} className="text-orbit-violet" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <Badge tone={DIFF_TONE[active.difficulty]}>{active.difficulty}</Badge>
                            <Badge tone="slate">{active.role}</Badge>
                            <Badge tone="cyan">{active.topic}</Badge>
                          </div>
                          <p className="text-[16px] font-semibold text-white leading-snug">{active.question}</p>
                        </div>
                      </div>

                      {!result ? (
                        <>
                          <label className="label" htmlFor="answer">Your answer</label>
                          <textarea
                            ref={answerRef}
                            id="answer"
                            className="input min-h-[220px] resize-y leading-relaxed"
                            placeholder="Structure it: define the concept, explain how it works, give a concrete example from something you actually built, then mention one trade-off or limitation."
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                          />

                          <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
                            <div className="flex items-center gap-3 text-[11.5px] text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <Type size={11} /> {wordCount} words
                              </span>
                              <span className={wordCount >= 60 ? 'text-emerald-400' : wordCount >= 30 ? 'text-amber-400' : 'text-slate-500'}>
                                {wordCount >= 60 ? 'Good depth' : wordCount >= 30 ? 'Add more detail' : 'Aim for 60+ words'}
                              </span>
                            </div>

                            {resumes.length > 0 && (
                              <select
                                className="input text-[12px] py-1.5 w-auto"
                                value={resumeId}
                                onChange={(e) => setResumeId(e.target.value)}
                                aria-label="Resume context"
                              >
                                <option value="">No resume context</option>
                                {resumes.map((r) => <option key={r._id} value={r._id}>Context: {r.name}</option>)}
                              </select>
                            )}
                          </div>

                          <button onClick={submit} disabled={submitting || wordCount < 10} className="btn-primary w-full mt-3.5">
                            {submitting ? <><Spinner size={14} /> Evaluating…</> : <><Send size={15} /> Get structured feedback</>}
                          </button>
                        </>
                      ) : (
                        <div className="space-y-4">
                          {/* your answer */}
                          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Your answer</p>
                            <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{answer}</p>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => { setResult(null); }} className="btn-secondary btn-sm flex-1">
                              <RefreshCw size={13} /> Rewrite this answer
                            </button>
                            <button onClick={nextQuestion} className="btn-primary btn-sm flex-1">
                              Next question <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </MotionCard>

                    {/* feedback */}
                    <AnimatePresence>
                      {result && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-4"
                        >
                          <MotionCard hover={false} className="p-5">
                            <div className="flex items-center gap-5 mb-5 flex-wrap">
                              <ProgressRing
                                value={result.feedback.overall * 10}
                                size={92}
                                tone={result.feedback.overall >= 7 ? 'mint' : result.feedback.overall >= 5 ? 'amber' : 'coral'}
                                label={`${result.feedback.overall}`}
                                sublabel="/ 10"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-[15px] font-bold text-white mb-1">{result.feedback.verdict}</p>
                                <p className="text-[12px] text-slate-400 leading-relaxed">
                                  Scored on concept coverage, clarity, structure and whether you used a real example.
                                </p>
                                {result.aiStatus?.mode === 'demo' && (
                                  <Badge tone="amber" icon={Sparkles} className="mt-2">{result.aiStatus.label}</Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
                              <ScoreBar label="Technical accuracy" value={result.feedback.technicalAccuracy} tone="violet" />
                              <ScoreBar label="Clarity" value={result.feedback.clarity} tone="cyan" />
                              <ScoreBar label="Structure" value={result.feedback.structure} tone="mint" />
                              <div>
                                <div className="flex items-center justify-between text-[11.5px] mb-1">
                                  <span className="text-slate-400">Used a project example</span>
                                  <span className={result.feedback.usedProjectExample ? 'text-emerald-400' : 'text-amber-400'}>
                                    {result.feedback.usedProjectExample ? 'Yes' : 'No'}
                                  </span>
                                </div>
                                <ProgressBar value={result.feedback.usedProjectExample ? 100 : 25} tone={result.feedback.usedProjectExample ? 'mint' : 'amber'} height="h-1.5" />
                              </div>
                            </div>
                          </MotionCard>

                          <div className="grid md:grid-cols-2 gap-4">
                            {result.feedback.strengths?.length > 0 && (
                              <MotionCard hover={false} className="p-5">
                                <SectionHeader icon={ThumbsUp} title="What worked" className="mb-3" />
                                <ul className="space-y-2">
                                  {result.feedback.strengths.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed">
                                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                      {s}
                                    </li>
                                  ))}
                                </ul>
                              </MotionCard>
                            )}

                            {result.feedback.missingConcepts?.length > 0 && (
                              <MotionCard hover={false} className="p-5">
                                <SectionHeader icon={AlertCircle} title="Concepts you missed" className="mb-3" />
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {result.feedback.missingConcepts.map((c) => (
                                    <span key={c} className="chip-coral">{c}</span>
                                  ))}
                                </div>
                                <p className="text-[12px] text-slate-400 leading-relaxed">
                                  Interviewers listen for these specific words. Work them into your next attempt.
                                </p>
                              </MotionCard>
                            )}
                          </div>

                          {result.feedback.improvedAnswerOutline?.length > 0 && (
                            <MotionCard hover={false} className="p-5">
                              <SectionHeader icon={Lightbulb} title="How to structure this answer next time" className="mb-3.5" />
                              <ol className="space-y-2.5">
                                {result.feedback.improvedAnswerOutline.map((s, i) => (
                                  <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    className="flex gap-3 text-[13px] text-slate-300 leading-relaxed"
                                  >
                                    <span className="w-5 h-5 rounded-md bg-orbit-violet/15 border border-orbit-violet/28 text-[10px] font-bold text-orbit-violet flex items-center justify-center shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    {s}
                                  </motion.li>
                                ))}
                              </ol>
                            </MotionCard>
                          )}

                          <div className="grid md:grid-cols-2 gap-4">
                            {result.idealAnswerOutline?.length > 0 && (
                              <MotionCard hover={false} className="p-5">
                                <SectionHeader icon={ListChecks} title="What a strong answer covers" className="mb-3" />
                                <ul className="space-y-2">
                                  {result.idealAnswerOutline.map((s, i) => (
                                    <li key={i} className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed">
                                      <span className="text-orbit-cyan mt-0.5 shrink-0">▸</span> {s}
                                    </li>
                                  ))}
                                </ul>
                              </MotionCard>
                            )}

                            {result.followUps?.length > 0 && (
                              <MotionCard hover={false} className="p-5">
                                <SectionHeader icon={MessageSquare} title="Likely follow-up questions" className="mb-3" />
                                <ul className="space-y-2">
                                  {result.followUps.map((s, i) => (
                                    <li key={i} className="text-[13px] text-slate-300 leading-relaxed flex gap-2.5">
                                      <span className="text-rose-400 font-bold shrink-0">{i + 1}.</span> {s}
                                    </li>
                                  ))}
                                </ul>
                              </MotionCard>
                            )}
                          </div>

                          {result.feedback.recommendedNextTopic && (
                            <Callout tone="cyan" icon={Target} title="Recommended next">
                              {result.feedback.recommendedNextTopic}
                            </Callout>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* --------------------------------------------------- history */
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {!history?.attempts?.length ? (
              <MotionCard hover={false} className="p-8">
                <EmptyState
                  icon={History}
                  title="No attempts yet"
                  description="Answer one question and your full history with feedback appears here."
                  action={<button onClick={() => setTab('practice')} className="btn-primary"><Zap size={15} /> Start practising</button>}
                />
              </MotionCard>
            ) : (
              <>
                {(history.weakestTopics?.length > 0 || history.strongestTopics?.length > 0) && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <MotionCard hover={false} className="p-5">
                      <SectionHeader icon={TrendingDown} title="Topics to work on" className="mb-3.5" />
                      <div className="space-y-2.5">
                        {history.weakestTopics.map((t) => (
                          <div key={t.topic}>
                            <div className="flex items-center justify-between text-[12.5px] mb-1">
                              <span className="text-slate-300">{t.topic}</span>
                              <span className="text-slate-500 tabular-nums">{t.average}/10 · {t.attempts} attempt{t.attempts === 1 ? '' : 's'}</span>
                            </div>
                            <ProgressBar value={t.average * 10} tone={t.average >= 7 ? 'mint' : t.average >= 5 ? 'amber' : 'coral'} height="h-1.5" />
                          </div>
                        ))}
                      </div>
                    </MotionCard>

                    <MotionCard hover={false} className="p-5">
                      <SectionHeader icon={TrendingUp} title="Your strongest topics" className="mb-3.5" />
                      <div className="space-y-2.5">
                        {history.strongestTopics.map((t) => (
                          <div key={t.topic}>
                            <div className="flex items-center justify-between text-[12.5px] mb-1">
                              <span className="text-slate-300">{t.topic}</span>
                              <span className="text-slate-500 tabular-nums">{t.average}/10</span>
                            </div>
                            <ProgressBar value={t.average * 10} tone="mint" height="h-1.5" />
                          </div>
                        ))}
                      </div>
                    </MotionCard>
                  </div>
                )}

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {history.attempts.map((a, i) => (
                    <motion.button
                      key={a._id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      whileHover={{ y: -4 }}
                      onClick={() => setViewAttempt(a)}
                      className="glass p-4 text-left group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge tone={DIFF_TONE[a.difficulty]}>{a.difficulty}</Badge>
                          <Badge tone="slate">{a.topic}</Badge>
                        </div>
                        <span
                          className={`text-lg font-bold font-display tabular-nums shrink-0 ${
                            a.feedback?.overall >= 7 ? 'text-emerald-400' : a.feedback?.overall >= 5 ? 'text-amber-400' : 'text-rose-400'
                          }`}
                        >
                          {a.feedback?.overall}
                          <span className="text-[11px] text-slate-500 font-normal">/10</span>
                        </span>
                      </div>

                      <p className="text-[13px] font-medium text-slate-100 leading-snug line-clamp-2 mb-2.5">
                        {a.questionText}
                      </p>

                      <div className="grid grid-cols-3 gap-1.5 mb-3">
                        {[
                          { l: 'Tech', v: a.feedback?.technicalAccuracy },
                          { l: 'Clarity', v: a.feedback?.clarity },
                          { l: 'Struct', v: a.feedback?.structure },
                        ].map((s) => (
                          <div key={s.l} className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
                            <p className="text-[12px] font-bold text-slate-200 tabular-nums">{s.v}</p>
                            <p className="text-[8.5px] uppercase tracking-wide text-slate-500">{s.l}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.06]">
                        <span className="text-[10.5px] text-slate-500">{timeAgo(a.createdAt)} · {a.wordCount} words</span>
                        <ChevronRight size={13} className="text-slate-600 group-hover:text-orbit-violet transition-colors" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* attempt detail */}
      <Modal
        open={Boolean(viewAttempt)}
        onClose={() => setViewAttempt(null)}
        title="Attempt review"
        subtitle={viewAttempt && formatDateTime(viewAttempt.createdAt)}
        icon={History}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setViewAttempt(null)}>Close</button>}
      >
        {viewAttempt && (
          <div className="space-y-4">
            <div className="rounded-xl border border-orbit-violet/22 bg-orbit-violet/[0.06] px-4 py-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-orbit-violet mb-1.5">Question</p>
              <p className="text-[14px] text-slate-100 leading-snug">{viewAttempt.questionText}</p>
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Your answer · {viewAttempt.wordCount} words
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{viewAttempt.answerText}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">
              <ScoreBar label="Technical accuracy" value={viewAttempt.feedback?.technicalAccuracy || 0} tone="violet" />
              <ScoreBar label="Clarity" value={viewAttempt.feedback?.clarity || 0} tone="cyan" />
              <ScoreBar label="Structure" value={viewAttempt.feedback?.structure || 0} tone="mint" />
              <ScoreBar label="Overall" value={viewAttempt.feedback?.overall || 0} tone="amber" />
            </div>

            {viewAttempt.feedback?.verdict && (
              <Callout tone="violet" icon={Award} title="Verdict">{viewAttempt.feedback.verdict}</Callout>
            )}

            {viewAttempt.feedback?.strengths?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Strengths</p>
                <ul className="space-y-1.5">
                  {viewAttempt.feedback.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {viewAttempt.feedback?.missingConcepts?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Missing concepts</p>
                <div className="flex flex-wrap gap-1.5">
                  {viewAttempt.feedback.missingConcepts.map((c) => <span key={c} className="chip-coral">{c}</span>)}
                </div>
              </div>
            )}

            {viewAttempt.feedback?.improvedAnswerOutline?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Better structure</p>
                <ol className="space-y-2">
                  {viewAttempt.feedback.improvedAnswerOutline.map((s, i) => (
                    <li key={i} className="flex gap-3 text-[13px] text-slate-300 leading-relaxed">
                      <span className="w-5 h-5 rounded-md bg-orbit-violet/15 border border-orbit-violet/28 text-[10px] font-bold text-orbit-violet flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
