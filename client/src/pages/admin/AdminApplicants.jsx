import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Filter, Download, Search, SlidersHorizontal, RotateCcw, ChevronRight,
  CheckCircle2, XCircle, FileText, Mail, GraduationCap, TrendingUp, MessageSquare,
  Info, X, Briefcase, Layers, History, Save,
} from 'lucide-react';
import { applicationAPI, opportunityAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, ProgressBar, Avatar,
} from '../../components/ui/Primitives';
import Modal, { Drawer } from '../../components/ui/Modal';
import { formatDate, formatDateTime, timeAgo, STAGE_COLORS } from '../../utils/helpers';

const STAGES = [
  'Saved', 'Preparing', 'Applied', 'Shortlisted', 'Assessment',
  'Technical Round', 'HR Round', 'Selected', 'Rejected',
];
const BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical', 'AIML', 'Data Science'];

export default function AdminApplicants() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ applicants: [], count: 0, stages: {} });
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [stageNote, setStageNote] = useState('');

  const [filters, setFilters] = useState({
    opportunityId: params.get('opportunityId') || '',
    stage: '', branch: '', minCgpa: '', maxBacklogs: '',
    graduationYear: '', skill: '', minProfileCompletion: '', search: '',
  });

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const q = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      setData(await applicationAPI.applicants(q));
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

  useEffect(() => {
    opportunityAPI.list({ limit: 100 }).then((d) => setOpportunities(d.opportunities || [])).catch(() => {});
  }, []);

  const setF = (k, v) => {
    setFilters((f) => ({ ...f, [k]: v }));
    if (k === 'opportunityId') setParams(v ? { opportunityId: v } : {});
  };

  const reset = () => {
    setFilters({
      opportunityId: '', stage: '', branch: '', minCgpa: '', maxBacklogs: '',
      graduationYear: '', skill: '', minProfileCompletion: '', search: '',
    });
    setParams({});
  };

  const moveStage = async (app, stage) => {
    setBusy(app._id);
    try {
      await applicationAPI.updateStage(app._id, { stage, note: stageNote || `Moved to ${stage} by the placement cell` });
      toast.success(`${app.userId.fullName} → ${stage}. The student is notified in-app.`);
      setStageNote('');
      load();
      if (selected?._id === app._id) {
        const d = await applicationAPI.get(app._id);
        setSelected(d.application);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const saveNote = async () => {
    setBusy(selected._id);
    try {
      await applicationAPI.adminNote(selected._id, noteDraft);
      toast.success('Note saved — visible to the student on their application');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const exportCSV = () => {
    const url = applicationAPI.exportUrl(filters.opportunityId || undefined);
    window.open(url, '_blank');
    toast.success('CSV export started');
  };

  if (loading) return <LoadingScreen label="Loading applicants…" />;

  const apps = data.applicants || [];
  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'search').length;
  const selectedOpp = opportunities.find((o) => String(o._id) === String(filters.opportunityId));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Applicants"
        subtitle="Filter by any student attribute, move stages, and export the shortlist as CSV."
        badge={selectedOpp && <Badge tone="violet">{selectedOpp.title}</Badge>}
        action={
          <>
            <button onClick={() => setFiltersOpen(true)} className="btn-secondary relative">
              <SlidersHorizontal size={15} /> Filters
              {activeFilters > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-orbit-violet text-[10px] font-bold text-white flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
            <button onClick={exportCSV} className="btn-primary"><Download size={15} /> Export CSV</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Matching" value={apps.length} sub={`of ${data.count} total`} tone="violet" />
        <StatCard icon={TrendingUp} label="Shortlisted+" value={apps.filter((a) => ['Shortlisted', 'Assessment', 'Technical Round', 'HR Round', 'Selected'].includes(a.stage)).length} sub="Advanced rounds" tone="cyan" delay={0.06} />
        <StatCard icon={CheckCircle2} label="Selected" value={apps.filter((a) => a.stage === 'Selected').length} sub="Offers made" tone="mint" delay={0.12} />
        <StatCard icon={XCircle} label="Rejected" value={apps.filter((a) => a.stage === 'Rejected').length} sub="Closed out" tone="coral" delay={0.18} />
      </div>

      {/* search + stage tabs */}
      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              className="input pl-10 pr-10"
              placeholder="Search by student name or email…"
              value={filters.search}
              onChange={(e) => setF('search', e.target.value)}
            />
            {refreshing && <Spinner size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orbit-cyan" />}
          </div>
          <select
            className="input w-auto min-w-[220px]"
            value={filters.opportunityId}
            onChange={(e) => setF('opportunityId', e.target.value)}
            aria-label="Filter by opportunity"
          >
            <option value="">All opportunities</option>
            {opportunities.map((o) => <option key={o._id} value={o._id}>{o.title} — {o.company}</option>)}
          </select>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setF('stage', '')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
              !filters.stage ? 'border-orbit-violet/50 bg-orbit-violet/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
            }`}
          >
            All stages ({data.count})
          </button>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setF('stage', s)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                filters.stage === s ? 'border-orbit-violet/50 bg-orbit-violet/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
              }`}
            >
              {s} ({data.stages?.[s] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {activeFilters > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-500">Active filters:</span>
          {Object.entries(filters).filter(([k, v]) => v && k !== 'search' && k !== 'opportunityId').map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 chip-violet">
              {k}: {v}
              <button onClick={() => setF(k, '')} className="opacity-60 hover:opacity-100" aria-label={`Clear ${k}`}><X size={10} /></button>
            </span>
          ))}
          <button onClick={reset} className="btn-ghost btn-sm"><RotateCcw size={12} /> Clear all</button>
        </div>
      )}

      {/* table */}
      {apps.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Users}
            title="No applicants match"
            description={activeFilters ? 'Try relaxing your filters.' : 'No one has applied to this drive yet.'}
            action={activeFilters ? <button onClick={reset} className="btn-secondary"><RotateCcw size={15} /> Clear filters</button> : null}
          />
        </MotionCard>
      ) : (
        <MotionCard hover={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {['Student', 'Opportunity', 'Academics', 'Profile', 'Stage', 'Applied', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {apps.map((a, i) => {
                    const p = a.userId?.profile || {};
                    return (
                      <motion.tr
                        key={a._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.2) }}
                        className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-[180px]">
                            <Avatar name={a.userId?.fullName} color={a.userId?.avatarColor} size={30} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-100 truncate">{a.userId?.fullName}</p>
                              <p className="text-[10.5px] text-slate-500 truncate">{a.userId?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[12.5px] text-slate-300 truncate max-w-[180px]">{a.opportunityId?.title}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">{a.opportunityId?.company}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[12.5px] text-slate-300">{p.branch || '—'} · {p.cgpa ?? '—'} CGPA</p>
                          <p className="text-[10.5px] text-slate-500">
                            {p.graduationYear || '—'} · {p.backlogCount ?? 0} backlog(s)
                          </p>
                        </td>
                        <td className="px-4 py-3 min-w-[110px]">
                          <div className="flex items-center gap-2">
                            <ProgressBar
                              value={a.profileCompletion ?? 0}
                              tone={(a.profileCompletion ?? 0) >= 80 ? 'mint' : 'amber'}
                              height="h-1.5"
                              className="w-14"
                            />
                            <span className="text-[11px] text-slate-400 tabular-nums">{a.profileCompletion ?? 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={a.stage}
                            onChange={(e) => moveStage(a, e.target.value)}
                            disabled={busy === a._id}
                            className="text-[11.5px] rounded-lg bg-space-900/70 border border-white/10 px-2 py-1.5 text-slate-200 focus:border-orbit-violet/60 focus:outline-none cursor-pointer min-w-[130px]"
                            aria-label={`Change stage for ${a.userId?.fullName}`}
                          >
                            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[11.5px] text-slate-400">{a.appliedAt ? formatDate(a.appliedAt) : '—'}</p>
                          <p className="text-[10px] text-slate-600">{timeAgo(a.updatedAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setSelected(a); setNoteDraft(a.adminNote || ''); }}
                            className="btn-secondary btn-sm p-2"
                            aria-label="View details"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </MotionCard>
      )}

      <Callout tone="cyan" icon={Info} title="Stage changes are logged and notified">
        Every move you make is appended to the application's timeline with your name and a timestamp, and the student
        gets an in-app notification. Students can only move themselves through Saved, Preparing and Applied — the
        rest is yours.
      </Callout>

      {/* ------------------------------------------------- filter drawer */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter applicants"
        subtitle={`${apps.length} matching right now`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-secondary" onClick={reset}><RotateCcw size={14} /> Reset</button>
            <button className="btn-primary" onClick={() => setFiltersOpen(false)}>Show {apps.length} results</button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="fbranch">Branch</label>
            <select id="fbranch" className="input" value={filters.branch} onChange={(e) => setF('branch', e.target.value)}>
              <option value="">Any branch</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="fcgpa">
              Minimum CGPA — <span className="text-orbit-cyan">{filters.minCgpa || 'any'}</span>
            </label>
            <input
              id="fcgpa" type="range" min="0" max="10" step="0.1"
              value={filters.minCgpa || 0}
              onChange={(e) => setF('minCgpa', e.target.value === '0' ? '' : e.target.value)}
              className="w-full accent-orbit-violet cursor-pointer"
            />
          </div>

          <div>
            <label className="label" htmlFor="fbl">
              Max backlogs — <span className="text-orbit-cyan">{filters.maxBacklogs === '' ? 'any' : filters.maxBacklogs}</span>
            </label>
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

          <div>
            <label className="label" htmlFor="fyear">Graduation year</label>
            <select id="fyear" className="input" value={filters.graduationYear} onChange={(e) => setF('graduationYear', e.target.value)}>
              <option value="">Any year</option>
              {[2025, 2026, 2027, 2028, 2029].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="fskill">Has skill</label>
            <input
              id="fskill" className="input" placeholder="e.g. React"
              value={filters.skill} onChange={(e) => setF('skill', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="fpc">
              Min profile completion — <span className="text-orbit-cyan">{filters.minProfileCompletion || 'any'}%</span>
            </label>
            <input
              id="fpc" type="range" min="0" max="100" step="5"
              value={filters.minProfileCompletion || 0}
              onChange={(e) => setF('minProfileCompletion', e.target.value === '0' ? '' : e.target.value)}
              className="w-full accent-orbit-cyan cursor-pointer"
            />
          </div>
        </div>
      </Drawer>

      {/* ------------------------------------------------ applicant modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.userId?.fullName}
        subtitle={selected?.opportunityId?.title}
        icon={Users}
        size="lg"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setSelected(null)}>Close</button>
            <button className="btn-primary" onClick={saveNote} disabled={busy === selected?._id}>
              {busy === selected?._id ? <Spinner size={14} /> : <Save size={14} />} Save note
            </button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 flex-wrap">
              <Avatar name={selected.userId?.fullName} color={selected.userId?.avatarColor} size={56} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-white">{selected.userId?.fullName}</p>
                <p className="text-[12px] text-slate-400 flex items-center gap-1.5"><Mail size={11} /> {selected.userId?.email}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  <Badge tone={STAGE_COLORS[selected.stage] || 'slate'}>{selected.stage}</Badge>
                  {selected.eligibilitySnapshot?.eligible ? (
                    <Badge tone="mint" icon={CheckCircle2}>Was eligible</Badge>
                  ) : (
                    <Badge tone="coral" icon={XCircle}>Eligibility gaps</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* academics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { l: 'Branch', v: selected.userId?.profile?.branch || '—' },
                { l: 'CGPA', v: selected.userId?.profile?.cgpa ?? '—' },
                { l: 'Grad year', v: selected.userId?.profile?.graduationYear || '—' },
                { l: 'Backlogs', v: selected.userId?.profile?.backlogCount ?? 0 },
              ].map((s) => (
                <div key={s.l} className="rounded-lg bg-white/[0.045] border border-white/[0.07] px-2.5 py-2.5 text-center">
                  <p className="text-[15px] font-bold text-white font-display">{s.v}</p>
                  <p className="text-[9.5px] uppercase tracking-wider text-slate-500 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            {selected.userId?.profile?.skills?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.userId.profile.skills.map((s) => <span key={s} className="chip-cyan">{s}</span>)}
                </div>
              </div>
            )}

            {/* stage control */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Move to stage</p>
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => moveStage(selected, s)}
                    disabled={busy === selected._id || selected.stage === s}
                    className={`rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-all ${
                      selected.stage === s
                        ? 'border-orbit-violet/60 bg-orbit-violet/15 text-white'
                        : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                className="input text-[13px] py-2"
                placeholder="Optional note attached to the stage change"
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
              />
            </div>

            {selected.coverNote && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Cover note</p>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{selected.coverNote}</p>
                </div>
              </div>
            )}

            {selected.resumeId && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <FileText size={16} className="text-orbit-violet shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-200">{selected.resumeId.name}</p>
                  <p className="text-[11px] text-slate-500">Template: {selected.resumeId.template}</p>
                </div>
              </div>
            )}

            {selected.documentChecklist?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Document checklist at time of applying
                </p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {selected.documentChecklist.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${
                        c.satisfied ? 'text-emerald-200 bg-emerald-400/[0.055]' : 'text-amber-200 bg-amber-400/[0.05]'
                      }`}
                    >
                      {c.satisfied ? <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="text-amber-400 shrink-0" />}
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.timeline?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <History size={11} /> Stage history
                </p>
                <div className="relative pl-6 space-y-2.5 max-h-52 overflow-y-auto scrollbar-thin">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-orbit-violet/45 to-white/[0.06]" />
                  {selected.timeline.slice().reverse().map((t, i) => (
                    <div key={i} className="relative">
                      <span
                        className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-space-950"
                        style={{
                          background: {
                            slate: '#64748b', amber: '#fbbf24', cyan: '#22d3ee',
                            violet: '#7c5cff', mint: '#34d399', coral: '#fb7185',
                          }[STAGE_COLORS[t.stage]] || '#64748b',
                        }}
                      />
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-[12.5px] font-semibold text-slate-200">{t.stage}</p>
                          <p className="text-[10px] text-slate-500">{formatDateTime(t.at)}</p>
                        </div>
                        {t.note && <p className="text-[11.5px] text-slate-400 mt-0.5">{t.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label" htmlFor="adminnote">Note to the student</label>
              <textarea
                id="adminnote"
                className="input min-h-[90px] resize-y"
                placeholder="Feedback or next steps. The student sees this on their application."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
