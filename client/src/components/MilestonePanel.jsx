import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Target, ListChecks, Lightbulb, ArrowRightCircle, PlayCircle, CheckCircle2,
  Clock, Briefcase, Link2, Trophy, Lock, AlertCircle,
} from 'lucide-react';
import { pathAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Drawer } from './ui/Modal';
import { Badge, Spinner, ProgressBar, Callout } from './ui/Primitives';

export default function MilestonePanel({ milestoneId, open, onClose, onChanged, readOnly = false }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !milestoneId) {
      setData(null);
      return;
    }
    setLoading(true);
    pathAPI
      .milestone(milestoneId)
      .then((d) => {
        setData(d);
        setProofUrl('');
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneId, open]);

  const markComplete = async () => {
    setSubmitting(true);
    try {
      const res = await pathAPI.completeMilestone(milestoneId, { proofUrl: proofUrl.trim() });
      toast.success(
        res.nextMilestone
          ? `Milestone completed. "${res.nextMilestone.title}" is now unlocked.`
          : 'Milestone completed — that was the last one on this path!'
      );
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const m = data?.milestone;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={m?.title || 'Milestone'}
      subtitle={m ? `Milestone ${m.order} · about ${m.estimatedHours} hours` : undefined}
      width="max-w-xl"
      footer={
        !readOnly && m ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Close</button>
            <button className="btn-success" onClick={markComplete} disabled={submitting}>
              {submitting ? <><Spinner size={14} /> Saving…</> : <><CheckCircle2 size={15} /> Mark complete</>}
            </button>
          </>
        ) : (
          <button className="btn-secondary" onClick={onClose}>Close</button>
        )
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size={26} className="text-orbit-violet" />
        </div>
      )}

      {!loading && m && (
        <div className="space-y-5">
          {/* description */}
          <div>
            <p className="text-sm text-slate-300 leading-relaxed">{m.description}</p>
          </div>

          {/* why it matters */}
          {m.whyItMatters && (
            <Callout tone="violet" icon={Lightbulb} title="Why this matters">
              {m.whyItMatters}
            </Callout>
          )}

          {/* prerequisites */}
          {m.prerequisites?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Lock size={12} /> Prerequisites
              </p>
              <div className="flex flex-wrap gap-1.5">
                {m.prerequisites.map((p) => (
                  <span key={p} className="chip-slate">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* lessons */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <PlayCircle size={12} /> Lessons in this milestone ({data.lessons.length})
            </p>
            {data.lessons.length === 0 ? (
              <p className="text-xs text-slate-500">No lessons attached yet.</p>
            ) : (
              <div className="space-y-2">
                {data.lessons.map((l, i) => (
                  <motion.div
                    key={l._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/learn/${l._id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 hover:bg-white/[0.05] hover:border-orbit-violet/30 transition-all group"
                    >
                      <span className="w-7 h-7 rounded-lg bg-orbit-violet/12 border border-orbit-violet/25 flex items-center justify-center text-[11px] font-bold text-orbit-violet shrink-0">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-slate-100 truncate">{l.title}</span>
                        <span className="block text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <Clock size={10} /> {l.estimatedMinutes} min · {l.difficulty}
                        </span>
                      </span>
                      <PlayCircle size={16} className="text-slate-600 group-hover:text-orbit-violet transition-colors shrink-0" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* practice task */}
          {m.practiceTask && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <ListChecks size={12} /> Practice task
              </p>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                <p className="text-[13px] text-slate-300 leading-relaxed">{m.practiceTask}</p>
              </div>
            </div>
          )}

          {/* proof task */}
          {m.proofTask && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Trophy size={12} /> Proof of work
              </p>
              <div className="rounded-xl border border-amber-400/22 bg-amber-400/[0.06] px-4 py-3 mb-2.5">
                <p className="text-[13px] text-amber-100/85 leading-relaxed">{m.proofTask}</p>
              </div>
              {!readOnly && (
                <div>
                  <label className="label" htmlFor="proofUrl">Proof link (GitHub, deployed URL, doc)</label>
                  <div className="relative">
                    <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input
                      id="proofUrl"
                      className="input pl-10"
                      placeholder="https://github.com/you/project"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Optional, but proof tasks add 10 points to your preparation score and show up in your Document Wallet as proof of work.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* what comes next */}
          {m.whatComesNext && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <ArrowRightCircle size={12} /> What comes next
              </p>
              <div className="rounded-xl border border-cyan-400/22 bg-cyan-400/[0.06] px-4 py-3">
                <p className="text-[13px] text-cyan-100/85 leading-relaxed">{m.whatComesNext}</p>
                {data.nextMilestone && (
                  <p className="text-[12px] text-cyan-200 font-semibold mt-2">
                    → Next milestone: {data.nextMilestone.title}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* related opportunities */}
          {data.relatedOpportunities?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Briefcase size={12} /> Where this pays off
              </p>
              <div className="space-y-2">
                {data.relatedOpportunities.map((o) => (
                  <Link
                    key={o._id}
                    to={`/opportunities/${o._id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 hover:border-orbit-cyan/30 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">{o.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{o.company}</p>
                    </div>
                    <Badge tone="cyan">{o.type}</Badge>
                  </Link>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                These drives ask for the exact skills this milestone teaches.
              </p>
            </div>
          )}

          {/* topic tags */}
          {m.topicTags?.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Target size={12} /> Topics covered
              </p>
              <div className="flex flex-wrap gap-1.5">
                {m.topicTags.map((t) => (
                  <span key={t} className="chip-cyan">{t}</span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <AlertCircle size={11} className="shrink-0 mt-0.5" />
                If you switch paths later, milestones covering these exact topics are marked complete automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
