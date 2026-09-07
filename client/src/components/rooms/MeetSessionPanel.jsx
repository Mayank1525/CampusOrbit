import { useState, useEffect, useMemo, useRef, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Calendar, Clock, Users, Plus, ExternalLink, Radio, Check, X,
  HelpCircle, Link2, ShieldCheck, Sparkles, ChevronDown, Trash2,
  PlayCircle, StopCircle, FileText, CalendarPlus, Copy, AlertTriangle,
} from 'lucide-react';
import { roomAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/Primitives';

/* ────────────────────────────── helpers ────────────────────────────── */

export const TYPE_META = {
  'mock-interview': { label: 'Mock Interview', icon: Users, tone: 'violet' },
  'doubt-clearing': { label: 'Doubt Clearing', icon: HelpCircle, tone: 'cyan' },
  'guest-talk': { label: 'Guest Talk', icon: Sparkles, tone: 'amber' },
  'resume-review': { label: 'Resume Review', icon: FileText, tone: 'mint' },
  'group-study': { label: 'Group Study', icon: Users, tone: 'slate' },
  other: { label: 'Session', icon: Video, tone: 'slate' },
};

export const TONE = {
  violet: { chip: 'bg-orbit-violet/12 text-orbit-violet border-orbit-violet/25', dot: 'bg-orbit-violet' },
  cyan: { chip: 'bg-orbit-cyan/12 text-orbit-cyan border-orbit-cyan/25', dot: 'bg-orbit-cyan' },
  amber: { chip: 'bg-amber-400/12 text-amber-300 border-amber-400/25', dot: 'bg-amber-400' },
  mint: { chip: 'bg-emerald-400/12 text-emerald-300 border-emerald-400/25', dot: 'bg-emerald-400' },
  slate: { chip: 'bg-white/6 text-slate-300 border-white/12', dot: 'bg-slate-400' },
};

export function fmtDate(d) {
  return new Date(d).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(target).getTime() - now;
  const abs = Math.abs(diff);
  return {
    diff,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
  };
}

/** Google Calendar "add event" URL — a genuine convenience, not a fake button. */
export function gcalUrl(s) {
  const start = new Date(s.scheduledAt);
  const end = new Date(start.getTime() + (s.durationMinutes || 60) * 60000);
  const z = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.title,
    dates: `${z(start)}/${z(end)}`,
    details: `${s.description || ''}\n\nHosted on CampusOrbit by ${s.hostId?.fullName || 'a mentor'}.`,
    location: 'Google Meet',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/* ───────────────────────── live countdown pill ─────────────────────── */

export function CountdownPill({ session }) {
  const c = useCountdown(session.scheduledAt);
  if (session.state === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-400/35 text-rose-200 text-[11px] font-bold tracking-wide">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
        </span>
        LIVE NOW
      </span>
    );
  }
  if (session.state === 'ended') {
    return <span className="chip-slate text-[11px]">Ended</span>;
  }
  if (session.state === 'cancelled') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-400/25 text-rose-300/80 text-[11px] font-semibold line-through">Cancelled</span>;
  }
  const parts = c.days > 0
    ? `${c.days}d ${c.hours}h`
    : c.hours > 0
      ? `${c.hours}h ${c.minutes}m`
      : `${c.minutes}m ${String(c.seconds).padStart(2, '0')}s`;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/12 text-slate-300 text-[11px] font-semibold tabular-nums">
      <Clock size={11} /> starts in {parts}
    </span>
  );
}

/* ──────────────────────────── session card ─────────────────────────── */

