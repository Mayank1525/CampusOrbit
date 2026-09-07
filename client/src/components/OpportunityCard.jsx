import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Briefcase, Bookmark, CheckCircle2, XCircle, IndianRupee,
  ArrowRight, Building2, Zap, GraduationCap, Award, FileText, Clock,
} from 'lucide-react';
import { Badge, ProgressBar } from './ui/Primitives';
import { deadlineLabel, formatDate, STAGE_COLORS } from '../utils/helpers';

const TYPE_META = {
  placement: { label: 'Placement', tone: 'violet', icon: Briefcase },
  internship: { label: 'Internship', tone: 'cyan', icon: GraduationCap },
  hackathon: { label: 'Hackathon', tone: 'coral', icon: Zap },
  scholarship: { label: 'Scholarship', tone: 'amber', icon: Award },
  exam: { label: 'Exam', tone: 'mint', icon: FileText },
};

// forwardRef: framer-motion's AnimatePresence (PopChild) attaches a ref to its
// child to measure it during exit animations. A plain function component cannot
// receive one, which produced a React warning and broke exit measurement.
const OpportunityCard = forwardRef(function OpportunityCard(
  { opportunity: o, onToggleBookmark, index = 0 },
  ref
) {
  const meta = TYPE_META[o.type] || TYPE_META.placement;
  const TypeIcon = meta.icon;
  const dl = deadlineLabel(o.deadline);
  const eligible = o.eligibilityResult?.eligible;
  const failCount = o.eligibilityResult?.checks?.filter((c) => !c.pass).length || 0;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 400, damping: 22 } }}
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all group ${
        o.application
          ? 'border-orbit-cyan/30 bg-gradient-to-br from-cyan-400/[0.06] to-space-900/60'
          : eligible === false
          ? 'border-white/[0.07] bg-white/[0.02] opacity-90'
          : 'border-white/[0.08] bg-white/[0.028] hover:border-orbit-violet/35'
      }`}
    >
      <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-orbit-violet/[0.09] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative">
        {/* header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center shrink-0 text-base font-bold text-white">
              {o.companyLogoText || o.company?.[0] || <Building2 size={19} />}
            </div>
            <div className="min-w-0">
              <Link to={`/opportunities/${o._id}`} className="block">
                <h3 className="text-[15px] font-bold text-white leading-snug hover:text-orbit-violet transition-colors line-clamp-2">
                  {o.title}
                </h3>
              </Link>
              <p className="text-[12px] text-slate-400 truncate mt-0.5">{o.company}</p>
            </div>
          </div>

          {onToggleBookmark && (
            <button
              onClick={() => onToggleBookmark(o)}
              className={`p-2 rounded-lg shrink-0 transition-colors ${
                o.bookmarked
                  ? 'text-amber-400 bg-amber-400/12 border border-amber-400/25'
                  : 'text-slate-500 hover:text-amber-400 hover:bg-white/[0.06] border border-transparent'
              }`}
              aria-label={o.bookmarked ? 'Remove bookmark' : 'Bookmark this opportunity'}
              title={o.bookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark size={15} fill={o.bookmarked ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        {/* tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge tone={meta.tone} icon={TypeIcon}>{meta.label}</Badge>
          {o.workMode && <Badge tone="slate">{o.workMode}</Badge>}
          {o.status === 'draft' && <Badge tone="coral">Draft</Badge>}
          {o.status === 'expired' && <Badge tone="slate">Expired</Badge>}
          {o.application && <Badge tone={STAGE_COLORS[o.application.stage] || 'cyan'}>{o.application.stage}</Badge>}
        </div>

        {/* meta rows */}
        <div className="space-y-1.5 mb-3.5 text-[12px] text-slate-400">
          <p className="flex items-center gap-2 truncate">
            <MapPin size={12} className="shrink-0 text-slate-500" /> {o.location || 'Remote'}
          </p>
          {o.stipendOrCtc && (
            <p className="flex items-center gap-2 truncate">
              <IndianRupee size={12} className="shrink-0 text-slate-500" /> {o.stipendOrCtc}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Calendar size={12} className="shrink-0 text-slate-500" /> Closes {formatDate(o.deadline)}
            <Badge tone={dl.tone} className="ml-auto">{dl.text}</Badge>
          </p>
        </div>

        {/* skills */}
        {o.skillsRequired?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3.5">
            {o.skillsRequired.slice(0, 4).map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.055] text-slate-400 border border-white/10">
                {s}
              </span>
            ))}
            {o.skillsRequired.length > 4 && (
              <span className="text-[10px] text-slate-600 px-1 py-0.5">+{o.skillsRequired.length - 4}</span>
            )}
          </div>
        )}

        {/* eligibility + match */}
        {o.eligibilityResult && (
          <div className="mb-3.5 space-y-2.5">
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11.5px] leading-snug border ${
                eligible
                  ? 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200'
                  : 'border-rose-400/25 bg-rose-400/[0.07] text-rose-200'
              }`}
            >
              {eligible ? (
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
              ) : (
                <XCircle size={13} className="shrink-0 mt-0.5" />
              )}
              <span>
                {eligible
                  ? 'You meet every eligibility rule for this drive.'
                  : o.eligibilityResult.reasons?.[0] ||
                    `You do not meet ${failCount} eligibility rule${failCount === 1 ? '' : 's'}.`}
              </span>
            </div>

            {o.match && (
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>Skill & goal match</span>
                  <span className="tabular-nums font-semibold text-slate-400">{o.match.score}%</span>
                </div>
                <ProgressBar
                  value={o.match.score}
                  tone={o.match.score >= 70 ? 'mint' : o.match.score >= 40 ? 'cyan' : 'amber'}
                  height="h-1"
                />
              </div>
            )}
          </div>
        )}

        <Link
          to={`/opportunities/${o._id}`}
          className="btn-primary btn-sm w-full group/btn"
        >
          {o.application ? 'View application' : 'View & apply'}
          <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      </div>
    </motion.div>
  );
});

export default OpportunityCard;
