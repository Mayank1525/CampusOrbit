import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, MessageSquare, Search, Plus, Hash, Radio, Tv, ArrowRight,
  UserPlus, LogOut, Sparkles, Clock, Info, Shield,
} from 'lucide-react';
import { roomAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../hooks/useSocket';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Spinner,
  Callout, StatCard, Avatar,
} from '../components/ui/Primitives';
import Modal from '../components/ui/Modal';
import UpcomingMeetStrip from '../components/rooms/UpcomingMeetStrip';
import { timeAgo } from '../utils/helpers';

export default function Rooms() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { connected } = useSocket(true);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', topic: '', description: '', accentColor: '#7c5cff' });

  const load = async () => {
    try {
      const d = await roomAPI.list();
      setRooms(d.rooms || []);
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

  const join = async (room) => {
    setBusy(room._id);
    try {
      await roomAPI.join(room._id);
      toast.success(`Joined ${room.name}`);
      navigate(`/rooms/${room.slug || room._id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const leave = async (room) => {
    setBusy(room._id);
    try {
      await roomAPI.leave(room._id);
      toast.info(`Left ${room.name}`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const create = async () => {
    if (!form.name.trim()) return toast.error('Give the room a name');
    setBusy('create');
    try {
      const d = await roomAPI.create(form);
      toast.success('Room created');
      setCreateOpen(false);
      navigate(`/rooms/${d.room.slug || d.room._id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LoadingScreen label="Loading peer rooms…" />;

  const filtered = rooms.filter(
    (r) =>
      !query ||
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.topic?.toLowerCase().includes(query.toLowerCase()) ||
      r.description?.toLowerCase().includes(query.toLowerCase())
  );

  const myRooms = rooms.filter((r) => r.isMember);
  const liveWatch = rooms.filter((r) => r.activeWatchSessionId);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Peer Prep Rooms"
        subtitle="Structured group study. Text chat, shared resources, and Watch Together — no calls, no DMs, no noise."
        badge={
          <Badge tone={connected ? 'mint' : 'amber'} icon={Radio}>
            {connected ? 'Live' : 'Connecting…'}
          </Badge>
        }
        action={
          user?.role !== 'student' && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus size={15} /> New room
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Hash} label="Rooms" value={rooms.length} sub="Open to join" tone="violet" />
        <StatCard icon={UserPlus} label="You're in" value={myRooms.length} sub="Your rooms" tone="cyan" delay={0.06} />
        <StatCard icon={Tv} label="Watching now" value={liveWatch.length} sub="Live watch sessions" tone="coral" delay={0.12} />
        <StatCard
          icon={MessageSquare}
          label="Messages"
          value={rooms.reduce((s, r) => s + (r.messageCount || 0), 0)}
          sub="Across all rooms"
          tone="mint"
          delay={0.18}
        />
      </div>

      <UpcomingMeetStrip />

      <Callout tone="violet" icon={Shield} title="What Peer Rooms are — and deliberately are not">
        Rooms are <strong>structured group study</strong>: threaded replies, reactions, pinned messages, a shared
        resource list and synchronised video watching. CampusOrbit itself hosts <strong>no calls</strong> — no voice,
        no WebRTC, no private DMs. Alumni and the placement cell can schedule live sessions that run on
        <strong> Google Meet</strong>, and we handle the scheduling, RSVPs, reminders and attendance around them.
      </Callout>

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          className="input pl-10"
          placeholder="Search rooms by name or topic…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState icon={Users} title="No rooms found" description="Try a different search." />
        </MotionCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((r, i) => {
              const accent = r.accentColor || '#7c5cff';
              const live = Boolean(r.activeWatchSessionId);
              return (
                <motion.div
                  key={r._id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i * 0.05, 0.3) }}
                  whileHover={{ y: -5 }}
                  className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.028] p-5 hover:border-white/20 transition-all group"
                >
                  <div
                    className="absolute -top-20 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity"
                    style={{ background: accent }}
                  />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{ background: `${accent}1f`, borderColor: `${accent}44`, color: accent }}
                      >
                        <Hash size={19} />
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {live && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/18 text-rose-300 border border-rose-400/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> WATCHING
                          </span>
                        )}
                        {r.isMember && <Badge tone="mint">Joined</Badge>}
                      </div>
                    </div>

                    <h2 className="text-[15px] font-bold text-white mb-1 leading-snug">{r.name}</h2>
                    {r.topic && <p className="text-[11.5px] mb-2" style={{ color: accent }}>{r.topic}</p>}
                    <p className="text-[12.5px] text-slate-400 leading-relaxed line-clamp-2 mb-3.5">
                      {r.description || 'A peer study room.'}
                    </p>

                    <div className="flex items-center gap-3.5 text-[11px] text-slate-500 mb-4">
                      <span className="flex items-center gap-1.5"><Users size={11} /> {r.memberCount} member{r.memberCount === 1 ? '' : 's'}</span>
                      <span className="flex items-center gap-1.5"><MessageSquare size={11} /> {r.messageCount}</span>
                      {r.lastActivityAt && (
                        <span className="flex items-center gap-1.5 truncate"><Clock size={11} /> {timeAgo(r.lastActivityAt)}</span>
                      )}
                    </div>

                    {r.rules?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3.5">
                        {r.rules.slice(0, 2).map((rule, ri) => (
                          <span key={ri} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-slate-500 border border-white/[0.07] truncate max-w-full">
                            {rule}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-1.5">
                      <Link to={`/rooms/${r.slug || r._id}`} className="btn-primary btn-sm flex-1">
                        {r.isMember ? 'Open room' : 'Peek inside'} <ArrowRight size={13} />
                      </Link>
                      {r.isMember ? (
                        <button
                          onClick={() => leave(r)}
                          disabled={busy === r._id}
                          className="btn-secondary btn-sm p-2 hover:text-rose-400"
                          aria-label="Leave room"
                          title="Leave room"
                        >
                          {busy === r._id ? <Spinner size={13} /> : <LogOut size={13} />}
                        </button>
                      ) : (
                        <button
                          onClick={() => join(r)}
                          disabled={busy === r._id}
                          className="btn-secondary btn-sm p-2"
                          aria-label="Join room"
                          title="Join room"
                        >
                          {busy === r._id ? <Spinner size={13} /> : <UserPlus size={13} />}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* create room */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a peer room"
        subtitle="Rooms are public to all students. Keep the topic specific."
        icon={Plus}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={create} disabled={busy === 'create'}>
              {busy === 'create' ? <Spinner size={14} /> : <Plus size={15} />} Create room
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="rname">Room name</label>
            <input
              id="rname"
              className="input"
              placeholder="e.g. DSA — Graphs & Trees"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rtopic">Topic</label>
            <input
              id="rtopic"
              className="input"
              placeholder="e.g. Data Structures"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="rdesc">Description</label>
            <textarea
              id="rdesc"
              className="input min-h-[90px] resize-y"
              placeholder="What happens in this room and who it is for."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="raccent">Accent colour</label>
            <div className="flex gap-2">
              <input
                id="raccent"
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="h-9 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <input
                className="input font-mono text-[13px]"
                value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
