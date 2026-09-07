import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3, TrendingUp, Flame, Target, Trophy, Repeat, MessageSquare,
  CheckCircle2, Clock, Award, Zap, BookOpen, Info,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { dashboardAPI, quizAPI, interviewAPI, userAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, StatCard,
  ProgressRing, ProgressBar, SectionHeader, Callout,
} from '../components/ui/Primitives';
import { formatDate } from '../utils/helpers';

const CHART_COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#fb7185', '#fbbf24', '#f472b6'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/15 bg-space-950/95 backdrop-blur-xl px-3.5 py-2.5 shadow-elevate">
      {label && <p className="text-[11px] font-bold text-slate-200 mb-1.5">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="text-[11px] flex items-center gap-2" style={{ color: p.color || p.fill }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <strong className="tabular-nums">{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function Progress() {
  const toast = useToast();
  const [charts, setCharts] = useState(null);
  const [dash, setDash] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, d, q, iv, s] = await Promise.all([
          dashboardAPI.charts(),
          dashboardAPI.student(),
          quizAPI.myAttempts(),
          interviewAPI.attempts(),
          userAPI.stats(),
        ]);
        setCharts(c);
        setDash(d);
        setAttempts(q.attempts || []);
        setInterviews(iv.attempts || []);
        setStats(s);
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingScreen label="Crunching your numbers…" />;
  if (!charts || !dash) return <EmptyState title="No progress data" description="Start a lesson to generate progress data." />;

  // ---- derived data ----
  const daily = charts.daily.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    activity: d.quizzes + d.interviews + d.revisions,
  }));

  const last14 = daily.slice(-14);

  const quizTrend = attempts
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-12)
    .map((a, i) => ({ attempt: `#${i + 1}`, percent: a.percent, passed: a.passed ? 1 : 0 }));

  const interviewTrend = interviews
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((a, i) => ({
      attempt: `#${i + 1}`,
      overall: a.feedback?.overall || 0,
      technical: a.feedback?.technicalAccuracy || 0,
      clarity: a.feedback?.clarity || 0,
      structure: a.feedback?.structure || 0,
    }));

  const latestInterview = interviews[0]?.feedback;
  const radarData = latestInterview
    ? [
        { skill: 'Technical', score: latestInterview.technicalAccuracy || 0 },
        { skill: 'Clarity', score: latestInterview.clarity || 0 },
        { skill: 'Structure', score: latestInterview.structure || 0 },
        { skill: 'Overall', score: latestInterview.overall || 0 },
      ]
    : [];

  const totalActivity = daily.reduce((s, d) => s + d.activity, 0);
  const activeDays = daily.filter((d) => d.activity > 0).length;
  const quizAvg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length)
    : 0;
  const quizPassRate = attempts.length
    ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={BarChart3}
        title="Progress"
        subtitle="Thirty days of real activity, pulled straight from MongoDB. No vanity numbers."
        action={<Link to="/my-path" className="btn-secondary"><Target size={15} /> My orbit</Link>}
      />

      {/* headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Flame} label="Current streak" value={`${dash.streak?.current || 0}d`} sub={`Longest ${dash.streak?.longest || 0} days`} tone="amber" />
        <StatCard icon={Zap} label="Active days" value={`${activeDays}/30`} sub={`${totalActivity} total actions`} tone="violet" delay={0.06} />
        <StatCard icon={Trophy} label="Quiz average" value={`${quizAvg}%`} sub={`${quizPassRate}% pass rate · ${attempts.length} attempts`} tone="cyan" delay={0.12} />
        <StatCard icon={MessageSquare} label="Interview avg" value={dash.interviewStats.averageOverall || 0} sub={`out of 10 · ${interviews.length} attempts`} tone="coral" delay={0.18} />
      </div>

      {/* activity chart */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader
          icon={TrendingUp}
          title="Daily activity"
          subtitle="Quizzes, interview attempts and revisions completed each day"
          className="mb-5"
        />
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="gQuiz" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" iconSize={7} />
              <Area type="monotone" dataKey="quizzes" name="Quizzes" stroke="#7c5cff" strokeWidth={2} fill="url(#gQuiz)" />
              <Area type="monotone" dataKey="revisions" name="Revisions" stroke="#22d3ee" strokeWidth={2} fill="url(#gRev)" />
              <Area type="monotone" dataKey="interviews" name="Interviews" stroke="#fb7185" strokeWidth={2} fill="url(#gInt)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </MotionCard>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* quiz trend */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Trophy} title="Quiz performance" subtitle="Last 12 attempts" className="mb-5" />
          {quizTrend.length === 0 ? (
            <EmptyState icon={Trophy} title="No quiz attempts yet" description="Take a lesson quiz to see your trend here." className="py-8" />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quizTrend} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="attempt" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="percent" name="Score %" radius={[6, 6, 0, 0]}>
                    {quizTrend.map((d, i) => (
                      <Cell key={i} fill={d.percent >= 60 ? '#34d399' : '#fb7185'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </MotionCard>

        {/* path breakdown */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={BookOpen} title="Path completion" subtitle="Lessons done vs remaining" className="mb-5" />
          {charts.pathBreakdown.length === 0 ? (
            <EmptyState icon={BookOpen} title="No path started" description="Pick a path to see this breakdown." className="py-8" />
          ) : (
            <div className="space-y-4">
              <div className="h-[170px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={charts.pathBreakdown}
                      dataKey="completed"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={68}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {charts.pathBreakdown.map((d, i) => (
                        <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5">
                {charts.pathBreakdown.map((p, i) => (
                  <div key={p.name}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="flex items-center gap-2 text-slate-300 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || CHART_COLORS[i % CHART_COLORS.length] }} />
                        {p.name}
                      </span>
                      <span className="text-slate-500 tabular-nums shrink-0">
                        {p.completed}/{p.completed + p.remaining}
                      </span>
                    </div>
                    <ProgressBar value={p.percent} tone={i === 0 ? 'violet' : 'cyan'} height="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </MotionCard>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        {/* interview trend */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={MessageSquare} title="Interview practice trend" subtitle="Scored out of 10 on each dimension" className="mb-5" />
          {interviewTrend.length === 0 ? (
            <EmptyState icon={MessageSquare} title="No interview attempts" description="Answer one question in the Interview Practice Studio." className="py-8" />
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={interviewTrend} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="attempt" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="#7c5cff" strokeWidth={2.5} dot={{ r: 3, fill: '#7c5cff' }} />
                  <Line type="monotone" dataKey="technical" name="Technical" stroke="#22d3ee" strokeWidth={1.8} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="clarity" name="Clarity" stroke="#34d399" strokeWidth={1.8} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="structure" name="Structure" stroke="#fbbf24" strokeWidth={1.8} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </MotionCard>

        {/* latest interview radar */}
        <MotionCard hover={false} className="p-5">
          <SectionHeader icon={Award} title="Latest interview breakdown" subtitle="Your most recent attempt" className="mb-5" />
          {radarData.length === 0 ? (
            <EmptyState icon={Award} title="No feedback yet" description="Practise one question to unlock this." className="py-8" />
          ) : (
            <>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <PolarRadiusAxis domain={[0, 10]} tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} />
                    <Radar name="Score" dataKey="score" stroke="#7c5cff" fill="#7c5cff" fillOpacity={0.34} strokeWidth={2} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              {interviews[0]?.feedback?.recommendedNextTopic && (
                <div className="mt-3 rounded-xl border border-cyan-400/22 bg-cyan-400/[0.06] px-3.5 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1">Recommended next</p>
                  <p className="text-[12px] text-cyan-100/85 leading-relaxed">
                    {interviews[0].feedback.recommendedNextTopic}
                  </p>
                </div>
              )}
            </>
          )}
        </MotionCard>
      </div>

      {/* preparation summary */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={Target} title="Where you stand" subtitle="A plain-English read of your numbers" className="mb-5" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { ring: dash.preparationScore, tone: 'violet', label: 'Preparation', sub: 'path progress' },
            { ring: dash.profileCompletion, tone: dash.profileCompletion >= 80 ? 'mint' : 'amber', label: 'Profile', sub: 'eligibility fields' },
            { ring: quizPassRate, tone: 'cyan', label: 'Quiz pass rate', sub: `${attempts.length} attempts` },
            { ring: Math.round((activeDays / 30) * 100), tone: 'coral', label: 'Consistency', sub: `${activeDays} of 30 days` },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center text-center rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
            >
              <ProgressRing value={s.ring} size={82} tone={s.tone} />
              <p className="text-[13px] font-bold text-white mt-3">{s.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{s.sub}</p>
            </motion.div>
          ))}
        </div>
      </MotionCard>

      <Callout tone="cyan" icon={Info} title="What these numbers are and are not">
        Every figure here is computed from what you actually did — lessons completed, quizzes submitted, revisions
        marked done, interview answers written. There is no engagement score, no leaderboard rank, and above all no
        prediction of whether you will get placed. That last one is not something software can honestly tell you.
      </Callout>
    </div>
  );
}
