import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, MapPin, Calendar, IndianRupee, Building2, Bookmark, CheckCircle2,
  XCircle, Send, FileText, ExternalLink, Users, ListChecks, Layers, AlertTriangle,
  Briefcase, Clock, Target, ShieldCheck, Info, Upload, ArrowRight, TrendingUp,
} from 'lucide-react';
import { opportunityAPI, applicationAPI, resumeAPI, documentAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, ProgressBar,
  Spinner, Callout, SectionHeader, ProgressRing,
} from '../components/ui/Primitives';
import Modal from '../components/ui/Modal';
import { formatDate, deadlineLabel, STAGE_COLORS } from '../utils/helpers';

export default function OpportunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState({ resumeId: '', coverNote: '', github: '', portfolio: '' });

  const load = async () => {
    try {
      const d = await opportunityAPI.get(id);
      setData(d);
      const r = await resumeAPI.list();
      setResumes(r.resumes || []);
      const def = (r.resumes || []).find((x) => x.isDefault) || (r.resumes || [])[0];
      setForm((f) => ({ ...f, resumeId: d.application?.resumeId || def?._id || '' }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const apply = async (stage = 'Applied') => {
    setApplying(true);
    try {
      await applicationAPI.apply({
        opportunityId: id,
        resumeId: form.resumeId || undefined,
        coverNote: form.coverNote,
        attachedLinks: { github: form.github, portfolio: form.portfolio },
        stage,
      });
      toast.success(
        stage === 'Saved'
          ? 'Saved to your pipeline. Move it to Applied when you are ready.'
          : 'Application submitted. Track it in My Applications.'
      );
      setApplyOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setApplying(false);
    }
  };

  const toggleBookmark = async () => {
    try {
      const d = await opportunityAPI.toggleBookmark(id);
      toast.success(d.bookmarked ? 'Bookmarked' : 'Bookmark removed');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading opportunity…" />;
  if (!data) return <EmptyState title="Opportunity not found" description="It may have been removed or unpublished." />;

  const { opportunity: o, eligibilityResult, checklist, application, match, applicantCount } = data;
  const dl = deadlineLabel(o.deadline);
  const eligible = eligibilityResult?.eligible;
  const checklistDone = checklist?.filter((c) => c.satisfied).length || 0;
  const closed = new Date(o.deadline) < new Date();

  return (
    <div className="space-y-5 max-w-[1400px]">
      <button onClick={() => navigate('/opportunities')} className="btn-ghost btn-sm -ml-2">
        <ArrowLeft size={14} /> Placement Hub
      </button>

      {/* hero */}
      <MotionCard hover={false} gradient className="p-6 relative overflow-hidden">
        <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-orbit-violet/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-5 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orbit-violet/25 to-orbit-cyan/15 border border-white/12 flex items-center justify-center shrink-0 text-2xl font-bold text-white">
              {o.companyLogoText || o.company?.[0] || <Building2 size={26} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge tone="violet">{o.type}</Badge>
                {o.workMode && <Badge tone="slate">{o.workMode}</Badge>}
                <Badge tone={dl.tone} icon={Clock}>{dl.text}</Badge>
                {application && <Badge tone={STAGE_COLORS[application.stage] || 'cyan'}>{application.stage}</Badge>}
                {o.status === 'draft' && <Badge tone="coral">Draft (admin preview)</Badge>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">{o.title}</h1>
              <p className="text-[15px] text-slate-300 mt-1">{o.company}{o.role ? ` · ${o.role}` : ''}</p>
              <div className="flex items-center gap-4 mt-3 flex-wrap text-[13px] text-slate-400">
                <span className="flex items-center gap-1.5"><MapPin size={13} /> {o.location || 'Remote'}</span>
                {o.stipendOrCtc && <span className="flex items-center gap-1.5"><IndianRupee size={13} /> {o.stipendOrCtc}</span>}
                <span className="flex items-center gap-1.5"><Calendar size={13} /> Closes {formatDate(o.deadline)}</span>
                {o.driveDate && <span className="flex items-center gap-1.5"><Briefcase size={13} /> Drive {formatDate(o.driveDate)}</span>}
                <span className="flex items-center gap-1.5"><Users size={13} /> {applicantCount} applicant{applicantCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {match && <ProgressRing value={match.score} size={72} tone={match.score >= 70 ? 'mint' : 'cyan'} sublabel="match" />}
            <div className="flex flex-col gap-2">
              <button
                onClick={toggleBookmark}
                className={o.bookmarked ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              >
                <Bookmark size={14} fill={o.bookmarked ? 'currentColor' : 'none'} />
                {o.bookmarked ? 'Saved' : 'Save'}
              </button>
              {application ? (
                <Link to="/applications" className="btn-secondary btn-sm">
                  <TrendingUp size={14} /> Track it
                </Link>
              ) : (
                <button
                  onClick={() => setApplyOpen(true)}
                  disabled={!eligible || closed}
                  className="btn-primary btn-sm"
                  title={!eligible ? 'You do not meet the eligibility rules' : closed ? 'Deadline has passed' : 'Apply now'}
                >
                  <Send size={14} /> Apply
                </button>
              )}
            </div>
          </div>
        </div>
      </MotionCard>

      <div className="grid lg:grid-cols-[1.45fr_1fr] gap-5 items-start">
        {/* -------------------------------------------------- left column */}
        <div className="space-y-4">
          {o.description && (
            <MotionCard hover={false} className="p-5">
              <SectionHeader icon={FileText} title="About this role" className="mb-3.5" />
              <p className="text-[14px] text-slate-300 leading-relaxed whitespace-pre-line">{o.description}</p>
            </MotionCard>
          )}

          {o.responsibilities?.length > 0 && (
            <MotionCard hover={false} className="p-5" delay={0.05}>
              <SectionHeader icon={ListChecks} title="What you will do" className="mb-3.5" />
              <ul className="space-y-2">
                {o.responsibilities.map((r, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-2.5 text-[13.5px] text-slate-300 leading-relaxed"
                  >
                    <span className="text-orbit-violet mt-1 shrink-0">▸</span>
                    {r}
                  </motion.li>
                ))}
              </ul>
            </MotionCard>
          )}

          {o.skillsRequired?.length > 0 && (
            <MotionCard hover={false} className="p-5" delay={0.08}>
              <SectionHeader icon={Target} title="Skills they are looking for" className="mb-3.5" />
              <div className="flex flex-wrap gap-1.5">
                {o.skillsRequired.map((s) => {
                  const hasSkill = match?.matchedSkills?.some?.(
                    (m) => m.toLowerCase() === s.toLowerCase()
                  );
                  return (
                    <span key={s} className={hasSkill ? 'chip-mint' : 'chip-slate'}>
                      {hasSkill && <CheckCircle2 size={10} />} {s}
                    </span>
                  );
                })}
              </div>
              {match?.reasons?.length > 0 && (
                <div className="mt-3.5 space-y-1">
                  {match.reasons.map((r, i) => (
                    <p key={i} className="text-[12px] text-slate-400 flex gap-2">
                      <Info size={11} className="shrink-0 mt-0.5 text-orbit-cyan" /> {r}
                    </p>
                  ))}
                </div>
              )}
            </MotionCard>
          )}

          {/* selection rounds */}
          {o.rounds?.length > 0 && (
            <MotionCard hover={false} className="p-5" delay={0.11}>
              <SectionHeader icon={Layers} title="Selection process" subtitle={`${o.rounds.length} rounds`} className="mb-4" />
              <div className="relative pl-6 space-y-3.5">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-orbit-violet/50 to-white/[0.06]" />
                {o.rounds
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((r, i) => (
                    <motion.div
                      key={r.name}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="relative"
                    >
                      <span className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-orbit-violet border-2 border-space-950 shadow-glow" />
                      <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                        <p className="text-[13.5px] font-semibold text-slate-100">
                          Round {r.order}: {r.name}
                        </p>
                        {r.description && (
                          <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{r.description}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
              </div>
            </MotionCard>
          )}

          {o.officialLink && (
            <MotionCard hover={false} className="p-5" delay={0.14}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[13.5px] font-semibold text-slate-100">Official posting</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Company page for this role</p>
                </div>
                <a href={o.officialLink} target="_blank" rel="noreferrer noopener" className="btn-secondary btn-sm">
                  <ExternalLink size={13} /> Open link
                </a>
              </div>
            </MotionCard>
          )}
        </div>

        {/* ------------------------------------------------- right column */}
        <div className="space-y-4 lg:sticky lg:top-20">
          {/* eligibility */}
          <MotionCard hover={false} className="p-5">
            <SectionHeader
              icon={ShieldCheck}
              title="Eligibility"
              subtitle="Every rule, checked against your profile"
              className="mb-4"
            />

            <div
              className={`rounded-xl border px-4 py-3 mb-4 ${
                eligible
                  ? 'border-emerald-400/28 bg-emerald-400/[0.07]'
                  : 'border-rose-400/28 bg-rose-400/[0.07]'
              }`}
            >
              <p className={`text-[13.5px] font-bold flex items-center gap-2 ${eligible ? 'text-emerald-200' : 'text-rose-200'}`}>
                {eligible ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {eligible ? 'You are eligible to apply' : 'You are not eligible yet'}
              </p>
              {!eligible && eligibilityResult?.reasons?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eligibilityResult.reasons.map((r, i) => (
                    <li key={i} className="text-[12px] text-rose-100/80 leading-relaxed">• {r}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              {eligibilityResult?.checks?.length === 0 && (
                <p className="text-[12px] text-slate-500">This drive has no restrictions — anyone can apply.</p>
              )}
              {eligibilityResult?.checks?.map((c) => (
                <div
                  key={c.rule}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border ${
                    c.pass ? 'border-emerald-400/18 bg-emerald-400/[0.045]' : 'border-rose-400/18 bg-rose-400/[0.045]'
                  }`}
                >
                  {c.pass ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-slate-200">{c.rule}</p>
                    <p className="text-[11.5px] text-slate-400 leading-snug mt-0.5">{c.message}</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Required: {c.required} · Yours: {c.yours}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {!eligible && (
              <Link to="/profile" className="btn-secondary btn-sm w-full mt-3.5">
                Update my profile <ArrowRight size={13} />
              </Link>
            )}
          </MotionCard>

          {/* document checklist */}
          {checklist?.length > 0 && (
            <MotionCard hover={false} className="p-5" delay={0.06}>
              <SectionHeader
                icon={ListChecks}
                title="Document checklist"
                subtitle={`${checklistDone} of ${checklist.length} ready`}
                className="mb-3.5"
              />
              <ProgressBar
                value={(checklistDone / checklist.length) * 100}
                tone={checklistDone === checklist.length ? 'mint' : 'amber'}
                className="mb-3.5"
              />
              <div className="space-y-1.5">
                {checklist.map((c) => (
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
              {checklistDone < checklist.length && (
                <div className="flex gap-2 mt-3.5">
                  <Link to="/documents" className="btn-secondary btn-sm flex-1">
                    <Upload size={13} /> Wallet
                  </Link>
                  <Link to="/resume-studio" className="btn-secondary btn-sm flex-1">
                    <FileText size={13} /> Resume
                  </Link>
                </div>
              )}
            </MotionCard>
          )}

          {/* apply CTA */}
          <MotionCard hover={false} className="p-5" delay={0.1}>
            {application ? (
              <div>
                <p className="text-[13.5px] font-bold text-white mb-1.5">You applied to this drive</p>
                <p className="text-[12px] text-slate-400 mb-3.5 leading-relaxed">
                  Current stage: <strong className="text-slate-200">{application.stage}</strong>.
                  Stage moves beyond "Applied" are made by the placement cell.
                </p>
                <Link to="/applications" className="btn-primary btn-sm w-full">
                  <TrendingUp size={14} /> Open my pipeline
                </Link>
              </div>
            ) : closed ? (
              <Callout tone="slate" icon={Clock} title="Applications closed">
                The deadline for this drive passed on {formatDate(o.deadline)}.
              </Callout>
            ) : eligible ? (
              <div>
                <p className="text-[13.5px] font-bold text-white mb-1.5">Ready to apply?</p>
                <p className="text-[12px] text-slate-400 mb-3.5 leading-relaxed">
                  Your default resume is attached automatically. You can pick a different one and add a cover note.
                </p>
                <button onClick={() => setApplyOpen(true)} className="btn-primary w-full">
                  <Send size={15} /> Apply now
                </button>
                <button onClick={() => apply('Saved')} disabled={applying} className="btn-ghost btn-sm w-full mt-2">
                  Save to pipeline instead
                </button>
              </div>
            ) : (
              <Callout tone="coral" icon={AlertTriangle} title="Cannot apply yet">
                Fix the eligibility issues above first. If your profile is out of date, updating it re-runs the
                check instantly.
              </Callout>
            )}
          </MotionCard>
        </div>
      </div>

      {/* ------------------------------------------------- apply modal */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={`Apply to ${o.title}`}
        subtitle={o.company}
        icon={Send}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setApplyOpen(false)} disabled={applying}>Cancel</button>
            <button className="btn-primary" onClick={() => apply('Applied')} disabled={applying || !form.resumeId}>
              {applying ? <><Spinner size={14} /> Submitting…</> : <><Send size={15} /> Submit application</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="resumeSel">Resume to attach</label>
            {resumes.length === 0 ? (
              <Callout tone="amber" icon={AlertTriangle} title="No resume yet">
                You need at least one resume before applying.
                <Link to="/resume-studio" className="block mt-1.5 underline font-semibold">Open Resume Studio →</Link>
              </Callout>
            ) : (
              <select
                id="resumeSel"
                className="input"
                value={form.resumeId}
                onChange={(e) => setForm((f) => ({ ...f, resumeId: e.target.value }))}
              >
                {resumes.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title} — {r.template} {r.isDefault ? '(default)' : ''} · {r.completeness || 0}% complete
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label" htmlFor="cover">Cover note (optional)</label>
            <textarea
              id="cover"
              className="input min-h-[110px] resize-y"
              placeholder="Two or three lines on why you fit this specific role. Reference a project you actually built."
              value={form.coverNote}
              onChange={(e) => setForm((f) => ({ ...f, coverNote: e.target.value }))}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="gh">GitHub (optional)</label>
              <input
                id="gh"
                className="input"
                placeholder="https://github.com/you"
                value={form.github}
                onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="pf">Portfolio (optional)</label>
              <input
                id="pf"
                className="input"
                placeholder="https://you.dev"
                value={form.portfolio}
                onChange={(e) => setForm((f) => ({ ...f, portfolio: e.target.value }))}
              />
            </div>
          </div>

          {checklist && checklistDone < checklist.length && (
            <Callout tone="amber" icon={AlertTriangle} title="Checklist incomplete">
              {checklist.length - checklistDone} required item(s) are still missing:{' '}
              {checklist.filter((c) => !c.satisfied).map((c) => c.label).join(', ')}. You can still apply, but
              the placement cell will see the gap.
            </Callout>
          )}

          <Callout tone="cyan" icon={Info}>
            A snapshot of your eligibility and checklist is stored with the application, so both you and the
            placement cell can see exactly what was true at the moment you applied.
          </Callout>
        </div>
      </Modal>
    </div>
  );
}
