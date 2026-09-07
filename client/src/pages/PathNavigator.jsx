import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Sparkles, Check, ArrowRight, Clock, Layers, Target, Rocket,
  RefreshCw, Info, TrendingUp, BookOpen, Shuffle, AlertTriangle,
} from 'lucide-react';
import { pathAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, Badge, MotionCard, ProgressBar, Spinner, Callout, SectionHeader,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';

const GOALS = [
  'campus placement', 'internship', 'mern developer', 'sde dsa', 'frontend developer', 'gate cse',
];

export default function PathNavigator() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [paths, setPaths] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [recommendation, setRecommendation] = useState(null);
  const [recommending, setRecommending] = useState(false);
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [detail, setDetail] = useState(null);

  const [form, setForm] = useState({
    goal: user?.profile?.careerGoals?.[0] || 'campus placement',
    level: user?.profile?.currentLevel || 'beginner',
    weeklyHours: user?.profile?.weeklyStudyHours || 10,
    timelineWeeks: 12,
  });

  const load = async () => {
    try {
      const [{ paths: p }, { progress: pr }] = await Promise.all([pathAPI.list(), pathAPI.myProgress()]);
      setPaths(p);
      setProgress(pr);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressFor = (pathId) => progress.find((p) => String(p.pathId?._id) === String(pathId));
  const activePath = progress.find((p) => p.status === 'active');

  const runRecommendation = async () => {
    setRecommending(true);
    try {
      const rec = await pathAPI.recommend({
        goal: form.goal,
        level: form.level,
        weeklyHours: Number(form.weeklyHours),
        timelineWeeks: Number(form.timelineWeeks),
      });
      setRecommendation(rec);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRecommending(false);
    }
  };

  const startOrSwitch = async (path) => {
    setSwitching(true);
    try {
      const existing = progressFor(path._id);
      if (existing) {
        await pathAPI.switch(path._id);
        toast.success(`Switched to ${path.title}. Your progress on this path was preserved.`);
      } else {
        const res = await pathAPI.start(path._id, {
          weeklyHours: Number(form.weeklyHours),
          timelineWeeks: Number(form.timelineWeeks),
          transferProgress: true,
          reason: recommendation?.reasons?.[0] || 'Chosen from Path Navigator',
        });
        const transferred = res.transferred || res.transferredMilestones || [];
        toast.success(
          transferred.length
            ? `Started ${path.title}. ${transferred.length} milestone(s) auto-completed from your previous path.`
            : `Started ${path.title}. Your orbit is ready.`
        );
      }
      await refresh();
      await load();
      setSwitchTarget(null);
      setRecommendOpen(false);
      setRecommendation(null);
      navigate('/my-path');
    } catch (e) {
      // "Already enrolled" means the intent already succeeded (retry, stale
      // duplicate request, or a second tab won the race). Continue to the path
      // instead of showing a scary error the user cannot act on.
      if (e.status === 409 || /already enrolled/i.test(e.message || '')) {
        await refresh();
        await load();
        setSwitchTarget(null);
        setRecommendOpen(false);
        setRecommendation(null);
        navigate('/my-path');
        return;
      }
      toast.error(e.message);
    } finally {
      setSwitching(false);
    }
  };

  const openDetail = async (path) => {
    try {
      const d = await pathAPI.get(path._id);
      setDetail(d);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading paths…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Compass}
        title="Path Navigator"
        subtitle="CampusOrbit gives you exactly one path. Switching later is fine — completed topics transfer automatically."
        action={
          <button onClick={() => { setRecommendOpen(true); setRecommendation(null); }} className="btn-primary">
            <Sparkles size={15} /> Recommend a path for me
          </button>
        }
      />

      {activePath && (
        <Callout tone="violet" icon={Target} title={`Active path: ${activePath.pathId.title}`}>
          You are {activePath.percent}% through this path ({activePath.totals.lessonsDone}/{activePath.totals.totalLessons}{' '}
          lessons). Finish it before switching — path-hopping is the single biggest reason students never finish.
        </Callout>
      )}

      {/* path cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {paths.map((p, i) => {
          const pr = progressFor(p._id);
          const isActive = pr?.status === 'active';
          return (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: 'spring', stiffness: 240, damping: 24 }}
              whileHover={{ y: -5 }}
              className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
                isActive
                  ? 'border-orbit-violet/50 bg-gradient-to-br from-orbit-violet/12 to-space-900/70'
                  : 'border-white/[0.08] bg-white/[0.028] hover:border-white/20'
              }`}
            >
              <div
                className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-40"
                style={{ background: p.accentColor || '#7c5cff' }}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      background: `${p.accentColor || '#7c5cff'}1f`,
                      borderColor: `${p.accentColor || '#7c5cff'}44`,
                      color: p.accentColor || '#7c5cff',
                    }}
                  >
                    <Layers size={20} />
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {isActive && <Badge tone="violet">Active</Badge>}
                    {pr && !isActive && <Badge tone="slate">{pr.status}</Badge>}
                    <Badge tone="cyan">{p.level}</Badge>
                  </div>
                </div>

                <h2 className="text-lg font-bold text-white font-display mb-1.5">{p.title}</h2>
                <p className="text-[13px] text-slate-400 leading-relaxed mb-4 line-clamp-2">
                  {p.tagline || p.description}
                </p>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: Clock, label: `${p.estimatedWeeks}w`, sub: 'duration' },
                    { icon: Target, label: p.milestoneCount, sub: 'milestones' },
                    { icon: BookOpen, label: p.lessonCount, sub: 'lessons' },
                  ].map((s) => (
                    <div key={s.sub} className="rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-2 text-center">
                      <p className="text-sm font-bold text-white tabular-nums">{s.label}</p>
                      <p className="text-[9px] uppercase tracking-wider text-slate-500">{s.sub}</p>
                    </div>
                  ))}
                </div>

                {pr && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-slate-400">Your progress</span>
                      <span className="text-slate-300 tabular-nums font-semibold">{pr.percent}%</span>
                    </div>
                    <ProgressBar value={pr.percent} tone={isActive ? 'violet' : 'cyan'} height="h-1.5" />
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      {pr.totals.lessonsDone}/{pr.totals.totalLessons} lessons · preparation score {pr.preparationScore}%
                    </p>
                  </div>
                )}

                {p.goalTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.goalTags.slice(0, 4).map((t) => (
                      <span key={t} className="chip-slate">{t}</span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => openDetail(p)} className="btn-secondary btn-sm flex-1">
                    <Info size={13} /> Details
                  </button>
                  {isActive ? (
                    <button onClick={() => navigate('/my-path')} className="btn-primary btn-sm flex-1">
                      Open orbit <ArrowRight size={13} />
                    </button>
                  ) : (
                    <button onClick={() => setSwitchTarget(p)} className="btn-primary btn-sm flex-1">
                      {pr ? <><Shuffle size={13} /> Resume</> : <><Rocket size={13} /> Start</>}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ------------------------------------------------ recommend modal */}
      <Modal
        open={recommendOpen}
        onClose={() => setRecommendOpen(false)}
        title="Which path should I follow?"
        subtitle="Four questions. One answer. With the reasoning shown."
        icon={Sparkles}
        size="lg"
        footer={
          !recommendation && (
            <>
              <button className="btn-secondary" onClick={() => setRecommendOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={runRecommendation} disabled={recommending}>
                {recommending ? <><Spinner size={14} /> Analysing…</> : <><Sparkles size={15} /> Get my path</>}
              </button>
            </>
          )
        }
      >
        {!recommendation ? (
          <div className="space-y-5">
            <div>
              <span className="label">Your primary goal</span>
              <div className="grid sm:grid-cols-3 gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setForm((f) => ({ ...f, goal: g }))}
                    className={`rounded-xl border px-3 py-2.5 text-[13px] font-medium capitalize transition-all ${
                      form.goal === g
                        ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="label">Your current level</span>
              <div className="grid grid-cols-3 gap-2">
                {['beginner', 'intermediate', 'advanced'].map((l) => (
                  <button
                    key={l}
                    onClick={() => setForm((f) => ({ ...f, level: l }))}
                    className={`rounded-xl border px-3 py-2.5 text-[13px] font-medium capitalize transition-all ${
                      form.level === l
                        ? 'border-orbit-cyan/60 bg-cyan-400/12 text-white'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="label" htmlFor="wh">Hours per week — <span className="text-orbit-cyan">{form.weeklyHours}h</span></label>
                <input
                  id="wh"
                  type="range" min="2" max="40"
                  value={form.weeklyHours}
                  onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))}
                  className="w-full accent-orbit-violet cursor-pointer"
                />
              </div>
              <div>
                <label className="label" htmlFor="tw">Timeline — <span className="text-orbit-cyan">{form.timelineWeeks} weeks</span></label>
                <input
                  id="tw"
                  type="range" min="4" max="52"
                  value={form.timelineWeeks}
                  onChange={(e) => setForm((f) => ({ ...f, timelineWeeks: e.target.value }))}
                  className="w-full accent-orbit-cyan cursor-pointer"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-orbit-violet/30 bg-gradient-to-br from-orbit-violet/12 to-transparent p-5">
              <Badge tone="cyan" icon={Sparkles} className="mb-3">Recommended</Badge>
              <h3 className="text-xl font-bold text-white font-display mb-1.5">{recommendation.recommended.title}</h3>
              <p className="text-[13px] text-slate-300 leading-relaxed mb-4">
                {recommendation.recommended.tagline || recommendation.recommended.description}
              </p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Duration', value: `${recommendation.plan.weeks}w` },
                  { label: 'Per week', value: `${recommendation.plan.lessonsPerWeek} lessons` },
                  { label: 'Match score', value: recommendation.score },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-white/[0.05] border border-white/[0.07] px-2.5 py-2 text-center">
                    <p className="text-[15px] font-bold text-white font-display">{s.value}</p>
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Reasoning</p>
              <ul className="space-y-1.5 mb-4">
                {recommendation.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-[12.5px] text-slate-300 leading-relaxed">
                    <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>

              <div className="rounded-lg border border-cyan-400/22 bg-cyan-400/[0.06] px-3.5 py-2.5 mb-4">
                <p className="text-[12.5px] text-cyan-100/85 leading-relaxed">{recommendation.plan.note}</p>
              </div>

              <button onClick={() => startOrSwitch(recommendation.recommended)} disabled={switching} className="btn-primary w-full">
                {switching ? <><Spinner size={14} /> Setting up…</> : <><Rocket size={15} /> Start this path</>}
              </button>
            </div>

            {recommendation.alternatives?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Also considered
                </p>
                <div className="space-y-2">
                  {recommendation.alternatives.map((a) => (
                    <div key={a.path._id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                      <p className="text-[13px] font-semibold text-slate-200">{a.path.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{a.whyNotPrimary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setRecommendation(null)} className="btn-ghost btn-sm w-full">
              <RefreshCw size={13} /> Change my answers
            </button>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------- detail modal */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.path?.title}
        subtitle={detail?.path?.tagline}
        icon={Layers}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDetail(null)}>Close</button>
            <button className="btn-primary" onClick={() => { setSwitchTarget(detail.path); setDetail(null); }}>
              <Rocket size={15} /> Start this path
            </button>
          </>
        }
      >
        {detail && (
          <div className="space-y-5">
            <p className="text-sm text-slate-300 leading-relaxed">{detail.path.description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Weeks', value: detail.path.estimatedWeeks },
                { label: 'Hours/week', value: detail.path.recommendedWeeklyHours },
                { label: 'Milestones', value: detail.totals.milestones },
                { label: 'Lessons', value: detail.totals.lessons },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-white/[0.045] border border-white/[0.07] px-2.5 py-2.5 text-center">
                  <p className="text-base font-bold text-white font-display">{s.value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {detail.path.outcomes?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Outcomes</p>
                <div className="space-y-1.5">
                  {detail.path.outcomes.map((o) => (
                    <div key={o} className="flex gap-2 text-[13px] text-slate-300">
                      <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" /> {o}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                Milestones ({detail.milestones.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin pr-1">
                {detail.milestones.map((m) => (
                  <div key={m._id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                    <p className="text-[13px] font-semibold text-slate-100">{m.order}. {m.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>
                    <p className="text-[10px] text-slate-600 mt-1.5">
                      {m.lessons.length} lessons · {m.estimatedHours}h
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------ switch confirm */}
      <Modal
        open={Boolean(switchTarget)}
        onClose={() => setSwitchTarget(null)}
        title={progressFor(switchTarget?._id) ? `Resume ${switchTarget?.title}?` : `Start ${switchTarget?.title}?`}
        icon={Shuffle}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSwitchTarget(null)} disabled={switching}>Cancel</button>
            <button className="btn-primary" onClick={() => startOrSwitch(switchTarget)} disabled={switching}>
              {switching ? <><Spinner size={14} /> Working…</> : <>Confirm <ArrowRight size={14} /></>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {activePath && String(activePath.pathId._id) !== String(switchTarget?._id) && (
            <Callout tone="amber" icon={AlertTriangle} title="You already have an active path">
              <strong>{activePath.pathId.title}</strong> ({activePath.percent}% done) will be paused, not deleted.
              All your progress on it is kept in MongoDB and you can come back any time.
            </Callout>
          )}

          <Callout tone="mint" icon={TrendingUp} title="Completed topics transfer">
            Milestones on the new path whose topics you have already completed elsewhere are marked complete
            automatically. You never redo work you have already proven.
          </Callout>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="swh">Hours per week — <span className="text-orbit-cyan">{form.weeklyHours}h</span></label>
              <input
                id="swh" type="range" min="2" max="40"
                value={form.weeklyHours}
                onChange={(e) => setForm((f) => ({ ...f, weeklyHours: e.target.value }))}
                className="w-full accent-orbit-violet cursor-pointer"
              />
            </div>
            <div>
              <label className="label" htmlFor="stw">Timeline — <span className="text-orbit-cyan">{form.timelineWeeks} weeks</span></label>
              <input
                id="stw" type="range" min="4" max="52"
                value={form.timelineWeeks}
                onChange={(e) => setForm((f) => ({ ...f, timelineWeeks: e.target.value }))}
                className="w-full accent-orbit-cyan cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
