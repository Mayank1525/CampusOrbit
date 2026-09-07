import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Target, Sparkles, ArrowRight, PlayCircle, Repeat, AlarmClock, UserCheck,
  FileText, MessageSquare, Briefcase, TrendingUp, Clock, CheckCircle2, Orbit as OrbitIcon,
  ChevronRight, Zap, BookOpen, Users, Trophy, Compass, BarChart3,
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LearningOrbit, { OrbitNodeList } from '../components/three/LearningOrbit';
import MilestonePanel from '../components/MilestonePanel';
import {
  StatCard, MotionCard, Badge, ProgressRing, ProgressBar, LoadingScreen,
  EmptyState, SectionHeader, Callout,
} from '../components/ui/Primitives';
import { formatDate, deadlineLabel, timeAgo } from '../utils/helpers';

const TASK_ICONS = {
  revision: Repeat,
  lesson: PlayCircle,
  deadline: AlarmClock,
  profile: UserCheck,
  resume: FileText,
  interview: MessageSquare,
};

const TASK_TONES = {
  revision: { bg: 'from-amber-400/16', border: 'border-amber-400/28', text: 'text-amber-300', ring: '#fbbf24' },
  lesson: { bg: 'from-orbit-violet/16', border: 'border-orbit-violet/28', text: 'text-orbit-violet', ring: '#7c5cff' },
  deadline: { bg: 'from-rose-400/16', border: 'border-rose-400/28', text: 'text-rose-300', ring: '#fb7185' },
  profile: { bg: 'from-cyan-400/16', border: 'border-cyan-400/28', text: 'text-cyan-300', ring: '#22d3ee' },
  resume: { bg: 'from-emerald-400/16', border: 'border-emerald-400/28', text: 'text-emerald-300', ring: '#34d399' },
  interview: { bg: 'from-pink-400/16', border: 'border-pink-400/28', text: 'text-pink-300', ring: '#f472b6' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [orbitView, setOrbitView] = useState('3d');

  const load = async () => {
    try {
      const d = await dashboardAPI.student();
      setData(d);
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

  if (loading) return <LoadingScreen label="Assembling today's orbit…" />;
  if (!data) return <EmptyState title="Could not load your dashboard" description="Please refresh the page." />;

  const { greeting, todaysOrbit, whatNext, orbit, preparationScore, streak, profileCompletion } = data;

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------- greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <p className="text-sm text-slate-400">{timeGreeting},</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">
            {greeting.name} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-xl">
            {todaysOrbit.length > 0
              ? `You have ${todaysOrbit.length} focused ${todaysOrbit.length === 1 ? 'task' : 'tasks'} today. Nothing else needs your attention.`
              : 'Nothing urgent today. Move ahead on your path when you are ready.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <motion.div
            whileHover={{ scale: 1.04 }}
            className="flex items-center gap-2.5 rounded-xl border border-amber-400/28 bg-gradient-to-br from-amber-400/12 to-transparent px-3.5 py-2.5"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame size={20} className="text-amber-400" />
            </motion.div>
            <div>
              <p className="text-lg font-bold text-white font-display leading-none tabular-nums">
                {streak?.current || 0}
              </p>
              <p className="text-[10px] text-amber-200/70 uppercase tracking-wide">day streak</p>
            </div>
          </motion.div>

          <Link to="/progress" className="btn-secondary">
            <BarChart3 size={15} /> Progress
          </Link>
        </div>
      </motion.div>

      {/* --------------------------------------------- what should I do next */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="gradient-border relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-orbit-violet/18 blur-3xl pointer-events-none" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
          <motion.div
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orbit-violet to-orbit-cyan flex items-center justify-center shrink-0"
            animate={{ boxShadow: ['0 0 20px rgba(124,92,255,0.4)', '0 0 36px rgba(124,92,255,0.75)', '0 0 20px rgba(124,92,255,0.4)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles size={22} className="text-white" />
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orbit-cyan mb-1.5">
              What should I do next?
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white font-display mb-1.5 leading-snug">
              {whatNext.headline}
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">{whatNext.reason}</p>
          </div>

          <button
            onClick={() => navigate(whatNext.link)}
            className="btn-primary shrink-0 w-full sm:w-auto sm:self-center"
          >
            {whatNext.action} <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>

      {/* ----------------------------------------------------- stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Target}
          label="Preparation score"
          value={`${preparationScore}%`}
          sub="Readiness, not a job guarantee"
          tone="violet"
          delay={0}
          onClick={() => navigate('/my-path')}
        />
        <StatCard
          icon={Briefcase}
          label="Applications"
          value={data.applicationTotal}
          sub={`${data.applicationSummary?.Applied || 0} applied · ${data.applicationSummary?.Shortlisted || 0} shortlisted`}
          tone="cyan"
          delay={0.06}
          onClick={() => navigate('/applications')}
        />
        <StatCard
          icon={Repeat}
          label="Revisions due"
          value={data.revisionCount}
          sub="Spaced at 1 / 7 / 21 days"
          tone={data.revisionCount > 0 ? 'amber' : 'mint'}
          delay={0.12}
          onClick={() => navigate('/notes?tab=revision')}
        />
        <StatCard
          icon={MessageSquare}
          label="Interview practice"
          value={data.interviewStats.total}
          sub={data.interviewStats.averageOverall ? `Avg score ${data.interviewStats.averageOverall}/10` : 'No attempts yet'}
          tone="coral"
          delay={0.18}
          onClick={() => navigate('/interview-practice')}
        />
      </div>

      {/* --------------------------------------------------- Today's Orbit */}
      <div>
        <SectionHeader
          icon={Zap}
          title="Today's Orbit"
          subtitle="At most three tasks. Finish them and you are genuinely done for the day."
          className="mb-4"
        />

        {todaysOrbit.length === 0 ? (
          <MotionCard className="p-8">
            <EmptyState
              icon={Trophy}
              title="Orbit clear 🎉"
              description="No revisions due, no urgent deadlines, profile healthy. Push ahead on your path or rest — both are valid."
              action={<Link to="/my-path" className="btn-primary"><OrbitIcon size={15} /> Open my path</Link>}
            />
          </MotionCard>
        ) : (
          <div className="grid md:grid-cols-3 gap-3 sm:gap-4">
            {todaysOrbit.map((task, i) => {
              const Icon = TASK_ICONS[task.type] || Zap;
              const tone = TASK_TONES[task.type] || TASK_TONES.lesson;
              return (
                <motion.button
                  key={`${task.type}-${i}`}
                  initial={{ opacity: 0, y: 22, rotateX: -8 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ type: 'spring', stiffness: 240, damping: 24, delay: i * 0.09 }}
                  whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => navigate(task.link)}
                  className={`relative overflow-hidden text-left glass border ${tone.border} p-5 group`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className={`absolute -top-14 -right-14 w-32 h-32 rounded-full bg-gradient-to-br ${tone.bg} to-transparent blur-2xl opacity-70 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone.text} transition-transform group-hover:scale-110`}
                        style={{ background: `${tone.ring}1f`, border: `1px solid ${tone.ring}3d` }}
                      >
                        <Icon size={19} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        #{i + 1}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-white leading-snug mb-1.5">{task.title}</h3>
                    <p className="text-[12.5px] text-slate-400 leading-relaxed mb-4">{task.body}</p>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone.text}`}>
                      {task.action}
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* --------------------------------------------- orbit + side panel */}
      <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4">
        {/* 3D orbit */}
        <MotionCard hover={false} className="p-4 sm:p-5" delay={0.1}>
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white font-display">Your Learning Orbit</h2>
                {orbit?.path && (
                  <Badge tone="violet">{orbit.path.title}</Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {orbit
                  ? `${orbit.totals.milestonesDone}/${orbit.totals.milestones} milestones · ${orbit.totals.lessonsDone}/${orbit.totals.lessons} lessons`
                  : 'Pick a path to generate your orbit'}
              </p>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-space-900/70 border border-white/[0.07]">
              {[
                { k: '3d', label: '3D' },
                { k: 'list', label: 'List' },
              ].map((v) => (
                <button
                  key={v.k}
                  onClick={() => setOrbitView(v.k)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    orbitView === v.k ? 'bg-orbit-violet/25 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {orbitView === '3d' ? (
            <LearningOrbit
              nodes={orbit?.nodes || []}
              accentColor={orbit?.path?.accentColor || '#7c5cff'}
              percent={orbit?.totals?.percent || 0}
              onSelectMilestone={setSelectedMilestone}
              selectedId={selectedMilestone?._id}
              height={420}
            />
          ) : orbit?.nodes?.length ? (
            <div className="max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
              <OrbitNodeList nodes={orbit.nodes} onSelect={setSelectedMilestone} selectedId={selectedMilestone?._id} />
            </div>
          ) : (
            <EmptyState
              icon={Compass}
              title="No path selected"
              description="Head to the Path Navigator and pick your one path."
              action={<Link to="/path-navigator" className="btn-primary"><Compass size={15} /> Open Path Navigator</Link>}
            />
          )}

          {orbit?.path && (
            <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-white/[0.06] flex-wrap">
              <div className="flex items-center gap-3">
                <ProgressRing value={preparationScore} size={54} stroke={5} tone="violet" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preparation score</p>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-snug mt-0.5">
                    Lessons, milestones, quizzes and proof tasks. This is readiness — never a probability of getting selected.
                  </p>
                </div>
              </div>
              <Link to="/my-path" className="btn-secondary btn-sm">
                Full path view <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </MotionCard>

        {/* side column */}
        <div className="space-y-4">
          {/* current milestone */}
          {data.currentMilestone && (
            <MotionCard className="p-5" delay={0.14}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="w-2 h-2 rounded-full bg-orbit-violet animate-pulse" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-orbit-violet">Current milestone</p>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-1.5 leading-snug">{data.currentMilestone.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-3.5 line-clamp-3">
                {data.currentMilestone.whyItMatters || data.currentMilestone.description}
              </p>
              <ProgressBar value={data.currentMilestone.percent} tone="violet" showLabel />
              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11px] text-slate-500">
                  {data.currentMilestone.lessonsCompleted}/{data.currentMilestone.lessonCount} lessons ·{' '}
                  {data.currentMilestone.estimatedHours}h
                </span>
                <button onClick={() => setSelectedMilestone(data.currentMilestone)} className="text-[11px] text-orbit-cyan hover:underline font-semibold">
                  View detail
                </button>
              </div>
              {data.nextLesson && (
                <Link
                  to={`/learn/${data.nextLesson._id}`}
                  className="btn-primary w-full mt-4 btn-sm py-2"
                >
                  <PlayCircle size={14} /> Continue: {data.nextLesson.title.slice(0, 26)}
                  {data.nextLesson.title.length > 26 ? '…' : ''}
                </Link>
              )}
            </MotionCard>
          )}

          {/* deadlines */}
          <MotionCard className="p-5" delay={0.2}>
            <SectionHeader
              icon={AlarmClock}
              title="Closing soon"
              subtitle={`${data.upcomingDeadlines.length} in the next 7 days`}
              className="mb-3.5"
            />
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">No deadlines within a week. Breathe.</p>
            ) : (
              <div className="space-y-2">
                {data.upcomingDeadlines.slice(0, 4).map((d) => {
                  const dl = deadlineLabel(d.deadline);
                  return (
                    <Link
                      key={d._id}
                      to={`/opportunities/${d._id}`}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 hover:bg-white/[0.05] hover:border-white/15 transition-all group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-100 truncate">{d.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{d.company}</p>
                      </div>
                      {d.applied ? (
                        <Badge tone="mint" icon={CheckCircle2}>Applied</Badge>
                      ) : (
                        <Badge tone={dl.tone}>{dl.text}</Badge>
                      )}
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                    </Link>
                  );
                })}
              </div>
            )}
            <Link to="/opportunities" className="btn-ghost w-full mt-3 btn-sm">
              Open Placement Hub <ArrowRight size={13} />
            </Link>
          </MotionCard>

          {/* profile completion */}
          {profileCompletion < 100 && (
            <MotionCard className="p-5" delay={0.26}>
              <div className="flex items-center gap-3 mb-3">
                <ProgressRing value={profileCompletion} size={52} stroke={5} tone={profileCompletion >= 80 ? 'mint' : 'amber'} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white">Profile completion</p>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Placement filters read these fields directly.
                  </p>
                </div>
              </div>
              <Link to="/profile" className="btn-secondary w-full btn-sm">
                <UserCheck size={13} /> Complete profile
              </Link>
            </MotionCard>
          )}
        </div>
      </div>

      {/* ------------------------------------------ matches + room activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <MotionCard hover={false} className="p-5" delay={0.1}>
          <SectionHeader
            icon={TrendingUp}
            title="Matched for you"
            subtitle="Ranked by your branch, CGPA, year and skills"
            className="mb-4"
            action={<Link to="/opportunities" className="btn-ghost btn-sm">See all <ArrowRight size={12} /></Link>}
          />
          {data.matches.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No open opportunities right now.</p>
          ) : (
            <div className="space-y-2.5">
              {data.matches.map((m, i) => (
                <motion.div
                  key={m.opportunity._id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                >
                  <Link
                    to={`/opportunities/${m.opportunity._id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 hover:bg-white/[0.05] hover:border-orbit-violet/30 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center shrink-0 text-sm font-bold text-white">
                      {m.opportunity.company?.[0] || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">{m.opportunity.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {m.opportunity.company} · {m.opportunity.location || 'Remote'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-orbit-cyan tabular-nums">{m.score}%</p>
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">match</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </MotionCard>

        <MotionCard hover={false} className="p-5" delay={0.16}>
          <SectionHeader
            icon={Users}
            title="Your peer rooms"
            subtitle="Structured group study — no DMs, no calls"
            className="mb-4"
            action={<Link to="/rooms" className="btn-ghost btn-sm">All rooms <ArrowRight size={12} /></Link>}
          />
          {data.roomActivity.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Not in any room yet"
              description="Join a peer room to study alongside people on the same path."
              action={<Link to="/rooms" className="btn-primary btn-sm">Browse rooms</Link>}
              className="py-6"
            />
          ) : (
            <div className="space-y-2.5">
              {data.roomActivity.map((r, i) => (
                <motion.div
                  key={r._id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + i * 0.07 }}
                >
                  <Link
                    to={`/rooms/${r.slug}`}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 hover:bg-white/[0.05] hover:border-orbit-cyan/30 transition-all"
                  >
                    <div
                      className="w-2.5 h-9 rounded-full shrink-0"
                      style={{ background: r.accentColor || '#7c5cff', boxShadow: `0 0 10px ${r.accentColor || '#7c5cff'}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">{r.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.recentMessages > 0 ? `${r.recentMessages} new messages in 24h` : 'Quiet today'}
                      </p>
                    </div>
                    {r.recentMessages > 0 && <Badge tone="cyan">{r.recentMessages}</Badge>}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </MotionCard>
      </div>

      {/* honest scoring disclaimer */}
      <Callout tone="cyan" icon={Target} title="About your preparation score">
        This number reflects how much of your chosen path you have finished, how many quizzes you have passed and how
        many proof tasks you have submitted. It is a measure of <strong>preparation</strong> only. CampusOrbit never
        predicts your probability of being selected for a job — no honest system can.
      </Callout>

      {/* milestone drawer */}
      <MilestonePanel
        milestoneId={selectedMilestone?._id}
        open={Boolean(selectedMilestone)}
        onClose={() => setSelectedMilestone(null)}
        onChanged={load}
      />
    </div>
  );
}
