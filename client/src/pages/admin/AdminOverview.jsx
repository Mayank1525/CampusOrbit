import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Briefcase, TrendingUp, Award, MessageSquare,
  FileCheck, Calendar, AlertCircle, ArrowRight, Target, BarChart3,
  Sparkles, CheckCircle2, RefreshCw, Info, GraduationCap,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { dashboardAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, StatCard,
  ProgressBar, SectionHeader, Callout, Spinner,
} from '../../components/ui/Primitives';
import { formatDate, deadlineLabel, STAGE_COLORS } from '../../utils/helpers';

const COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#818cf8', '#a78bfa'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-space-950/95 backdrop-blur-xl px-3.5 py-2.5 shadow-elevate">
      {label && <p className="text-[11px] font-bold text-slate-200 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-[11px] flex items-center gap-2" style={{ color: p.color || p.fill }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <strong className="tabular-nums">{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AdminOverview() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    try {
      setData(await dashboardAPI.analytics());
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

  const runReminders = async () => {
    setRunning(true);
    try {
      const d = await dashboardAPI.runReminders();
      toast.success(`${d.revisions} revision, ${d.deadlines} deadline and ${d.profiles} profile reminders sent.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <LoadingScreen label="Crunching placement analytics…" />;
  if (!data) return <EmptyState title="No analytics" description="Could not load analytics." />;

  const {
    kpis, applicationsPerCompany, roundConversion, inDemandSkills, skillGap,
    profileCompletionDistribution, eligibilityPerDrive, upcomingDeadlines, shortlistedStudents,
  } = data;

  const funnel = roundConversion.filter((r) => !['Saved', 'Preparing', 'Rejected'].includes(r.stage));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LayoutDashboard}
        title="Placement Cell Overview"
        subtitle="Live numbers from MongoDB — students, drives, pipeline conversion and the skill gap you need to close."
        action={
          <>
            <button onClick={runReminders} disabled={running} className="btn-secondary">
              {running ? <Spinner size={14} /> : <RefreshCw size={15} />} Run reminder job
            </button>
            <Link to="/admin/opportunities" className="btn-primary">
              <Briefcase size={15} /> Manage drives
            </Link>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Students" value={kpis.totalStudents} sub={`${kpis.activeStudents} active accounts`} tone="violet" />
        <StatCard icon={Briefcase} label="Opportunities" value={kpis.totalOpportunities} sub={`${kpis.activeOpportunities} currently open`} tone="cyan" delay={0.06} />
        <StatCard icon={TrendingUp} label="Applications" value={kpis.totalApplications} sub={`${kpis.shortlistedCount} shortlisted`} tone="mint" delay={0.12} />
        <StatCard icon={Award} label="Selected" value={kpis.selectedCount} sub="Offers so far" tone="amber" delay={0.18} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={MessageSquare} label="Peer rooms" value={kpis.rooms} sub="Active study rooms" tone="violet" delay={0.02} />
        <StatCard icon={FileCheck} label="Notes awaiting review" value={kpis.pendingNoteReviews} sub="Draft AI content" tone={kpis.pendingNoteReviews > 0 ? 'coral' : 'mint'} delay={0.08} />
        <StatCard icon={Target} label="Quiz attempts" value={kpis.quizAttempts} sub={`${kpis.interviewAttempts} interview attempts`} tone="cyan" delay={0.14} />
        <StatCard icon={GraduationCap} label="Avg profile" value={`${kpis.averageProfileCompletion}%`} sub="Completion across students" tone={kpis.averageProfileCompletion >= 80 ? 'mint' : 'amber'} delay={0.2} />
      </div>

      {kpis.pendingNoteReviews > 0 && (
        <Callout tone="amber" icon={AlertCircle} title={`${kpis.pendingNoteReviews} generated note(s) waiting for review`}>
          Draft AI content is invisible to students until you publish it. That gate is what stops unreviewed material
          reaching learners.
          <Link to="/admin/ai-review" className="block mt-1.5 underline font-semibold">Open AI Review queue →</Link>
        </Callout>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* pipeline funnel */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={TrendingUp} title="Pipeline conversion" subtitle="Where students actually drop off" className="mb-5" />
          <div className="space-y-2.5">
            {funnel.map((r, i) => (
              <motion.div
                key={r.stage}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <div className="flex items-center justify-between text-[12.5px] mb-1">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: {
                          slate: '#64748b', amber: '#fbbf24', cyan: '#22d3ee',
                          violet: '#7c5cff', mint: '#34d399', coral: '#fb7185',
                        }[STAGE_COLORS[r.stage]] || '#64748b',
                      }}
                    />
                    {r.stage}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    {r.count} <span className="opacity-60">· {r.conversionFromApplied}% of applied</span>
                  </span>
                </div>
                <ProgressBar
                  value={r.conversionFromApplied}
                  tone={r.stage === 'Selected' ? 'mint' : i < 3 ? 'violet' : 'cyan'}
                  height="h-2"
                />
              </motion.div>
            ))}
          </div>
        </MotionCard>

        {/* applications per company */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Briefcase} title="Applications per company" className="mb-5" />
          {applicationsPerCompany.length === 0 ? (
            <EmptyState icon={Briefcase} title="No applications yet" className="py-8" />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={applicationsPerCompany} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis
                    type="category" dataKey="company" width={130}
                    tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" name="Applications" radius={[0, 6, 6, 0]}>
                    {applicationsPerCompany.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </MotionCard>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* skill gap */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader
            icon={Target}
            title="Skill gap"
            subtitle="What companies ask for vs what your students actually have"
            className="mb-5"
          />
          {skillGap.length === 0 ? (
            <EmptyState icon={Target} title="No skill data" className="py-8" />
          ) : (
            <div className="space-y-3">
              {skillGap.slice(0, 8).map((s, i) => (
                <motion.div
                  key={s.skill}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center justify-between text-[12.5px] mb-1">
                    <span className="text-slate-300 capitalize">{s.skill}</span>
                    <span className="text-slate-500 tabular-nums text-[11px]">
                      {s.studentsWithSkill} student{s.studentsWithSkill === 1 ? '' : 's'} · {s.demand} drive{s.demand === 1 ? '' : 's'} want it
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <ProgressBar
                      value={100 - s.gapPercent}
                      tone={s.gapPercent >= 75 ? 'coral' : s.gapPercent >= 50 ? 'amber' : 'mint'}
                      height="h-1.5"
                      className="flex-1"
                    />
                    <span
                      className={`text-[11px] font-bold tabular-nums shrink-0 w-12 text-right ${
                        s.gapPercent >= 75 ? 'text-rose-400' : s.gapPercent >= 50 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {s.gapPercent}% gap
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <Callout tone="cyan" icon={Info} className="mt-4">
            A high gap means drives are asking for a skill your cohort mostly does not list. That is a curriculum
            signal, not a student failure.
          </Callout>
        </MotionCard>

        {/* profile distribution */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Users} title="Profile completion spread" className="mb-5" />
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={profileCompletionDistribution}
                  dataKey="count"
                  nameKey="range"
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={76}
                  paddingAngle={3}
                  stroke="none"
                >
                  {profileCompletionDistribution.map((_, i) => (
                    <Cell key={i} fill={['#fb7185', '#fbbf24', '#22d3ee', '#34d399'][i] || COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-3">
            {profileCompletionDistribution.map((d, i) => (
              <div key={d.range} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: ['#fb7185', '#fbbf24', '#22d3ee', '#34d399'][i] }} />
                  {d.range}% complete
                </span>
                <span className="text-slate-300 font-semibold tabular-nums">{d.count}</span>
              </div>
            ))}
          </div>
        </MotionCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* eligibility per drive */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader
            icon={CheckCircle2}
            title="Eligibility reach per drive"
            subtitle="How many students each drive is actually open to"
            className="mb-4"
          />
          {!eligibilityPerDrive?.length ? (
            <EmptyState icon={CheckCircle2} title="No published drives" className="py-8" />
          ) : (
            <div className="space-y-3">
              {eligibilityPerDrive.map((d, i) => {
                const pct = d.totalStudents ? Math.round((d.eligibleCount / d.totalStudents) * 100) : 0;
                return (
                  <motion.div
                    key={d.opportunityId || d.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center justify-between text-[12.5px] mb-1 gap-3">
                      <span className="text-slate-300 truncate">{d.title}</span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {d.eligibleCount}/{d.totalStudents} eligible
                      </span>
                    </div>
                    <ProgressBar value={pct} tone={pct >= 60 ? 'mint' : pct >= 30 ? 'amber' : 'coral'} height="h-1.5" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </MotionCard>

        {/* upcoming deadlines */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Calendar} title="Closing soon" className="mb-4" />
          {!upcomingDeadlines?.length ? (
            <EmptyState icon={Calendar} title="No upcoming deadlines" className="py-8" />
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map((d) => {
                const dl = deadlineLabel(d.deadline);
                return (
                  <Link
                    key={d._id}
                    to={`/admin/applicants?opportunityId=${d._id}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 hover:border-orbit-violet/30 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">{d.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {d.company} · closes {formatDate(d.deadline)}
                      </p>
                    </div>
                    <Badge tone={dl.tone}>{dl.text}</Badge>
                    <ArrowRight size={13} className="text-slate-600 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </MotionCard>
      </div>

      {/* shortlisted students */}
      {shortlistedStudents?.length > 0 && (
        <MotionCard hover={false} className="p-5">
          <SectionHeader
            icon={Award}
            title="Students in advanced rounds"
            subtitle="Shortlisted or beyond — these need the most support right now"
            className="mb-4"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {shortlistedStudents.map((s, i) => (
              <motion.div
                key={s._id || i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3"
              >
                <p className="text-[13px] font-semibold text-slate-100 truncate">{s.studentName || s.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{s.opportunityTitle || s.title}</p>
                <Badge tone={STAGE_COLORS[s.stage] || 'cyan'} className="mt-1.5">{s.stage}</Badge>
              </motion.div>
            ))}
          </div>
        </MotionCard>
      )}

      {/* quick links */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: '/admin/opportunities', icon: Briefcase, label: 'Opportunities', desc: 'Create, publish, expire' },
          { to: '/admin/applicants', icon: Users, label: 'Applicants', desc: 'Filter, move stages, export CSV' },
          { to: '/admin/ai-review', icon: Sparkles, label: 'AI Review', desc: `${kpis.pendingNoteReviews} pending` },
          { to: '/admin/students', icon: GraduationCap, label: 'Students', desc: 'Profiles and readiness' },
        ].map((l, i) => (
          <motion.div key={l.to} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -4 }}>
            <Link to={l.to} className="glass p-4 flex items-center gap-3 group h-full">
              <div className="w-10 h-10 rounded-xl bg-orbit-violet/12 border border-orbit-violet/25 flex items-center justify-center shrink-0">
                <l.icon size={18} className="text-orbit-violet" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-white">{l.label}</p>
                <p className="text-[11px] text-slate-500 truncate">{l.desc}</p>
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-orbit-violet group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
