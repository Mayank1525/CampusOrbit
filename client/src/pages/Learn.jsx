import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PlayCircle, CheckCircle2, Clock, Search, Compass, BookOpen, Lock,
  ChevronRight, Filter, Youtube, Target, Sparkles,
} from 'lucide-react';
import { pathAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, ProgressBar, MotionCard, Tabs, ProgressRing,
} from '../components/ui/Primitives';
import MilestonePanel from '../components/MilestonePanel';

export default function Learn() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [progressList, setProgressList] = useState([]);
  const [pathData, setPathData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedMilestone, setSelectedMilestone] = useState(null);

  const load = async () => {
    try {
      const { progress } = await pathAPI.myProgress();
      setProgressList(progress);
      const active = progress.find((p) => p.status === 'active') || progress[0];
      if (active?.pathId) {
        const detail = await pathAPI.get(active.pathId._id);
        setPathData({ ...detail, myProgress: active });
      }
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

  const lessonState = useMemo(() => {
    const map = new Map();
    (pathData?.myProgress?.lessons || []).forEach((l) => map.set(String(l.lessonId), l));
    return map;
  }, [pathData]);

  const milestoneState = useMemo(() => {
    const map = new Map();
    (pathData?.myProgress?.milestones || []).forEach((m) => map.set(String(m.milestoneId), m));
    return map;
  }, [pathData]);

  if (loading) return <LoadingScreen label="Loading your lessons…" />;

  if (!pathData) {
    return (
      <div>
        <PageHeader icon={BookOpen} title="Learn" subtitle="Your lessons live here once you pick a path." />
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Compass}
            title="No active path"
            description="CampusOrbit gives you one path at a time. Answer four questions in the Path Navigator and your lessons appear here."
            action={<Link to="/path-navigator" className="btn-primary"><Compass size={15} /> Open Path Navigator</Link>}
          />
        </MotionCard>
      </div>
    );
  }

  const { path, milestones, myProgress } = pathData;

  const filteredMilestones = milestones
    .map((m) => {
      const state = milestoneState.get(String(m._id))?.status || 'locked';
      const lessons = m.lessons.filter((l) => {
        if (query && !l.title.toLowerCase().includes(query.toLowerCase()) && !l.topic?.toLowerCase().includes(query.toLowerCase())) {
          return false;
        }
        const done = lessonState.get(String(l._id))?.completed;
        if (filter === 'completed') return done;
        if (filter === 'pending') return !done;
        return true;
      });
      return { ...m, state, lessons };
    })
    .filter((m) => m.lessons.length > 0 || (!query && filter === 'all'));

  const totalLessons = milestones.reduce((s, m) => s + m.lessons.length, 0);
  const doneLessons = (myProgress?.lessons || []).filter((l) => l.completed).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BookOpen}
        title="Learn"
        subtitle={`Every lesson on ${path.title}, in the order that actually works.`}
        badge={<Badge tone="violet">{path.title}</Badge>}
        action={
          <Link to="/my-path" className="btn-secondary">
            <Target size={15} /> Orbit view
          </Link>
        }
      />

      {/* progress strip */}
      <MotionCard hover={false} className="p-5">
        <div className="flex items-center gap-5 flex-wrap">
          <ProgressRing value={myProgress?.percent || 0} size={78} tone="violet" sublabel="lessons" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-white mb-1">
              {doneLessons} of {totalLessons} lessons complete
            </p>
            <p className="text-xs text-slate-400 mb-3">
              {myProgress?.totals?.milestonesDone || 0}/{myProgress?.totals?.totalMilestones || milestones.length} milestones ·
              {' '}Preparation score {myProgress?.preparationScore || 0}%
            </p>
            <ProgressBar value={myProgress?.percent || 0} tone="violet" />
          </div>
          <div className="flex gap-2.5">
            {[
              { label: 'Weekly hours', value: `${myProgress?.weeklyHours || 10}h` },
              { label: 'Target', value: `${myProgress?.targetTimelineWeeks || 12}w` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.045] border border-white/[0.07] px-3.5 py-2.5 text-center">
                <p className="text-base font-bold text-white font-display">{s.value}</p>
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </MotionCard>

      {/* filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-10"
            placeholder="Search lessons by title or topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Tabs
          tabs={[
            { key: 'all', label: 'All', icon: Filter },
            { key: 'pending', label: 'Pending' },
            { key: 'completed', label: 'Completed' },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {/* milestone accordion list */}
      {filteredMilestones.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState icon={Search} title="No lessons match" description="Try a different search or filter." />
        </MotionCard>
      ) : (
        <div className="space-y-4">
          {filteredMilestones.map((m, mi) => {
            const done = m.lessons.filter((l) => lessonState.get(String(l._id))?.completed).length;
            const isLocked = m.state === 'locked';
            const pct = m.lessons.length ? Math.round((done / m.lessons.length) * 100) : 0;

            return (
              <motion.div
                key={m._id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: mi * 0.05 }}
                className={`glass overflow-hidden ${isLocked ? 'opacity-70' : ''}`}
              >
                {/* milestone header */}
                <div className="p-5 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm"
                        style={{
                          background:
                            m.state === 'completed'
                              ? 'rgba(52,211,153,0.14)'
                              : isLocked
                              ? 'rgba(255,255,255,0.05)'
                              : 'rgba(124,92,255,0.16)',
                          color: m.state === 'completed' ? '#34d399' : isLocked ? '#64748b' : '#7c5cff',
                          border: `1px solid ${m.state === 'completed' ? 'rgba(52,211,153,0.3)' : isLocked ? 'rgba(255,255,255,0.1)' : 'rgba(124,92,255,0.35)'}`,
                        }}
                      >
                        {m.state === 'completed' ? <CheckCircle2 size={18} /> : isLocked ? <Lock size={16} /> : m.order}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-[15px] font-bold text-white">{m.title}</h2>
                          {m.state === 'current' && <Badge tone="violet">Current</Badge>}
                          {m.state === 'in-progress' && <Badge tone="cyan">In progress</Badge>}
                          {m.state === 'completed' && <Badge tone="mint">Done</Badge>}
                          {isLocked && <Badge tone="slate">Locked</Badge>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 max-w-2xl leading-relaxed">
                          {m.whyItMatters || m.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-white tabular-nums">{done}/{m.lessons.length}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">lessons</p>
                      </div>
                      <button onClick={() => setSelectedMilestone(m)} className="btn-secondary btn-sm">
                        Details <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                  <ProgressBar
                    value={pct}
                    tone={m.state === 'completed' ? 'mint' : 'violet'}
                    height="h-1"
                    className="mt-3.5"
                  />
                </div>

                {/* lessons */}
                <div className="divide-y divide-white/[0.04]">
                  {m.lessons.map((l, li) => {
                    const ls = lessonState.get(String(l._id));
                    const completed = ls?.completed;
                    return (
                      <Link
                        key={l._id}
                        to={`/learn/${l._id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.035] transition-colors group"
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${
                            completed
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/25'
                              : 'bg-white/[0.05] text-slate-400 border border-white/10'
                          }`}
                        >
                          {completed ? <CheckCircle2 size={15} /> : <PlayCircle size={15} />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-slate-100 truncate">
                            {li + 1}. {l.title}
                          </span>
                          <span className="flex items-center gap-2.5 text-[11px] text-slate-500 mt-0.5">
                            <span className="flex items-center gap-1"><Clock size={10} /> {l.estimatedMinutes} min</span>
                            <span>·</span>
                            <span>{l.difficulty}</span>
                            {l.primaryVideo?.channelName && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-1 truncate max-w-[160px]">
                                  <Youtube size={10} className="text-rose-400/70" /> {l.primaryVideo.channelName}
                                </span>
                              </>
                            )}
                          </span>
                        </span>

                        {ls?.quizPassed && <Badge tone="mint">Quiz ✓</Badge>}
                        {!completed && ls?.percent > 0 && <Badge tone="amber">{ls.percent}%</Badge>}

                        <ChevronRight size={15} className="text-slate-600 group-hover:text-orbit-violet transition-colors shrink-0" />
                      </Link>
                    );
                  })}
                  {m.lessons.length === 0 && (
                    <p className="px-5 py-4 text-xs text-slate-500">No lessons match your filter in this milestone.</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* other paths */}
      {progressList.length > 1 && (
        <MotionCard hover={false} className="p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Sparkles size={12} /> Your other paths (paused)
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {progressList
              .filter((p) => p.pathId?._id !== path._id)
              .map((p) => (
                <div key={p._id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-200 truncate">{p.pathId.title}</p>
                    <p className="text-[11px] text-slate-500">{p.percent}% complete · {p.status}</p>
                  </div>
                  <Link to="/path-navigator" className="btn-ghost btn-sm">Switch</Link>
                </div>
              ))}
          </div>
        </MotionCard>
      )}

      <MilestonePanel
        milestoneId={selectedMilestone?._id}
        open={Boolean(selectedMilestone)}
        onClose={() => setSelectedMilestone(null)}
        onChanged={load}
      />
    </div>
  );
}
