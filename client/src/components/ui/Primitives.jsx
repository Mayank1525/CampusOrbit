import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Inbox } from 'lucide-react';
import { classNames } from '../../utils/helpers';

/* ------------------------------------------------------------------ Card */
export const GlassCard = forwardRef(function GlassCard(
  { children, className = '', hover = false, gradient = false, as: Tag = 'div', ...rest },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={classNames(
        gradient ? 'gradient-border' : 'glass',
        hover && 'card-hover',
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/* ----------------------------------------------------------- Motion card */
export function MotionCard({ children, className = '', delay = 0, gradient = false, hover = true, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay }}
      whileHover={hover ? { y: -4, transition: { type: 'spring', stiffness: 400, damping: 22 } } : undefined}
      className={classNames(gradient ? 'gradient-border' : 'glass', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------------------------------------- Badge */
const TONES = {
  violet: 'bg-orbit-violet/15 text-violet-200 border-orbit-violet/30',
  cyan: 'bg-cyan-400/12 text-cyan-200 border-cyan-400/30',
  mint: 'bg-emerald-400/12 text-emerald-200 border-emerald-400/30',
  coral: 'bg-rose-400/12 text-rose-200 border-rose-400/30',
  amber: 'bg-amber-400/12 text-amber-200 border-amber-400/30',
  slate: 'bg-white/[0.06] text-slate-300 border-white/12',
  blue: 'bg-blue-400/12 text-blue-200 border-blue-400/30',
  pink: 'bg-pink-400/12 text-pink-200 border-pink-400/30',
};

export function Badge({ children, tone = 'slate', className = '', icon: Icon, ...rest }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
        TONES[tone] || TONES.slate,
        className
      )}
      {...rest}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Spinner */
export function Spinner({ size = 20, className = '' }) {
  return <Loader2 size={size} className={classNames('animate-spin', className)} />;
}

export function LoadingScreen({ label = 'Loading your orbit…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5" role="status" aria-live="polite">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-orbit-violet/25" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-orbit-violet border-r-orbit-cyan"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[26%] rounded-full bg-gradient-to-br from-orbit-violet to-orbit-cyan"
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

/* --------------------------------------------------------- Empty state */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }) {
  return (
    <div className={classNames('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orbit-violet/18 to-orbit-cyan/12 border border-white/10 flex items-center justify-center mb-4">
        <Icon size={26} className="text-orbit-violet" />
      </div>
      <h3 className="text-base font-semibold text-slate-100 mb-1.5">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Skeleton */
export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={classNames('skeleton', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="glass p-5 space-y-3">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Progress bar */
export function ProgressBar({ value = 0, tone = 'violet', className = '', showLabel = false, height = 'h-2' }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const grad = {
    violet: 'from-orbit-violet to-orbit-indigo',
    cyan: 'from-orbit-cyan to-blue-400',
    mint: 'from-emerald-400 to-teal-300',
    coral: 'from-rose-400 to-orange-300',
    amber: 'from-amber-400 to-yellow-300',
  }[tone];

  return (
    <div className={className}>
      <div className={classNames('w-full rounded-full bg-white/[0.07] overflow-hidden', height)}>
        <motion.div
          className={classNames('h-full rounded-full bg-gradient-to-r', grad)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && <p className="text-[11px] text-slate-400 mt-1 text-right tabular-nums">{pct}%</p>}
    </div>
  );
}

/* -------------------------------------------------------- Progress ring */
export function ProgressRing({ value = 0, size = 92, stroke = 7, tone = 'violet', label, sublabel }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const colors = {
    violet: ['#7c5cff', '#22d3ee'],
    cyan: ['#22d3ee', '#3b82f6'],
    mint: ['#34d399', '#10b981'],
    coral: ['#fb7185', '#f97316'],
    amber: ['#fbbf24', '#f59e0b'],
  }[tone] || ['#7c5cff', '#22d3ee'];
  const gid = `ring-${tone}-${size}`;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (pct / 100) * c }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${colors[0]}70)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white tabular-nums leading-none font-display">
          {label ?? `${Math.round(pct)}%`}
        </span>
        {sublabel && <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">{sublabel}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Stat card */
export function StatCard({ icon: Icon, label, value, sub, tone = 'violet', delay = 0, onClick }) {
  const glow = {
    violet: 'from-orbit-violet/18 to-transparent',
    cyan: 'from-cyan-400/18 to-transparent',
    mint: 'from-emerald-400/18 to-transparent',
    coral: 'from-rose-400/18 to-transparent',
    amber: 'from-amber-400/18 to-transparent',
  }[tone];
  const iconTone = {
    violet: 'text-orbit-violet bg-orbit-violet/12',
    cyan: 'text-cyan-300 bg-cyan-400/12',
    mint: 'text-emerald-300 bg-emerald-400/12',
    coral: 'text-rose-300 bg-rose-400/12',
    amber: 'text-amber-300 bg-amber-400/12',
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      onClick={onClick}
      className={classNames(
        'glass relative overflow-hidden p-4 sm:p-5 group',
        onClick && 'cursor-pointer'
      )}
    >
      <div className={classNames('absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-br blur-2xl opacity-70 transition-opacity group-hover:opacity-100', glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-white mt-1.5 font-display tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1 truncate">{sub}</p>}
        </div>
        {Icon && (
          <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', iconTone)}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------- Sections */
export function SectionHeader({ title, subtitle, icon: Icon, action, className = '' }) {
  return (
    <div className={classNames('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orbit-violet/20 to-orbit-cyan/12 border border-white/10 flex items-center justify-center shrink-0">
            <Icon size={17} className="text-orbit-violet" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white font-display">{title}</h2>
          {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon: Icon, action, badge }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex items-start justify-between gap-4 flex-wrap mb-6"
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orbit-violet/25 to-orbit-cyan/15 border border-white/10 flex items-center justify-center shrink-0 shadow-glow">
            <Icon size={21} className="text-orbit-violet" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 flex-wrap">{action}</div>}
    </motion.div>
  );
}

/* ----------------------------------------------------------------- Tabs */
export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={classNames('flex gap-1 p-1 rounded-xl bg-space-900/70 border border-white/[0.07] overflow-x-auto hide-scrollbar', className)} role="tablist">
      {tabs.map((t) => {
        const key = t.key ?? t;
        const label = t.label ?? t;
        const isActive = active === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={classNames(
              'relative px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2',
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`tab-pill-${tabs.map((x) => x.key ?? x).join('')}`}
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-orbit-violet/28 to-orbit-cyan/18 border border-orbit-violet/35"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {t.icon && <t.icon size={14} />}
              {label}
              {t.count != null && (
                <span className={classNames(
                  'text-[10px] px-1.5 py-0.5 rounded-full tabular-nums',
                  isActive ? 'bg-white/15 text-white' : 'bg-white/[0.07] text-slate-400'
                )}>
                  {t.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- Toggle */
export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={classNames('flex items-start gap-3 cursor-pointer group', disabled && 'opacity-50 cursor-not-allowed')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={classNames(
          'relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5',
          checked ? 'bg-gradient-to-r from-orbit-violet to-orbit-cyan' : 'bg-white/12'
        )}
      >
        <motion.span
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow"
          animate={{ left: checked ? 21 : 3 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-slate-200 font-medium">{label}</span>}
          {description && <span className="block text-xs text-slate-400 mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  );
}

/* --------------------------------------------------------------- Avatar */
export function Avatar({ name = '?', color = '#7c5cff', size = 36, src, className = '' }) {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={classNames('rounded-full object-cover border border-white/12', className)}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}88)`,
        fontSize: size * 0.36,
      }}
      className={classNames(
        'rounded-full flex items-center justify-center font-bold text-white shrink-0 border border-white/12 select-none',
        className
      )}
      title={name}
    >
      {letters || '?'}
    </div>
  );
}

/* --------------------------------------------------------- Info callout */
export function Callout({ children, tone = 'cyan', icon: Icon, title, className = '' }) {
  const tones = {
    cyan: 'border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-100',
    violet: 'border-orbit-violet/25 bg-orbit-violet/[0.07] text-violet-100',
    amber: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-100',
    coral: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-100',
    mint: 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100',
  };
  return (
    <div className={classNames('rounded-xl border px-4 py-3 text-sm leading-relaxed', tones[tone], className)}>
      <div className="flex gap-2.5">
        {Icon && <Icon size={16} className="shrink-0 mt-0.5 opacity-90" />}
        <div className="min-w-0 flex-1">
          {title && <p className="font-semibold mb-1">{title}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