export const SessionCard = forwardRef(function SessionCard({ session, onChanged, defaultOpen = false }, ref) {
  const toast = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState('');
  const [attendance, setAttendance] = useState(null);
  const meta = TYPE_META[session.sessionType] || TYPE_META.other;
  const tone = TONE[meta.tone];
  const Icon = meta.icon;

  const isLive = session.state === 'live';
  const isOver = session.state === 'ended' || session.state === 'cancelled';

  const rsvp = async (status) => {
    setBusy(status);
    try {
      await roomAPI.meetRsvp(session._id, status);
      toast.success(
        status === 'going' ? "You're in — link unlocks when it goes live"
          : status === 'maybe' ? 'Marked as maybe' : 'Removed your RSVP'
      );
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const join = async () => {
    setBusy('join');
    try {
      const data = await roomAPI.meetJoin(session._id);
      // Open Google Meet in a new tab; attendance is already recorded server-side.
      window.open(data.meetLink, '_blank', 'noopener,noreferrer');
      toast.success('Opening Google Meet…');
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const hostAction = async (fn, label) => {
    setBusy(label);
    try {
      await fn();
      toast.success(label === 'start' ? 'Session is live' : label === 'end' ? 'Session ended' : 'Cancelled');
      onChanged?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const loadAttendance = async () => {
    try {
      setAttendance(await roomAPI.meetAttendance(session._id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copyLink = async () => {
    if (!session.meetLink) return;
    try {
      await navigator.clipboard.writeText(session.meetLink);
      toast.success('Meet link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
        isLive
          ? 'border-rose-400/40 bg-gradient-to-br from-rose-500/[0.10] via-white/[0.03] to-transparent shadow-[0_0_36px_-12px_rgba(244,63,94,0.45)]'
          : isOver
            ? 'border-white/8 bg-white/[0.02] opacity-80'
            : 'border-white/12 bg-white/[0.035] hover:border-white/22 hover:bg-white/[0.05]'
      }`}
    >
      {isLive && (
        <motion.div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <motion.div
            whileHover={{ scale: 1.06, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${tone.chip}`}
          >
            <Icon size={19} />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${tone.chip}`}>
                {meta.label}
              </span>
              <CountdownPill session={session} />
            </div>

            <h4 className={`font-bold text-[15px] leading-snug mb-1 ${isOver ? 'text-slate-400' : 'text-white'}`}>
              {session.title}
            </h4>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ background: session.hostId?.avatarColor || '#7c5cff' }}
                >
                  {(session.hostId?.fullName || '?')[0]}
                </span>
                {session.hostId?.fullName}
                <span className={`text-[10px] px-1.5 py-px rounded border ${
                  session.hostId?.role === 'admin'
                    ? 'border-rose-400/30 text-rose-300 bg-rose-400/10'
                    : 'border-amber-400/30 text-amber-300 bg-amber-400/10'
                }`}>
                  {session.hostId?.role === 'admin' ? 'Placement Cell' : 'Alumni'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1"><Calendar size={11} /> {fmtDate(session.scheduledAt)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={11} /> {session.durationMinutes}m</span>
              <span className="inline-flex items-center gap-1">
                <Users size={11} /> {session.goingCount} going
                {session.maxSeats > 0 && (
                  <span className={session.seatsLeft === 0 ? 'text-rose-300' : 'text-slate-500'}>
                    {' '}· {session.seatsLeft === 0 ? 'full' : `${session.seatsLeft} left`}
                  </span>
                )}
              </span>
            </div>
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
          >
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="block">
              <ChevronDown size={16} />
            </motion.span>
          </button>
        </div>

        {/* seat capacity bar */}
        {session.maxSeats > 0 && !isOver && (
          <div className="mt-3 h-1 rounded-full bg-white/6 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${session.seatsLeft === 0 ? 'bg-rose-400' : 'bg-gradient-to-r from-orbit-violet to-orbit-cyan'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (session.goingCount / session.maxSeats) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </div>
        )}

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-white/8 space-y-3.5">
                {session.description && (
                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {session.description}
                  </p>
                )}

                {session.recapNotes && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3.5">
                    <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1.5">
                      Session recap
                    </p>
                    <p className="text-[13px] text-emerald-100/80 leading-relaxed whitespace-pre-wrap">
                      {session.recapNotes}
                    </p>
                  </div>
                )}

                {/* Honest note about what CampusOrbit does and does not do. */}
                <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
                  <ShieldCheck size={13} className="shrink-0 mt-px text-slate-600" />
                  <span>
                    The call runs on <strong className="text-slate-400">Google Meet</strong>, not inside
                    CampusOrbit. {session.linkHiddenReason
                      ? `${session.linkHiddenReason}.`
                      : 'Your attendance is recorded when you join.'}
                  </span>
                </div>

                {/* ---------------- actions ---------------- */}
                {!isOver && (
                  <div className="flex flex-wrap items-center gap-2">
                    {session.canJoinNow ? (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={join}
                        disabled={busy === 'join'}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white text-[13px] font-bold shadow-lg shadow-rose-500/25 disabled:opacity-60"
                      >
                        {busy === 'join' ? <Spinner size={14} /> : <Video size={15} />}
                        Join Google Meet
                        <ExternalLink size={12} className="opacity-70" />
                      </motion.button>
                    ) : (
                      <>
                        {session.myRsvp !== 'going' && (
                          <button
                            onClick={() => rsvp('going')}
                            disabled={Boolean(busy) || (session.maxSeats > 0 && session.seatsLeft === 0)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orbit-violet/15 border border-orbit-violet/35 text-orbit-violet text-[13px] font-semibold hover:bg-orbit-violet/25 transition-colors disabled:opacity-40"
                          >
                            {busy === 'going' ? <Spinner size={13} /> : <Check size={14} />}
                            {session.maxSeats > 0 && session.seatsLeft === 0 ? 'Session full' : "I'll attend"}
                          </button>
                        )}
                        {session.myRsvp === 'going' && (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400/12 border border-emerald-400/30 text-emerald-300 text-[13px] font-semibold">
                            <Check size={14} /> You&apos;re attending
                          </span>
                        )}
                        {session.myRsvp !== 'maybe' && session.myRsvp !== 'going' && (
                          <button
                            onClick={() => rsvp('maybe')}
                            disabled={Boolean(busy)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/12 text-slate-300 text-[13px] hover:border-white/25 hover:text-white transition-colors disabled:opacity-40"
                          >
                            {busy === 'maybe' ? <Spinner size={13} /> : <HelpCircle size={14} />} Maybe
                          </button>
                        )}
                        {session.myRsvp && (
                          <button
                            onClick={() => rsvp('not-going')}
                            disabled={Boolean(busy)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-slate-400 text-[13px] hover:border-rose-400/30 hover:text-rose-300 transition-colors disabled:opacity-40"
                          >
                            {busy === 'not-going' ? <Spinner size={13} /> : <X size={14} />} Can&apos;t make it
                          </button>
                        )}
                      </>
                    )}

                    <a
                      href={gcalUrl(session)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-slate-400 text-[13px] hover:border-white/25 hover:text-white transition-colors"
                    >
                      <CalendarPlus size={14} /> Add to Calendar
                    </a>

                    {session.meetLink && (
                      <button
                        onClick={copyLink}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-slate-400 text-[13px] hover:border-white/25 hover:text-white transition-colors"
                      >
                        <Copy size={14} /> Copy link
                      </button>
                    )}
                  </div>
                )}

                {/* ---------------- host controls ---------------- */}
                {(session.isHost || user?.role === 'admin') && (
                  <div className="pt-3 mt-1 border-t border-white/8">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Host controls
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {session.state !== 'live' && !isOver && (
                        <button
                          onClick={() => hostAction(() => roomAPI.meetStart(session._id), 'start')}
                          disabled={Boolean(busy)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-400/12 border border-emerald-400/30 text-emerald-300 text-[12px] font-semibold hover:bg-emerald-400/20 transition-colors"
                        >
                          <PlayCircle size={13} /> Go live
                        </button>
                      )}
                      {session.state === 'live' && (
                        <button
                          onClick={() => hostAction(() => roomAPI.meetEnd(session._id), 'end')}
                          disabled={Boolean(busy)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/6 border border-white/12 text-slate-300 text-[12px] font-semibold hover:border-white/25 transition-colors"
                        >
                          <StopCircle size={13} /> End session
                        </button>
                      )}
                      <button
                        onClick={loadAttendance}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 text-slate-400 text-[12px] hover:text-white hover:border-white/25 transition-colors"
                      >
                        <Users size={13} /> Attendance
                      </button>
                      {!isOver && (
                        <button
                          onClick={() => hostAction(() => roomAPI.meetCancel(session._id), 'cancel')}
                          disabled={Boolean(busy)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-500 text-[12px] hover:border-rose-400/30 hover:text-rose-300 transition-colors"
                        >
                          <Trash2 size={13} /> Cancel
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {attendance && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                            <div className="flex items-center gap-4 mb-2.5 text-[11px]">
                              <span className="text-slate-400">Invited <strong className="text-white">{attendance.totals.invited}</strong></span>
                              <span className="text-slate-400">Going <strong className="text-orbit-cyan">{attendance.totals.going}</strong></span>
                              <span className="text-slate-400">Attended <strong className="text-emerald-300">{attendance.totals.attended}</strong></span>
                            </div>
                            <div className="space-y-1 max-h-44 overflow-y-auto">
                              {attendance.rows.map((r) => (
                                <div key={String(r.userId)} className="flex items-center justify-between gap-2 text-[12px] py-1">
                                  <span className="text-slate-300 truncate">
                                    {r.fullName}
                                    {r.branch && <span className="text-slate-600"> · {r.branch}</span>}
                                  </span>
                                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                                    r.attended
                                      ? 'border-emerald-400/30 text-emerald-300 bg-emerald-400/10'
                                      : r.status === 'going'
                                        ? 'border-white/12 text-slate-400'
                                        : 'border-white/8 text-slate-600'
                                  }`}>
                                    {r.attended ? 'attended' : r.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

/* ─────────────────────────── schedule form ─────────────────────────── */

export function ScheduleForm({ roomId, rooms, onDone, onCancel }) {
  const toast = useToast();
  // When `rooms` is supplied the host picks a room here (standalone section);
  // otherwise the room is fixed by the panel it is embedded in.
  const [form, setForm] = useState({
    title: '', description: '', topic: '', sessionType: 'mock-interview',
    meetLink: '', scheduledAt: '', durationMinutes: 60, maxSeats: 0,
    roomId: roomId || (rooms?.[0]?._id ?? ''),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const savingRef = useRef(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Local preview of link validity so the user isn't surprised on submit.
  const linkState = useMemo(() => {
    const v = form.meetLink.trim();
    if (!v) return null;
    const ok = /^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i.test(v)
      || /^(https?:\/\/)?(www\.)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3}|lookup\/.+)/i.test(v)
      || /^(https?:\/\/)?(www\.)?g\.co\/meet\/.+/i.test(v);
    return ok ? 'ok' : 'bad';
  }, [form.meetLink]);

  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErr('');
    try {
      const targetRoom = roomId || form.roomId;
      if (!targetRoom) throw new Error('Pick a room for this session');
      await roomAPI.meetCreate(targetRoom, {
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        durationMinutes: Number(form.durationMinutes),
        maxSeats: Number(form.maxSeats),
      });
      toast.success('Session scheduled — room members notified');
      onDone?.();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-orbit-violet/25 bg-orbit-violet/[0.05] p-4 sm:p-5 space-y-3.5 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Video size={16} className="text-orbit-violet" />
          <h4 className="font-bold text-white text-sm">Host a Google Meet session</h4>
        </div>

        {err && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200 flex items-start gap-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {err}
          </div>
        )}

        {rooms && rooms.length > 0 && (
          <div>
            <label className="label" htmlFor="m-room">Which room?</label>
            <select id="m-room" required className="input" value={form.roomId} onChange={set('roomId')}>
              {rooms.map((r) => (
                <option key={r._id} value={r._id} className="bg-slate-900">{r.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Members of that room get a notification when you schedule this.
            </p>
          </div>
        )}

        <div>
          <label className="label" htmlFor="m-title">Title</label>
          <input
            id="m-title" required minLength={4} className="input" value={form.title} onChange={set('title')}
            placeholder="Mock Interview: DSA round with an SDE-2"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-type">Session type</label>
            <select id="m-type" className="input" value={form.sessionType} onChange={set('sessionType')}>
              {Object.entries(TYPE_META).map(([v, m]) => (
                <option key={v} value={v} className="bg-slate-900">{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="m-topic">Topic (optional)</label>
            <input id="m-topic" className="input" value={form.topic} onChange={set('topic')} placeholder="Arrays & Strings" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="m-desc">What will you cover?</label>
          <textarea
            id="m-desc" rows={3} className="input resize-none" value={form.description} onChange={set('description')}
            placeholder="Bring your resume. We go line by line…"
          />
        </div>

        <div>
          <label className="label" htmlFor="m-link">Google Meet link</label>
          <div className="relative">
            <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="m-link" required className={`input pl-10 pr-10 ${
                linkState === 'bad' ? 'border-rose-400/50' : linkState === 'ok' ? 'border-emerald-400/40' : ''
              }`}
              value={form.meetLink} onChange={set('meetLink')}
              placeholder="https://meet.google.com/abc-defg-hij"
            />
            {linkState && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                {linkState === 'ok'
                  ? <Check size={15} className="text-emerald-400" />
                  : <X size={15} className="text-rose-400" />}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
            Create the meeting at{' '}
            <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer" className="text-orbit-cyan hover:underline">
              meet.google.com/new
            </a>{' '}
            and paste the link here. CampusOrbit only shares and schedules it.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="m-when">Date & time</label>
            <input
              id="m-when" type="datetime-local" required min={minDateTime}
              className="input [color-scheme:dark]" value={form.scheduledAt} onChange={set('scheduledAt')}
            />
          </div>
          <div>
            <label className="label" htmlFor="m-dur">Minutes</label>
            <input id="m-dur" type="number" min={5} max={480} className="input" value={form.durationMinutes} onChange={set('durationMinutes')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="m-seats">Seat limit (0 = unlimited)</label>
          <input id="m-seats" type="number" min={0} max={1000} className="input" value={form.maxSeats} onChange={set('maxSeats')} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={saving || linkState === 'bad'} className="btn-primary px-5 py-2.5 text-[13px] disabled:opacity-50">
            {saving ? <><Spinner size={14} /> Scheduling…</> : <><Plus size={15} /> Schedule session</>}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost px-4 py-2.5 text-[13px]">Cancel</button>
        </div>
      </div>
    </motion.form>
  );
}

/* ──────────────────────────── main panel ───────────────────────────── */

export default function MeetSessionPanel({ roomId, socket }) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const canHost = user && ['senior', 'admin'].includes(user.role);

  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await roomAPI.meetList(roomId);
      setSessions(data.sessions || []);
    } catch {
      /* room may not be loaded yet */
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { load(); }, [load]);

  // Live updates when anyone schedules / RSVPs / starts a session.
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('meet-session-created', refresh);
    socket.on('meet-session-updated', refresh);
    socket.on('meet-rsvp-updated', refresh);
    return () => {
      socket.off('meet-session-created', refresh);
      socket.off('meet-session-updated', refresh);
      socket.off('meet-rsvp-updated', refresh);
    };
  }, [socket, load]);

  // Re-evaluate live/ended state on a timer without hammering the API.
  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const u = [], p = [];
    for (const s of sessions) {
      (s.state === 'ended' || s.state === 'cancelled' ? p : u).push(s);
    }
    u.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    return { upcoming: u, past: p };
  }, [sessions]);

  const liveCount = upcoming.filter((s) => s.state === 'live').length;
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <Video size={17} className="text-orbit-violet" />
            {liveCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
              </span>
            )}
          </div>
          <h3 className="font-bold text-white text-[15px] font-display truncate">Live Sessions</h3>
          {liveCount > 0 && (
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/35 text-rose-200">
              {liveCount} live
            </span>
          )}
        </div>

        {canHost && !showForm && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowForm(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orbit-violet/15 border border-orbit-violet/35 text-orbit-violet text-[12px] font-semibold hover:bg-orbit-violet/25 transition-colors"
          >
            <Plus size={14} /> Host
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <ScheduleForm
            roomId={roomId}
            onDone={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* tabs */}
      <div className="flex items-center gap-1 mb-3.5 p-1 rounded-xl bg-black/25 border border-white/8 w-fit">
        {[['upcoming', 'Upcoming', upcoming.length], ['past', 'Past', past.length]].map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              tab === k ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab === k && (
              <motion.span
                layoutId="meet-tab"
                className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/10"
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              />
            )}
            <span className="relative">{label} {n > 0 && <span className="opacity-60">({n})</span>}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner size={20} /></div>
      ) : shown.length === 0 ? (
        <div className="py-8 text-center">
          <Radio size={26} className="mx-auto text-slate-700 mb-2.5" />
          <p className="text-[13px] text-slate-400 font-medium mb-1">
            {tab === 'upcoming' ? 'No sessions scheduled yet' : 'No past sessions'}
          </p>
          <p className="text-[12px] text-slate-600 max-w-xs mx-auto leading-relaxed">
            {tab === 'upcoming'
              ? canHost
                ? 'Host one and every member of this room gets notified.'
                : 'Alumni and the placement cell can host live Google Meet sessions here.'
              : 'Sessions appear here once they finish.'}
          </p>
        </div>
      ) : (
        <motion.div layout className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {shown.map((s, i) => (
              <SessionCard key={s._id} session={s} onChanged={load} defaultOpen={i === 0 && s.state === 'live'} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
