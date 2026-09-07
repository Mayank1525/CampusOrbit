import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Briefcase, Calendar, CheckCircle2, XCircle, Clock, ArrowRight,
  Trash2, FileText, ExternalLink, TrendingUp, Info, Layers, Building2, ChevronRight, History,
} from 'lucide-react';
import { applicationAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, ProgressBar,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { formatDate, formatDateTime, timeAgo, deadlineLabel, STAGE_COLORS } from '../utils/helpers';

const STAGES = [
  'Saved', 'Preparing', 'Applied', 'Shortlisted', 'Assessment',
  'Technical Round', 'HR Round', 'Selected', 'Rejected',
];
const SELF_STAGES = ['Saved', 'Preparing', 'Applied'];
const ACTIVE_STAGES = STAGES.filter((s) => !['Selected', 'Rejected'].includes(s));

export default function Applications() {
  const toast = useToast();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('board');
  const [selected, setSelected] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const d = await applicationAPI.mine();
      setApps(d.applications || []);
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

  const moveStage = async (app, stage) => {
    setBusy(app._id);
    try {
      await applicationAPI.updateMyStage(app._id, { stage, note: 'Moved by student' });
      toast.success(`Moved to ${stage}`);
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

  const withdraw = async () => {
    try {
      await applicationAPI.withdraw(withdrawing._id);
      toast.success('Application withdrawn');
      setWithdrawing(null);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openDetail = async (app) => {
    try {
      const d = await applicationAPI.get(app._id);
      setSelected(d.application);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading your pipeline…" />;

  const byStage = STAGES.reduce((acc, s) => ({ ...acc, [s]: apps.filter((a) => a.stage === s) }), {});
  const active = apps.filter((a) => ACTIVE_STAGES.includes(a.stage));
  const selectedCount = byStage.Selected.length;
  const rejectedCount = byStage.Rejected.length;

  const AppCard = ({ app, compact = false }) => {
    const o = app.opportunityId;
    if (!o) return null;
    const dl = deadlineLabel(o.deadline);
    const canMove = SELF_STAGES.includes(app.stage);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -3 }}
        className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-3.5 hover:border-orbit-violet/30 transition-all group"
      >
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center shrink-0 text-[11px] font-bold text-white">
            {o.companyLogoText || o.company?.[0] || <Building2 size={14} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-slate-100 leading-snug line-clamp-2">{o.title}</p>
            <p className="text-[11px] text-slate-500 truncate">{o.company}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          <Badge tone={STAGE_COLORS[app.stage] || 'slate'}>{app.stage}</Badge>
          {o.deadline && <Badge tone={dl.tone}>{dl.text}</Badge>}
        </div>

        {!compact && app.eligibilitySnapshot && (
          <p className="text-[10.5px] text-slate-500 mb-2.5 flex items-start gap-1.5">
            {app.eligibilitySnapshot.eligible ? (
              <CheckCircle2 size={10} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={10} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            {app.eligibilitySnapshot.eligible ? 'Eligible when applied' : 'Applied with eligibility gaps'}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <button onClick={() => openDetail(app)} className="btn-secondary btn-sm flex-1 text-[11px] py-1">
            Details <ChevronRight size={11} />
          </button>
          {canMove && (
            <select
              value={app.stage}
              onChange={(e) => moveStage(app, e.target.value)}
              disabled={busy === app._id}
              className="text-[11px] rounded-lg bg-space-900/70 border border-white/10 px-2 py-1.5 text-slate-300 focus:border-orbit-violet/60 focus:outline-none cursor-pointer"
              aria-label="Change stage"
            >
              {SELF_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="My Applications"
        subtitle="Every drive you saved or applied to, and exactly where it stands."
        action={
          <>
            <Tabs
              tabs={[
                { key: 'board', label: 'Pipeline', icon: Layers },
                { key: 'list', label: 'List', icon: ClipboardList },
              ]}
              active={view}
              onChange={setView}
            />
            <Link to="/opportunities" className="btn-primary">
              <Briefcase size={15} /> Find drives
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ClipboardList} label="Total" value={apps.length} sub="All applications" tone="violet" />
        <StatCard icon={TrendingUp} label="In progress" value={active.length} sub="Still moving" tone="cyan" delay={0.06} />
        <StatCard icon={CheckCircle2} label="Selected" value={selectedCount} sub="Offers received" tone="mint" delay={0.12} />
        <StatCard icon={XCircle} label="Closed" value={rejectedCount} sub="Not this time" tone="coral" delay={0.18} />
      </div>

      {apps.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={ClipboardList}
            title="No applications yet"
            description="Save a drive you are preparing for, or apply directly. Both show up in this pipeline."
            action={<Link to="/opportunities" className="btn-primary"><Briefcase size={15} /> Browse Placement Hub</Link>}
          />
        </MotionCard>
      ) : view === 'board' ? (
        /* ------------------------------------------------ kanban board */
        <div className="overflow-x-auto pb-3 -mx-1 px-1">
          <div className="flex gap-3 min-w-max">
            {STAGES.map((stage, si) => {
              const items = byStage[stage];
              return (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.04 }}
                  className="w-[262px] shrink-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5 px-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: {
                            slate: '#64748b', amber: '#fbbf24', cyan: '#22d3ee',
                            violet: '#7c5cff', mint: '#34d399', coral: '#fb7185',
                          }[STAGE_COLORS[stage]] || '#64748b',
                        }}
                      />
                      <p className="text-[12px] font-bold text-slate-200 truncate">{stage}</p>
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{items.length}</span>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.012] p-2 min-h-[130px] space-y-2">
                    <AnimatePresence mode="popLayout">
                      {items.length === 0 ? (
                        <p className="text-[11px] text-slate-600 text-center py-6">Empty</p>
                      ) : (
                        items.map((a) => <AppCard key={a._id} app={a} compact />)
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------- list */
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {apps.map((a) => <AppCard key={a._id} app={a} />)}
          </AnimatePresence>
        </div>
      )}

      <Callout tone="cyan" icon={Info} title="Who controls the stages">
        You can move an application between <strong>Saved</strong>, <strong>Preparing</strong> and{' '}
        <strong>Applied</strong> yourself. Everything after that — Shortlisted, Assessment, Technical, HR,
        Selected, Rejected — is set by the placement cell, so the pipeline reflects reality and not wishful
        thinking.
      </Callout>

      {/* -------------------------------------------------- detail modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.opportunityId?.title}
        subtitle={selected?.opportunityId?.company}
        icon={Briefcase}
        size="lg"
        footer={
          <>
            {selected && SELF_STAGES.includes(selected.stage) && (
              <button className="btn-danger" onClick={() => setWithdrawing(selected)}>
                <Trash2 size={14} /> Withdraw
              </button>
            )}
            <Link to={`/opportunities/${selected?.opportunityId?._id}`} className="btn-secondary">
              <ExternalLink size={14} /> View drive
            </Link>
            <button className="btn-primary" onClick={() => setSelected(null)}>Close</button>
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge tone={STAGE_COLORS[selected.stage] || 'slate'}>{selected.stage}</Badge>
              {selected.appliedAt && <Badge tone="slate">Applied {formatDate(selected.appliedAt)}</Badge>}
              {selected.eligibilitySnapshot?.eligible ? (
                <Badge tone="mint" icon={CheckCircle2}>Was eligible</Badge>
              ) : (
                <Badge tone="coral" icon={XCircle}>Eligibility gaps</Badge>
              )}
            </div>

            {/* pipeline visual */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Pipeline position</p>
              <div className="flex items-center gap-1">
                {ACTIVE_STAGES.map((s, i) => {
                  const idx = ACTIVE_STAGES.indexOf(selected.stage);
                  const reached = idx >= i && idx !== -1;
                  return (
                    <div key={s} className="flex-1 min-w-0">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          reached ? 'bg-gradient-to-r from-orbit-violet to-orbit-cyan' : 'bg-white/[0.07]'
                        }`}
                      />
                      <p className={`text-[8.5px] mt-1.5 truncate text-center ${reached ? 'text-slate-300' : 'text-slate-600'}`}>
                        {s}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* self stage control */}
            {SELF_STAGES.includes(selected.stage) && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Move this yourself</p>
                <div className="flex gap-2">
                  {SELF_STAGES.map((s) => (
                    <button
                      key={s}
                      onClick={() => moveStage(selected, s)}
                      disabled={busy === selected._id || selected.stage === s}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all ${
                        selected.stage === s
                          ? 'border-orbit-violet/60 bg-orbit-violet/15 text-white'
                          : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.coverNote && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Your cover note</p>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{selected.coverNote}</p>
                </div>
              </div>
            )}

            {selected.documentChecklist?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Checklist snapshot at the time you applied
                </p>
                <div className="space-y-1.5">
                  {selected.documentChecklist.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] ${
                        c.satisfied ? 'text-emerald-200 bg-emerald-400/[0.055]' : 'text-slate-400 bg-white/[0.025]'
                      }`}
                    >
                      {c.satisfied ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded border border-white/25 shrink-0" />
                      )}
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* timeline */}
            {selected.timeline?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                  <History size={11} /> Stage history
                </p>
                <div className="relative pl-6 space-y-3">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-orbit-violet/45 to-white/[0.06]" />
                  {selected.timeline
                    .slice()
                    .reverse()
                    .map((t, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative"
                      >
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
                      </motion.div>
                    ))}
                </div>
              </div>
            )}

            {selected.adminNote && (
              <Callout tone="violet" icon={Info} title="Note from the placement cell">
                {selected.adminNote}
              </Callout>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(withdrawing)}
        onClose={() => setWithdrawing(null)}
        onConfirm={withdraw}
        title="Withdraw this application?"
        message={`Your application to "${withdrawing?.opportunityId?.title}" will be removed from your pipeline. You can apply again while the drive is open.`}
        confirmLabel="Withdraw"
        danger
      />
    </div>
  );
}
