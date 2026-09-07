import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Radio, CalendarClock, CheckCircle2, Plus, Search, X, Users,
  Sparkles, ShieldCheck, ArrowRight, Hash, History, Inbox, Filter,
} from 'lucide-react';
import { roomAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import {
  PageHeader, LoadingScreen, EmptyState, StatCard, Spinner,
} from '../components/ui/Primitives';
import {
  SessionCard, ScheduleForm, TYPE_META, TONE, CountdownPill, fmtDate,
} from '../components/rooms/MeetSessionPanel';

/* ─────────────────────────── hero: the live rail ─────────────────────────── */

/**
 * A live session is the only thing on this page that is time-critical, so it
 * gets its own treatment above the fold rather than being one card among many.
 */
function LiveHero({ sessions, onChanged }) {
  if (sessions.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="relative rounded-3xl border border-rose-400/30 overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 140% at 0% 0%, rgba(244,63,94,0.16) 0%, rgba(124,92,255,0.10) 42%, rgba(8,10,26,0) 78%)',
      }}
    >
      {/* animated sheen */}
      <motion.div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)',
        }}
        animate={{ x: ['-40%', '140%'] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
      />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-400" />
          </span>
          <h2 className="font-display font-bold text-white text-lg">
            Happening right now
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-rose-400/15 border border-rose-400/30 text-rose-200 text-[11px] font-bold">
            {sessions.length} live
          </span>
        </div>

        <div className={`grid gap-4 ${sessions.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
          {sessions.map((s) => (
            <SessionCard key={s._id} session={s} onChanged={onChanged} defaultOpen />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/* ──────────────────────────── filter controls ──────────────────────────── */

function FilterBar({ scope, setScope, type, setType, mine, setMine, q, setQ, canHost }) {
  const scopes = [
    { key: 'upcoming', label: 'Upcoming', icon: CalendarClock },
    { key: 'past', label: 'Past', icon: History },
    { key: 'all', label: 'All', icon: Inbox },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* scope segmented control */}
        <div className="inline-flex p-1 rounded-xl bg-white/[0.04] border border-white/10">
          {scopes.map((s) => {
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                aria-pressed={active}
                className={`relative px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="scope-pill"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-orbit-violet/80 to-indigo-500/70"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <s.icon size={13} className="relative" />
                <span className="relative">{s.label}</span>
              </button>
            );
          })}
        </div>

        {canHost && (
          <button
            onClick={() => setMine(!mine)}
            aria-pressed={mine}
            className={`px-3 py-2 rounded-xl text-[13px] font-semibold border transition-colors flex items-center gap-1.5 ${
              mine
                ? 'bg-orbit-cyan/12 border-orbit-cyan/35 text-orbit-cyan'
                : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
            }`}
          >
            <ShieldCheck size={14} /> Hosted by me
          </button>
        )}

        <div className="relative flex-1 min-w-[190px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sessions…"
            aria-label="Search sessions"
            className="input pl-9 pr-8 py-2 text-[13px]"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* type chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
          <Filter size={11} /> Type
        </span>
        <button
          onClick={() => setType('all')}
          aria-pressed={type === 'all'}
          className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors ${
            type === 'all'
              ? 'bg-white/10 border-white/25 text-white'
              : 'bg-transparent border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
          }`}
        >
          All
        </button>
        {Object.entries(TYPE_META).map(([key, meta]) => {
          const active = type === key;
          const tone = TONE[meta.tone];
          return (
            <button
              key={key}
              onClick={() => setType(active ? 'all' : key)}
              aria-pressed={active}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium border transition-colors flex items-center gap-1 ${
                active ? tone.chip : 'bg-transparent border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
              }`}
            >
              <meta.icon size={11} /> {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────── the page ─────────────────────────────── */

export default function LiveSessions() {
  const { user } = useAuth();
  const { on: onSocket } = useSocket(true);

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ live: 0, upcoming: 0, myRsvps: 0, total: 0 });
  const [canHost, setCanHost] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [scope, setScope] = useState('upcoming');
  const [type, setType] = useState('all');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Debounce the search so typing does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const load = useCallback(async () => {
    try {
      const data = await roomAPI.meetBrowse({
        scope,
        type,
        hosted: mine ? 'me' : undefined,
        q: debouncedQ || undefined,
      });
      setSessions(data.sessions || []);
      setStats(data.stats || { live: 0, upcoming: 0, myRsvps: 0, total: 0 });
      setCanHost(Boolean(data.canHost));
    } catch {
      /* transient — the next poll or socket event retries */
    } finally {
      setLoading(false);
    }
  }, [scope, type, mine, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  // Hosts need the room list to choose where a session lives.
  useEffect(() => {
    if (!canHost) return;
    roomAPI.list().then((d) => setRooms(d.rooms || [])).catch(() => {});
  }, [canHost]);

  // Live updates + a slow poll so countdowns flip state without a refresh.
  useEffect(() => {
    const refresh = () => load();
    const events = ['meet-session-created', 'meet-session-updated', 'meet-rsvp-updated', 'meet-attendance'];
    const offs = events.map((e) => onSocket(e, refresh));
    return () => offs.forEach((off) => off?.());
  }, [onSocket, load]);

  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const live = useMemo(() => sessions.filter((s) => s.state === 'live'), [sessions]);
  const rest = useMemo(() => sessions.filter((s) => s.state !== 'live'), [sessions]);

  if (loading) return <LoadingScreen label="Loading live sessions…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Sessions"
        subtitle="Mock interviews, doubt clearing and guest talks hosted by alumni and the placement cell — on Google Meet."
        icon={Video}
        action={
          canHost ? (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="btn-primary px-4 py-2.5 text-sm"
            >
              {showForm ? <><X size={15} /> Close</> : <><Plus size={15} /> Host a session</>}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Radio} label="Live now" value={stats.live} sub="Join in one click" tone="coral" />
        <StatCard icon={CalendarClock} label="Upcoming" value={stats.upcoming} sub="Scheduled ahead" tone="violet" delay={0.06} />
        <StatCard icon={CheckCircle2} label="You're attending" value={stats.myRsvps} sub="Your RSVPs" tone="cyan" delay={0.12} />
        <StatCard icon={Video} label="All sessions" value={stats.total} sub="Across every room" tone="mint" delay={0.18} />
      </div>

      {/* host form */}
      <AnimatePresence initial={false}>
        {showForm && canHost && (
          <ScheduleForm
            rooms={rooms}
            onDone={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* the honest framing — stated once, prominently */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-start gap-2.5">
        <ShieldCheck size={15} className="text-orbit-cyan shrink-0 mt-0.5" />
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Calls run on <strong className="text-slate-200">Google Meet</strong>, not inside CampusOrbit.
          We handle scheduling, RSVPs, reminders and attendance around them. The meeting link is
          revealed once you have RSVP&apos;d and the session goes live.
          {canHost && ' As an alumni/placement-cell account you can host your own session on any topic.'}
        </p>
      </div>

      <LiveHero sessions={live} onChanged={load} />

      <FilterBar
        scope={scope} setScope={setScope}
        type={type} setType={setType}
        mine={mine} setMine={setMine}
        q={q} setQ={setQ}
        canHost={canHost}
      />

      {rest.length === 0 && live.length === 0 ? (
        <EmptyState
          icon={Video}
          title={
            debouncedQ ? 'No sessions match that search'
              : scope === 'past' ? 'No past sessions yet'
                : 'No sessions scheduled'
          }
          description={
            canHost
              ? 'You can host one — pick a room, paste your Google Meet link and set a time.'
              : 'Alumni and the placement cell schedule sessions here. RSVP to get the link when one goes live.'
          }
          action={
            canHost ? (
              <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2.5 text-sm">
                <Plus size={15} /> Host a session
              </button>
            ) : (
              <Link to="/rooms" className="btn-ghost px-4 py-2.5 text-sm">
                Browse peer rooms <ArrowRight size={15} />
              </Link>
            )
          }
        />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {rest.map((s) => (
              <SessionCard key={s._id} session={s} onChanged={load} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
