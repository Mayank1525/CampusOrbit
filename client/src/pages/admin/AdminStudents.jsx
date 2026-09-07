import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Search, Filter, RotateCcw, ChevronRight, UserCheck, UserX,
  Mail, TrendingUp, Award, Briefcase, BookOpen, Info, SlidersHorizontal, X, Flame,
} from 'lucide-react';
import { userAPI, dashboardAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, ProgressBar, Avatar, ProgressRing,
} from '../../components/ui/Primitives';
import Modal, { Drawer, ConfirmModal } from '../../components/ui/Modal';
import { timeAgo, formatDate, STAGE_COLORS } from '../../utils/helpers';

const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'AIML', 'Data Science'];

export default function AdminStudents() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [busy, setBusy] = useState('');

  const [filters, setFilters] = useState({
    search: '', branch: '', graduationYear: '', minCgpa: '', maxBacklogs: '', role: '',
  });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const d = await userAPI.list(q);
      setStudents(d.students || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, filters.search]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const reset = () => setFilters({ search: '', branch: '', graduationYear: '', minCgpa: '', maxBacklogs: '', role: '' });

  const openDetail = async (s) => {
    setDetailLoading(true);
    setDetail({ student: s });
    try {
      setDetail(await dashboardAPI.studentDetail(s._id));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleActive = async () => {
    setBusy(toggling._id);
    try {
      await userAPI.toggleActive(toggling._id);
      toast.success(toggling.isActive ? `${toggling.fullName} deactivated` : `${toggling.fullName} reactivated`);
      setToggling(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LoadingScreen label="Loading students…" />;

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'search').length;
  const studentsOnly = students.filter((s) => s.role === 'student');
  const seniors = students.filter((s) => s.role === 'senior');
  const avgCompletion = students.length
    ? Math.round(students.reduce((s, x) => s + (x.profileCompletionPercent ?? x.profileCompletion ?? 0), 0) / students.length)
    : 0;
  const lowProfile = students.filter((s) => (s.profileCompletionPercent ?? s.profileCompletion ?? 0) < 80);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={GraduationCap}
        title="Students"
        subtitle="Every account, their academic profile and their real readiness — no guesswork."
        action={
          <button onClick={() => setFiltersOpen(true)} className="btn-secondary relative">
            <SlidersHorizontal size={15} /> Filters
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orbit-violet text-[10px] font-bold text-white flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={GraduationCap} label="Students" value={studentsOnly.length} sub={`${seniors.length} seniors/alumni`} tone="violet" />
        <StatCard icon={UserCheck} label="Active" value={students.filter((s) => s.isActive).length} sub="Accounts enabled" tone="mint" delay={0.06} />
        <StatCard icon={TrendingUp} label="Avg profile" value={`${avgCompletion}%`} sub="Completion" tone={avgCompletion >= 80 ? 'mint' : 'amber'} delay={0.12} />
        <StatCard icon={Info} label="Under 80%" value={lowProfile.length} sub="Missing eligibility data" tone={lowProfile.length ? 'coral' : 'mint'} delay={0.18} />
      </div>

      {lowProfile.length > 0 && (
        <Callout tone="amber" icon={Info} title={`${lowProfile.length} student(s) have incomplete profiles`}>
          Missing CGPA, branch or graduation year means the eligibility engine has to treat them conservatively — they
          may be silently excluded from drives they would actually qualify for. The daily cron job already nudges
          anyone under 80%.
        </Callout>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-10 pr-10"
            placeholder="Search by name, email or college…"
            value={filters.search}
            onChange={(e) => setF('search', e.target.value)}
          />
          {refreshing && <Spinner size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orbit-cyan" />}
        </div>
        <Tabs
          tabs={[
            { key: '', label: 'All', count: students.length },
            { key: 'student', label: 'Students', count: studentsOnly.length },
            { key: 'senior', label: 'Seniors', count: seniors.length },
          ]}
          active={filters.role}
          onChange={(v) => setF('role', v)}
        />
      </div>

      {activeFilters > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(filters).filter(([k, v]) => v && k !== 'search').map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 chip-violet">
              {k}: {v}
              <button onClick={() => setF(k, '')} className="opacity-60 hover:opacity-100" aria-label={`Clear ${k}`}><X size={10} /></button>
            </span>
          ))}
          <button onClick={reset} className="btn-ghost btn-sm"><RotateCcw size={12} /> Clear all</button>
        </div>
      )}

      {students.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={GraduationCap}
            title="No students match"
            description={activeFilters ? 'Try relaxing your filters.' : 'No accounts yet.'}
            action={activeFilters ? <button onClick={reset} className="btn-secondary"><RotateCcw size={15} /> Clear filters</button> : null}
          />
        </MotionCard>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {students.map((s, i) => {
              const p = s.profile || {};
              const completion = s.profileCompletionPercent ?? s.profileCompletion ?? 0;
              return (
                <motion.div
                  key={s._id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  whileHover={{ y: -4 }}
                  className={`glass p-5 ${!s.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar name={s.fullName} color={s.avatarColor} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-white truncate">{s.fullName}</p>
                        {!s.isActive && <Badge tone="coral">Inactive</Badge>}
                        {s.role === 'senior' && <Badge tone="cyan">Senior</Badge>}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                        <Mail size={10} /> {s.email}
                      </p>
                    </div>
                    {s.streak?.current > 0 && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 shrink-0">
                        <Flame size={12} /> {s.streak.current}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {[
                      { l: 'Branch', v: p.branch || '—' },
                      { l: 'CGPA', v: p.cgpa ?? '—' },
                      { l: 'Year', v: p.graduationYear || '—' },
                      { l: 'Backlogs', v: p.backlogCount ?? 0 },
                    ].map((x) => (
                      <div key={x.l} className="rounded-lg bg-white/[0.04] px-1.5 py-1.5 text-center">
                        <p className="text-[12px] font-bold text-slate-200 truncate">{x.v}</p>
                        <p className="text-[8px] uppercase tracking-wide text-slate-500">{x.l}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Profile completion</span>
                      <span className="text-slate-300 tabular-nums font-semibold">{completion}%</span>
                    </div>
                    <ProgressBar value={completion} tone={completion >= 80 ? 'mint' : 'amber'} height="h-1.5" />
                  </div>

                  {p.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.skills.slice(0, 3).map((sk) => (
                        <span key={sk} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.055] text-slate-400 border border-white/10">{sk}</span>
                      ))}
                      {p.skills.length > 3 && <span className="text-[10px] text-slate-600 px-1">+{p.skills.length - 3}</span>}
                    </div>
                  )}

                  <p className="text-[10.5px] text-slate-600 mb-3">
                    {s.lastLoginAt ? `Last active ${timeAgo(s.lastLoginAt)}` : 'Never signed in'}
                  </p>

                  <div className="flex gap-1.5">
                    <button onClick={() => openDetail(s)} className="btn-secondary btn-sm flex-1">
                      Details <ChevronRight size={12} />
                    </button>
                    <button
                      onClick={() => setToggling(s)}
                      className={`btn-secondary btn-sm p-2 ${s.isActive ? 'hover:text-rose-400' : 'hover:text-emerald-400'}`}
                      aria-label={s.isActive ? 'Deactivate' : 'Reactivate'}
                      title={s.isActive ? 'Deactivate account' : 'Reactivate account'}
                    >
                      {s.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* filter drawer */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter students"
        subtitle={`${students.length} matching`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={reset}><RotateCcw size={14} /> Reset</button>
            <button className="btn-primary" onClick={() => setFiltersOpen(false)}>Show {students.length}</button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="sbranch">Branch</label>
            <select id="sbranch" className="input" value={filters.branch} onChange={(e) => setF('branch', e.target.value)}>
              <option value="">Any branch</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="syear">Graduation year</label>
            <select id="syear" className="input" value={filters.graduationYear} onChange={(e) => setF('graduationYear', e.target.value)}>
              <option value="">Any year</option>
              {[2025, 2026, 2027, 2028, 2029].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="scgpa">
              Minimum CGPA — <span className="text-orbit-cyan">{filters.minCgpa || 'any'}</span>
            </label>
            <input
              id="scgpa" type="range" min="0" max="10" step="0.1"
              value={filters.minCgpa || 0}
              onChange={(e) => setF('minCgpa', e.target.value === '0' ? '' : e.target.value)}
              className="w-full accent-orbit-violet cursor-pointer"
            />
          </div>
          <div>
            <span className="label">Max backlogs</span>
            <div className="flex gap-1.5">
              {['', '0', '1', '2', '3'].map((v) => (
                <button
                  key={v || 'any'}
                  onClick={() => setF('maxBacklogs', v)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-[12px] font-semibold transition-all ${
                    filters.maxBacklogs === v ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {v === '' ? 'Any' : v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>

      {/* student detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.student?.fullName}
        subtitle={detail?.student?.email}
        icon={GraduationCap}
        size="lg"
        footer={<button className="btn-primary" onClick={() => setDetail(null)}>Close</button>}
      >
        {detailLoading ? (
          <div className="flex justify-center py-12"><Spinner size={24} className="text-orbit-violet" /></div>
        ) : detail?.student ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar name={detail.student.fullName} color={detail.student.avatarColor} size={60} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-white">{detail.student.fullName}</p>
                <p className="text-[12px] text-slate-400">{detail.student.profile?.college}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge tone={detail.student.role === 'senior' ? 'cyan' : 'mint'}>{detail.student.role}</Badge>
                  <Badge tone={detail.student.isActive ? 'mint' : 'coral'}>{detail.student.isActive ? 'Active' : 'Inactive'}</Badge>
                  {detail.student.streak?.current > 0 && <Badge tone="amber">🔥 {detail.student.streak.current} day streak</Badge>}
                </div>
              </div>
              <ProgressRing
                value={detail.student.profileCompletionPercent ?? detail.student.profileCompletion ?? 0}
                size={72}
                tone={(detail.student.profileCompletionPercent ?? 0) >= 80 ? 'mint' : 'amber'}
                sublabel="profile"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { l: 'Branch', v: detail.student.profile?.branch || '—' },
                { l: 'CGPA', v: detail.student.profile?.cgpa ?? '—' },
                { l: 'Grad year', v: detail.student.profile?.graduationYear || '—' },
                { l: 'Backlogs', v: detail.student.profile?.backlogCount ?? 0 },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-white/[0.045] border border-white/[0.07] px-2.5 py-2.5 text-center">
                  <p className="text-[15px] font-bold text-white font-display">{s.v}</p>
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-500 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: Briefcase, l: 'Applications', v: detail.applications?.length ?? 0 },
                { icon: BookOpen, l: 'Paths', v: detail.progress?.length ?? 0 },
                { icon: Award, l: 'Quiz attempts', v: detail.quizAttempts ?? 0 },
                { icon: TrendingUp, l: 'Interviews', v: detail.interviewAttempts ?? 0 },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-white/[0.045] border border-white/[0.07] px-2.5 py-2.5 text-center">
                  <s.icon size={14} className="text-orbit-violet mx-auto mb-1" />
                  <p className="text-[15px] font-bold text-white font-display">{s.v}</p>
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>

            {detail.student.profile?.skills?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {detail.student.profile.skills.map((s) => <span key={s} className="chip-cyan">{s}</span>)}
                </div>
              </div>
            )}

            {detail.progress?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Learning paths</p>
                <div className="space-y-2">
                  {detail.progress.map((p) => (
                    <div key={p._id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-[13px] font-semibold text-slate-100 truncate">{p.pathId?.title}</p>
                        <Badge tone={p.status === 'active' ? 'violet' : 'slate'}>{p.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {(p.lessons || []).filter((l) => l.completed).length} lessons ·{' '}
                        {(p.milestones || []).filter((m) => m.status === 'completed').length} milestones complete
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.applications?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Applications</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-thin pr-1">
                  {detail.applications.map((a) => (
                    <div key={a._id} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-slate-200 truncate">{a.opportunityId?.title}</p>
                        <p className="text-[10.5px] text-slate-500 truncate">{a.opportunityId?.company}</p>
                      </div>
                      <Badge tone={STAGE_COLORS[a.stage] || 'slate'}>{a.stage}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Callout tone="violet" icon={Info}>
              This view is read-only aggregate data. CampusOrbit never exposes a student's private Document Wallet
              contents to admins — only the checklist of which categories they have, attached to an application.
            </Callout>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(toggling)}
        onClose={() => setToggling(null)}
        onConfirm={toggleActive}
        title={toggling?.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        message={
          toggling?.isActive
            ? `${toggling?.fullName} will not be able to sign in. Their data is kept intact and you can reactivate at any time.`
            : `${toggling?.fullName} will be able to sign in again with their existing password.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Reactivate'}
        danger={toggling?.isActive}
      />
    </div>
  );
}
