import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Orbit as OrbitIcon, Target, Compass, TrendingUp, Clock, CheckCircle2,
  BookOpen, Trophy, Info, ArrowRight, Layers, Zap,
} from 'lucide-react';
import { dashboardAPI, pathAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import LearningOrbit, { OrbitNodeList } from '../components/three/LearningOrbit';
import MilestonePanel from '../components/MilestonePanel';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, ProgressRing, ProgressBar,
  MotionCard, StatCard, Callout, SectionHeader,
} from '../components/ui/Primitives';

export default function MyPath() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [view, setView] = useState('3d');

  const load = async () => {
    try {
      const [dash, prog] = await Promise.all([dashboardAPI.student(), pathAPI.myProgress()]);
      setData(dash);
      setProgressList(prog.progress);
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

  if (loading) return <LoadingScreen label="Rendering your orbit…" />;

  const orbit = data?.orbit;

  if (!orbit) {
    return (
      <div>
        <PageHeader icon={OrbitIcon} title="My Path" subtitle="Your 3D learning orbit." />
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Compass}
            title="No active path yet"
            description="Pick one path in the Path Navigator. Your milestones will render as an interactive orbit here."
            action={<Link to="/path-navigator" className="btn-primary"><Compass size={15} /> Open Path Navigator</Link>}
          />
        </MotionCard>
      </div>
    );
  }

  const active = progressList.find((p) => p.status === 'active');
  const nodes = orbit.nodes;
  const completed = nodes.filter((n) => n.status === 'completed');
  const remaining = nodes.filter((n) => n.status !== 'completed');
  const hoursLeft = remaining.reduce((s, n) => s + (n.estimatedHours || 0), 0);
  const weeksLeft = active?.weeklyHours ? Math.ceil(hoursLeft / active.weeklyHours) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={OrbitIcon}
        title="My Path"
        subtitle={orbit.path.tagline || orbit.path.description}
        badge={<Badge tone="violet">{orbit.path.title}</Badge>}
        action={
          <>
            <Link to="/learn" className="btn-secondary"><BookOpen size={15} /> Lesson list</Link>
            <Link to="/path-navigator" className="btn-ghost"><Compass size={15} /> Switch path</Link>
          </>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Target} label="Preparation score" value={`${data.preparationScore}%`} sub="Readiness — not a job odds" tone="violet" />
        <StatCard icon={Trophy} label="Milestones" value={`${orbit.totals.milestonesDone}/${orbit.totals.milestones}`} sub={`${completed.length} orbits closed`} tone="mint" delay={0.06} />
        <StatCard icon={BookOpen} label="Lessons" value={`${orbit.totals.lessonsDone}/${orbit.totals.lessons}`} sub={`${orbit.totals.percent}% of the path`} tone="cyan" delay={0.12} />
        <StatCard icon={Clock} label="Estimated left" value={`${hoursLeft}h`} sub={weeksLeft ? `~${weeksLeft} weeks at ${active.weeklyHours}h/wk` : 'Set your weekly hours'} tone="amber" delay={0.18} />
      </div>

      {/* orbit */}
      <MotionCard hover={false} className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-white font-display">Interactive Learning Orbit</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Drag to rotate · scroll to zoom · hover a node for details · click to open the milestone
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-space-900/70 border border-white/[0.07]">
            {[{ k: '3d', label: '3D orbit' }, { k: 'list', label: 'List' }].map((v) => (
              <button
                key={v.k}
                onClick={() => setView(v.k)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                  view === v.k ? 'bg-orbit-violet/25 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {view === '3d' ? (
          <LearningOrbit
            nodes={nodes}
            accentColor={orbit.path.accentColor || '#7c5cff'}
            percent={orbit.totals.percent}
            onSelectMilestone={setSelectedMilestone}
            selectedId={selectedMilestone?._id}
            height={520}
          />
        ) : (
          <OrbitNodeList nodes={nodes} onSelect={setSelectedMilestone} selectedId={selectedMilestone?._id} />
        )}
      </MotionCard>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        {/* milestone timeline */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Layers} title="Milestone timeline" subtitle="The sequence, in order" className="mb-4" />
          <div className="relative pl-6 space-y-4 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/50 via-orbit-violet/40 to-white/[0.06]" />
            {nodes.map((n, i) => {
              const color =
                n.status === 'completed' ? '#34d399' :
                n.status === 'current' || n.status === 'in-progress' ? '#7c5cff' : '#3a4165';
              return (
                <motion.button
                  key={n._id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelectedMilestone(n)}
                  className="relative w-full text-left group"
                >
                  <span
                    className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-space-950"
                    style={{ background: color, boxShadow: n.status !== 'locked' ? `0 0 8px ${color}` : 'none' }}
                  />
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 group-hover:border-white/15 group-hover:bg-white/[0.045] transition-all">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">
                        {n.order}. {n.title}
                      </p>
                      <span className="text-[11px] font-bold tabular-nums shrink-0" style={{ color }}>
                        {n.percent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {n.lessonsCompleted}/{n.lessonCount} lessons · {n.estimatedHours}h ·{' '}
                      <span style={{ color }}>{n.status}</span>
                    </p>
                    <ProgressBar
                      value={n.percent}
                      tone={n.status === 'completed' ? 'mint' : n.status === 'locked' ? 'violet' : 'violet'}
                      height="h-1"
                      className="mt-2"
                    />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </MotionCard>

        <div className="space-y-4">
          {/* preparation score breakdown */}
          <MotionCard hover={false} className="p-5">
            <SectionHeader icon={TrendingUp} title="Preparation score" subtitle="How this number is calculated" className="mb-4" />
            <div className="flex items-center gap-5 mb-4">
              <ProgressRing value={data.preparationScore} size={92} tone="violet" sublabel="ready" />
              <div className="space-y-2 flex-1 min-w-0">
                {[
                  { label: 'Lessons completed', weight: 45, value: orbit.totals.lessons ? (orbit.totals.lessonsDone / orbit.totals.lessons) * 100 : 0, tone: 'violet' },
                  { label: 'Milestones completed', weight: 30, value: orbit.totals.milestones ? (orbit.totals.milestonesDone / orbit.totals.milestones) * 100 : 0, tone: 'cyan' },
                  { label: 'Quizzes passed', weight: 15, value: orbit.totals.lessons ? ((active?.lessons || []).filter((l) => l.quizPassed).length / orbit.totals.lessons) * 100 : 0, tone: 'mint' },
                  { label: 'Proof tasks submitted', weight: 10, value: orbit.totals.milestones ? ((active?.milestones || []).filter((m) => m.proofSubmitted).length / orbit.totals.milestones) * 100 : 0, tone: 'amber' },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">{row.label}</span>
                      <span className="text-slate-500 tabular-nums">
                        {Math.round(row.value)}% <span className="opacity-60">of {row.weight}pts</span>
                      </span>
                    </div>
                    <ProgressBar value={row.value} tone={row.tone} height="h-1" />
                  </div>
                ))}
              </div>
            </div>
            <Callout tone="cyan" icon={Info}>
              This is a <strong>preparation</strong> measure. CampusOrbit deliberately does not estimate your chance
              of being selected for any job — no honest system can predict that.
            </Callout>
          </MotionCard>

          {/* next up */}
          {data.nextLesson && (
            <MotionCard hover={false} className="p-5">
              <SectionHeader icon={Zap} title="Next up" subtitle="The single next thing" className="mb-3.5" />
              <div className="rounded-xl border border-orbit-violet/25 bg-orbit-violet/[0.07] p-4">
                <p className="text-[14px] font-bold text-white mb-1">{data.nextLesson.title}</p>
                <p className="text-[12px] text-slate-400 mb-3.5">
                  {data.nextLesson.estimatedMinutes} min · {data.nextLesson.difficulty}
                  {data.currentMilestone ? ` · ${data.currentMilestone.title}` : ''}
                </p>
                <Link to={`/learn/${data.nextLesson._id}`} className="btn-primary btn-sm w-full">
                  Start lesson <ArrowRight size={14} />
                </Link>
              </div>
            </MotionCard>
          )}

          {/* outcomes */}
          {orbit.path.outcomes?.length > 0 && (
            <MotionCard hover={false} className="p-5">
              <SectionHeader icon={CheckCircle2} title="What you will be able to do" className="mb-3.5" />
              <div className="space-y-2">
                {orbit.path.outcomes.map((o) => (
                  <div key={o} className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    {o}
                  </div>
                ))}
              </div>
            </MotionCard>
          )}
        </div>
      </div>

      <MilestonePanel
        milestoneId={selectedMilestone?._id}
        open={Boolean(selectedMilestone)}
        onClose={() => setSelectedMilestone(null)}
        onChanged={load}
      />
    </div>
  );
}
