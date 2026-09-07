import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Clock, Users, ArrowRight, CalendarDays } from 'lucide-react';
import { roomAPI } from '../../services/api';

const TYPE_LABEL = {
  'mock-interview': 'Mock Interview',
  'doubt-clearing': 'Doubt Clearing',
  'guest-talk': 'Guest Talk',
  'resume-review': 'Resume Review',
  'group-study': 'Group Study',
  other: 'Session',
};

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function countdownText(when) {
  const diff = new Date(when).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/**
 * Horizontal strip of live + upcoming Google Meet sessions across all rooms.
 * Renders nothing when there is nothing scheduled, so the page never shows an
 * empty shell.
 */
export default function UpcomingMeetStrip() {
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useTick(1000);

  const load = useCallback(async () => {
    try {
      const data = await roomAPI.meetUpcoming();
      setSessions((data.sessions || []).filter((s) => s.state !== 'ended' && s.state !== 'cancelled'));
    } catch {
      /* non-fatal */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!loaded || sessions.length === 0) return null;

  const live = sessions.filter((s) => s.state === 'live');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-orbit-violet/[0.08] via-white/[0.02] to-transparent p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Video size={17} className="text-orbit-violet" />
            {live.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
              </span>
            )}
          </div>
          <h3 className="font-bold text-white text-[15px] font-display">Live sessions with alumni</h3>
          {live.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/35 text-rose-200">
              {live.length} live now
            </span>
          )}
        </div>
        <Link
          to="/live-sessions"
          className="text-[11px] font-semibold text-orbit-cyan hover:underline whitespace-nowrap inline-flex items-center gap-1"
        >
          See all <ArrowRight size={11} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1 snap-x">
        <AnimatePresence initial={false}>
          {sessions.slice(0, 8).map((s, i) => {
            const isLive = s.state === 'live';
            return (
              <motion.div
                key={s._id}
                layout
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 280, damping: 26 }}
                className="snap-start shrink-0"
              >
                <Link
                  to={`/rooms/${s.roomId?.slug || s.roomId?._id || ''}`}
                  className={`group block w-[260px] rounded-xl border p-3.5 transition-all duration-300 hover:-translate-y-0.5 ${
                    isLive
                      ? 'border-rose-400/40 bg-rose-500/[0.08] hover:border-rose-400/60 hover:shadow-[0_0_28px_-10px_rgba(244,63,94,0.5)]'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/22 hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-300">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-400" />
                        </span>
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 tabular-nums">
                        <Clock size={10} /> in {countdownText(s.scheduledAt)}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600">·</span>
                    <span className="text-[10px] text-slate-500 truncate">
                      {TYPE_LABEL[s.sessionType] || 'Session'}
                    </span>
                  </div>

                  <p className="text-[13px] font-bold text-white leading-snug line-clamp-2 mb-2 group-hover:text-orbit-cyan transition-colors">
                    {s.title}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: s.hostId?.avatarColor || '#7c5cff' }}
                    >
                      {(s.hostId?.fullName || '?')[0]}
                    </span>
                    <span className="truncate">{s.hostId?.fullName}</span>
                    <span className="ml-auto inline-flex items-center gap-1 shrink-0">
                      <Users size={10} /> {s.goingCount}
                    </span>
                  </div>

                  {s.roomId?.name && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/8 flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 truncate">{s.roomId.name}</span>
                      <ArrowRight size={11} className="text-slate-600 group-hover:text-orbit-cyan group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  )}
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
