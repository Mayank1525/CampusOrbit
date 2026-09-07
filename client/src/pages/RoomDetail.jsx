import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Send, Users, Hash, Pin, Reply, Flag, Link2, Tv, Play, Pause,
  RotateCw, X, Plus, Radio, Sparkles, Clock, Shield, MessageSquare, Info,
  UserPlus, LogOut, Bookmark, ExternalLink, ChevronDown, AlertTriangle, Loader2, History, Video,
} from 'lucide-react';
import { roomAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../hooks/useSocket';
import YouTubePlayer, { YT_STATE } from '../components/YouTubePlayer';
import {
  LoadingScreen, EmptyState, Badge, MotionCard, Spinner, Callout,
  SectionHeader, Avatar, Tabs,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import MeetSessionPanel from '../components/rooms/MeetSessionPanel';
import { formatDuration, timeAgo, formatDateTime, extractYouTubeId } from '../utils/helpers';

const REACTIONS = ['👍', '🔥', '💡', '❓', '🎯'];
const SYNC_TOLERANCE = 2.2; // seconds of drift before we hard-correct

export default function RoomDetail() {
  const { idOrSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { socket, connected, emit, on } = useSocket(true);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [presence, setPresence] = useState({ count: 0, users: [] });
  const [typing, setTyping] = useState([]);
  const [sidebar, setSidebar] = useState('members');

  // watch-together state
  const [watch, setWatch] = useState(null);
  const [watchOpen, setWatchOpen] = useState(false);
  const [startWatchOpen, setStartWatchOpen] = useState(false);
  const [watchForm, setWatchForm] = useState({ url: '', title: '' });
  const [watchParticipants, setWatchParticipants] = useState([]);
  const [syncBanner, setSyncBanner] = useState('');
  const [studyPointOpen, setStudyPointOpen] = useState(false);
  const [studyLabel, setStudyLabel] = useState('');

  // modals
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [resourceForm, setResourceForm] = useState({ label: '', url: '', note: '' });
  const [reporting, setReporting] = useState(null);
  const [reportReason, setReportReason] = useState('');

  const listRef = useRef(null);
  const playerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const applyingRemoteRef = useRef(false);
  const roomIdRef = useRef(null);

  /* ------------------------------------------------------------- loading */
  const load = useCallback(async () => {
    try {
      const d = await roomAPI.get(idOrSlug);
      setData(d);
      setMessages(d.messages || []);
      setWatch(d.watchSession || null);
      roomIdRef.current = String(d.room._id);
    } catch (e) {
      toast.error(e.message);
      navigate('/rooms');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrSlug]);

  useEffect(() => { load(); }, [load]);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    });
  }, []);

  useEffect(() => { if (!loading) scrollToBottom(false); }, [loading, scrollToBottom]);

  /* --------------------------------------------------------- socket wire */
  useEffect(() => {
    if (!socket || !connected || !data?.room?._id) return undefined;
    const roomId = String(data.room._id);

    emit('join-room', { roomId }).then((ack) => {
      if (ack?.error) toast.error(ack.error);
    });

    const offs = [
      on('new-message', (msg) => {
        if (String(msg.roomId) !== roomId) return;
        setMessages((m) => (m.some((x) => String(x._id) === String(msg._id)) ? m : [...m, msg]));
        scrollToBottom();
      }),
      on('presence-update', (p) => {
        if (String(p.roomId) === roomId) setPresence({ count: p.count ?? 0, users: p.users || [] });
      }),
      on('member-joined', (p) => {
        toast.info(`${p.name} joined the room`);
      }),
      on('user-typing', ({ name, isTyping, userId }) => {
        if (String(userId) === String(user?._id)) return;
        setTyping((t) => {
          if (isTyping) return t.includes(name) ? t : [...t, name];
          return t.filter((x) => x !== name);
        });
      }),
      on('message-reaction', ({ messageId, reactions }) => {
        setMessages((m) => m.map((x) => (String(x._id) === String(messageId) ? { ...x, reactions } : x)));
      }),
    ];

    return () => {
      emit('leave-room', { roomId });
      offs.forEach((off) => off?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, data?.room?._id]);

  /* ---------------------------------------------- watch-together sockets */
  const applyRemoteState = useCallback((state, position) => {
    const p = playerRef.current;
    if (!p?.isReady?.()) return;
    applyingRemoteRef.current = true;
    const drift = Math.abs(p.getCurrentTime() - position);
    if (drift > SYNC_TOLERANCE) p.seekTo(position, true);
    if (state === 'playing') p.play();
    else p.pause();
    setTimeout(() => { applyingRemoteRef.current = false; }, 700);
  }, []);

  useEffect(() => {
    if (!socket || !connected || !watch?._id || !watchOpen) return undefined;
    const sessionId = String(watch._id);

    emit('join-watch-session', { sessionId }).then((ack) => {
      if (ack?.error) return toast.error(ack.error);
      if (ack?.state) {
        setWatch((w) => ({ ...w, ...ack.state, _id: sessionId }));
        setTimeout(() => applyRemoteState(ack.state.state, ack.state.positionSeconds), 900);
      }
    });

    const flash = (text) => {
      setSyncBanner(text);
      setTimeout(() => setSyncBanner(''), 2600);
    };

    const offs = [
      on('video-play', ({ positionSeconds, by }) => {
        applyRemoteState('playing', positionSeconds);
        flash(`${by} started playback`);
      }),
      on('video-pause', ({ positionSeconds, by }) => {
        applyRemoteState('paused', positionSeconds);
        flash(`${by} paused`);
      }),
      on('video-seek', ({ positionSeconds, state, by }) => {
        applyRemoteState(state, positionSeconds);
        flash(`${by} jumped to ${formatDuration(positionSeconds)}`);
      }),
      on('video-state-changed', ({ state, positionSeconds, by }) => {
        applyRemoteState(state, positionSeconds);
        flash(`${by} synced everyone`);
      }),
      on('video-resync', ({ state, positionSeconds }) => {
        applyRemoteState(state, positionSeconds);
        flash('Re-synced with the host');
      }),
      on('watch-participant-joined', ({ userId, name }) => {
        setWatchParticipants((p) => (p.some((x) => x.userId === userId) ? p : [...p, { userId, name }]));
      }),
      on('watch-participant-left', ({ userId, name }) => {
        setWatchParticipants((p) => p.filter((x) => x.userId !== userId));
      }),
    ];

    return () => {
      emit('leave-watch-session', { sessionId });
      offs.forEach((off) => off?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, watch?._id, watchOpen]);

  /* --------------------------------------------------------- chat actions */
  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const ack = await emit('send-message', {
        roomId: String(data.room._id),
        text,
        replyTo: replyTo?._id || null,
      });
      if (ack?.error) {
        // Fall back to the REST route if the socket is unavailable.
        const d = await roomAPI.postMessage(data.room._id, { text, replyTo: replyTo?._id || undefined });
        setMessages((m) => [...m, d.message]);
        scrollToBottom();
      }
      setDraft('');
      setReplyTo(null);
      emit('typing', { roomId: String(data.room._id), isTyping: false });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const onDraftChange = (v) => {
    setDraft(v);
    if (!data?.room?._id) return;
    emit('typing', { roomId: String(data.room._id), isTyping: true });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emit('typing', { roomId: String(data.room._id), isTyping: false });
    }, 1800);
  };

  const react = async (message, emoji) => {
    const ack = await emit('react-message', { messageId: message._id, emoji });
    if (ack?.error) {
      try {
        const d = await roomAPI.react(message._id, emoji);
        setMessages((m) => m.map((x) => (String(x._id) === String(message._id) ? { ...x, reactions: d.reactions } : x)));
      } catch (e) {
        toast.error(e.message);
      }
    }
  };

  const pin = async (message) => {
    try {
      const d = await roomAPI.pin(message._id);
      toast.success(d.message || 'Pin updated');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const report = async () => {
    try {
      await roomAPI.report(reporting._id, reportReason || 'Inappropriate content');
      toast.success('Reported to the moderators. Thank you for keeping the room usable.');
      setReporting(null);
      setReportReason('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const joinRoom = async () => {
    try {
      await roomAPI.join(data.room._id);
      toast.success('Joined the room');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const leaveRoom = async () => {
    try {
      await roomAPI.leave(data.room._id);
      toast.info('Left the room');
      navigate('/rooms');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addResource = async () => {
    if (!resourceForm.url.trim() || !resourceForm.label.trim()) return toast.error('Label and URL required');
    try {
      await roomAPI.addResource(data.room._id, resourceForm);
      toast.success('Resource added to the room');
      setResourceOpen(false);
      setResourceForm({ label: '', url: '', note: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const d = await roomAPI.summary(data.room._id);
      setSummary(d.summary || d);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  /* ------------------------------------------------------- watch actions */
  const startWatch = async () => {
    const vid = extractYouTubeId(watchForm.url);
    if (!vid) return toast.error('Paste a valid YouTube URL');
    try {
      const d = await roomAPI.startWatch(data.room._id, {
        youtubeVideoId: vid,
        title: watchForm.title || 'Study session',
      });
      toast.success('Watch session started — everyone in the room can join');
      setWatch(d.session || d.watchSession);
      setStartWatchOpen(false);
      setWatchOpen(true);
      setWatchForm({ url: '', title: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const endWatch = async () => {
    try {
      await roomAPI.endWatch(watch._id);
      toast.success('Watch session ended');
      setWatch(null);
      setWatchOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const canControl = useMemo(() => {
    if (!watch || !user) return false;
    return String(watch.hostId) === String(user._id) || data?.isModerator || user.role === 'admin';
  }, [watch, user, data]);

  const hostPlay = async () => {
    const pos = playerRef.current?.getCurrentTime?.() || 0;
    const ack = await emit('video-play', { sessionId: String(watch._id), positionSeconds: pos });
    if (ack?.error) toast.error(ack.error);
  };
  const hostPause = async () => {
    const pos = playerRef.current?.getCurrentTime?.() || 0;
    const ack = await emit('video-pause', { sessionId: String(watch._id), positionSeconds: pos });
    if (ack?.error) toast.error(ack.error);
  };
  const hostSeek = async (seconds) => {
    playerRef.current?.seekTo?.(seconds, true);
    const ack = await emit('video-seek', { sessionId: String(watch._id), positionSeconds: seconds });
    if (ack?.error) toast.error(ack.error);
  };
  const resync = async () => {
    const ack = await emit('request-resync', { sessionId: String(watch._id) });
    if (ack?.error) return toast.error(ack.error);
    if (ack?.state) applyRemoteState(ack.state.state, ack.state.positionSeconds);
    toast.success('Re-synced with the host');
  };

  const sendTimestampMessage = async () => {
    const text = draft.trim();
    if (!text) return toast.error('Write something first');
    const ts = Math.round(playerRef.current?.getCurrentTime?.() || 0);
    const ack = await emit('send-timestamp-message', {
      roomId: String(data.room._id),
      sessionId: String(watch._id),
      text,
      timestamp: ts,
    });
    if (ack?.error) return toast.error(ack.error);
    setDraft('');
    toast.success(`Pinned to ${formatDuration(ts)}`);
  };

  const addStudyPoint = async () => {
    const ts = Math.round(playerRef.current?.getCurrentTime?.() || 0);
    try {
      const d = await roomAPI.addStudyPoint(watch._id, { timestamp: ts, label: studyLabel || `Study point at ${formatDuration(ts)}` });
      toast.success('Study point pinned');
      setWatch((w) => ({ ...w, pinnedStudyPoints: d.session?.pinnedStudyPoints || d.studyPoints || w.pinnedStudyPoints }));
      setStudyPointOpen(false);
      setStudyLabel('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  /** Local player events → broadcast only if this user controls playback. */
  const onPlayerStateChange = useCallback(
    (state) => {
      if (!watch || !canControl || applyingRemoteRef.current) return;
      const pos = playerRef.current?.getCurrentTime?.() || 0;
      if (state === YT_STATE.PLAYING) emit('video-play', { sessionId: String(watch._id), positionSeconds: pos });
      if (state === YT_STATE.PAUSED) emit('video-pause', { sessionId: String(watch._id), positionSeconds: pos });
    },
    [watch, canControl, emit]
  );

  if (loading) return <LoadingScreen label="Entering the room…" />;
  if (!data) return <EmptyState title="Room not found" />;

  const { room, isMember, isModerator } = data;
  const accent = room.accentColor || '#7c5cff';

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------- header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button onClick={() => navigate('/rooms')} className="btn-ghost btn-sm mb-2 -ml-2">
            <ArrowLeft size={14} /> All rooms
          </button>
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
              style={{ background: `${accent}1f`, borderColor: `${accent}44`, color: accent }}
            >
              <Hash size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white font-display tracking-tight">{room.name}</h1>
              <div className="flex items-center gap-2.5 mt-1 flex-wrap text-[12px] text-slate-400">
                {room.topic && <span style={{ color: accent }}>{room.topic}</span>}
                <span className="flex items-center gap-1.5"><Users size={11} /> {room.members?.length || 0}</span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {presence.count || 0} online
                </span>
                {isModerator && <Badge tone="violet" icon={Shield}>Moderator</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {watch ? (
            <button onClick={() => setWatchOpen((o) => !o)} className={watchOpen ? 'btn-primary' : 'btn-secondary'}>
              <Tv size={15} /> {watchOpen ? 'Hide' : 'Join'} watch party
            </button>
          ) : (
            (isModerator || user?.role !== 'student') && (
              <button onClick={() => setStartWatchOpen(true)} className="btn-secondary">
                <Tv size={15} /> Start watch together
              </button>
            )
          )}
          {isMember ? (
            <button onClick={leaveRoom} className="btn-secondary"><LogOut size={15} /> Leave</button>
          ) : (
            <button onClick={joinRoom} className="btn-primary"><UserPlus size={15} /> Join room</button>
          )}
        </div>
      </div>

      {!isMember && (
        <Callout tone="amber" icon={Info} title="You are viewing as a guest">
          Join the room to post messages, react and take part in watch sessions.
        </Callout>
      )}

      {/* ------------------------------------------------- watch together */}
      <AnimatePresence>
        {watch && watchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <MotionCard hover={false} className="p-4 sm:p-5 relative overflow-hidden">
              <div className="absolute -top-24 left-1/3 w-72 h-72 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/18 text-rose-300 border border-rose-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> WATCH TOGETHER
                      </span>
                      <Badge tone="slate">Host: {watch.hostName}</Badge>
                      {canControl && <Badge tone="violet" icon={Shield}>You control playback</Badge>}
                    </div>
                    <p className="text-[15px] font-bold text-white">{watch.title}</p>
                  </div>

                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <button onClick={resync} className="btn-secondary btn-sm">
                      <RotateCw size={13} /> Re-sync
                    </button>
                    {canControl && (
                      <>
                        <button onClick={() => setStudyPointOpen(true)} className="btn-secondary btn-sm">
                          <Bookmark size={13} /> Pin study point
                        </button>
                        <button onClick={endWatch} className="btn-danger btn-sm">
                          <X size={13} /> End session
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1.55fr_1fr] gap-4">
                  <div>
                    <div className="relative">
                      <YouTubePlayer
                        ref={playerRef}
                        videoId={watch.youtubeVideoId}
                        startAt={watch.positionSeconds || 0}
                        controls={canControl}
                        onStateChange={onPlayerStateChange}
                      />
                      <AnimatePresence>
                        {syncBanner && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-space-950/90 backdrop-blur border border-white/15 text-[11.5px] text-slate-200 shadow-elevate whitespace-nowrap"
                          >
                            {syncBanner}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {canControl ? (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button onClick={hostPlay} className="btn-primary btn-sm"><Play size={13} /> Play for everyone</button>
                        <button onClick={hostPause} className="btn-secondary btn-sm"><Pause size={13} /> Pause for everyone</button>
                        <button
                          onClick={() => hostSeek(Math.max(0, (playerRef.current?.getCurrentTime?.() || 0) - 10))}
                          className="btn-secondary btn-sm"
                        >
                          −10s
                        </button>
                        <button
                          onClick={() => hostSeek((playerRef.current?.getCurrentTime?.() || 0) + 10)}
                          className="btn-secondary btn-sm"
                        >
                          +10s
                        </button>
                      </div>
                    ) : (
                      <Callout tone="cyan" icon={Info} className="mt-3">
                        Playback is controlled by <strong>{watch.hostName}</strong>. Your player follows the host
                        automatically — hit Re-sync if you ever drift.
                      </Callout>
                    )}
                  </div>

                  {/* study points & participants */}
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                        <Bookmark size={11} /> Pinned study points
                      </p>
                      {(watch.pinnedStudyPoints || []).length === 0 ? (
                        <p className="text-[11.5px] text-slate-500">
                          No study points yet. The host can pin the moments worth rewatching.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin pr-1">
                          {watch.pinnedStudyPoints.map((sp, i) => (
                            <button
                              key={i}
                              onClick={() => (canControl ? hostSeek(sp.timestamp) : playerRef.current?.seekTo?.(sp.timestamp, true))}
                              className="w-full flex items-center gap-2.5 rounded-lg bg-white/[0.035] hover:bg-white/[0.07] px-2.5 py-2 text-left transition-colors group"
                            >
                              <span className="text-[10px] font-mono text-orbit-cyan bg-cyan-400/10 border border-cyan-400/22 px-1.5 py-0.5 rounded shrink-0">
                                {formatDuration(sp.timestamp)}
                              </span>
                              <span className="text-[12px] text-slate-300 truncate flex-1">{sp.label}</span>
                              <Play size={11} className="text-slate-600 group-hover:text-orbit-violet shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                        <Users size={11} /> Watching now ({watchParticipants.length || 1})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orbit-violet/12 border border-orbit-violet/25 text-[11px] text-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> You
                        </span>
                        {watchParticipants.map((p) => (
                          <span key={p.userId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[11px] text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Callout tone="violet" icon={Clock}>
                      Type in the chat box below and press <strong>Pin to timestamp</strong> to attach your message to
                      the exact second of the video everyone is on.
                    </Callout>
                  </div>
                </div>
              </div>
            </MotionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- chat + side */}
      <div
        className={`grid gap-4 items-start transition-[grid-template-columns] duration-300 ${
          sidebar === 'meet' ? 'lg:grid-cols-[1fr_390px]' : 'lg:grid-cols-[1fr_290px]'
        }`}
      >
        {/* chat */}
        <MotionCard hover={false} className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 230px)', minHeight: 460 }}>
          {/* pinned bar */}
          {room.pinnedMessages?.length > 0 && (
            <div className="border-b border-white/[0.06] px-4 py-2.5 bg-amber-400/[0.045] shrink-0">
              <div className="flex items-start gap-2.5">
                <Pin size={13} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Pinned ({room.pinnedMessages.length})
                  </p>
                  <div className="space-y-1 max-h-20 overflow-y-auto scrollbar-thin">
                    {room.pinnedMessages.map((m) => (
                      <p key={m._id} className="text-[12px] text-amber-100/85 leading-snug">
                        <strong>{m.userId?.fullName || m.authorName}:</strong> {m.text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  icon={MessageSquare}
                  title="No messages yet"
                  description="Be the first to ask a question. Rooms work best when someone starts."
                />
              </div>
            ) : (
              messages.map((m, i) => {
                const mine = String(m.userId?._id || m.userId) === String(user?._id);
                const author = m.userId?.fullName || m.authorName || 'Someone';
                const prev = messages[i - 1];
                const grouped =
                  prev &&
                  String(prev.userId?._id || prev.userId) === String(m.userId?._id || m.userId) &&
                  new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60 * 1000 &&
                  !m.replyTo;

                if (m.type === 'system') {
                  return (
                    <div key={m._id} className="text-center py-1">
                      <span className="text-[11px] text-slate-500 bg-white/[0.035] px-3 py-1 rounded-full">{m.text}</span>
                    </div>
                  );
                }

                return (
                  <motion.div
                    key={m._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`group flex gap-2.5 ${grouped ? 'mt-0.5' : 'mt-3'}`}
                  >
                    <div className="w-8 shrink-0">
                      {!grouped && (
                        <Avatar name={author} color={m.userId?.avatarColor} size={32} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[12.5px] font-bold ${mine ? 'text-orbit-violet' : 'text-slate-200'}`}>
                            {author}
                          </span>
                          {m.authorRole === 'senior' && <Badge tone="cyan">Senior</Badge>}
                          {m.authorRole === 'admin' && <Badge tone="violet">Placement Cell</Badge>}
                          <span className="text-[10px] text-slate-600">{timeAgo(m.createdAt)}</span>
                        </div>
                      )}

                      {m.replyTo && (
                        <div className="mb-1.5 pl-2.5 border-l-2 border-orbit-violet/40 text-[11.5px] text-slate-500 truncate">
                          <Reply size={9} className="inline mr-1" />
                          <strong>{m.replyTo.authorName}:</strong> {m.replyTo.text}
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {m.type === 'timestamp' && m.videoTimestamp != null && (
                            <button
                              onClick={() => (canControl ? hostSeek(m.videoTimestamp) : playerRef.current?.seekTo?.(m.videoTimestamp, true))}
                              className="inline-flex items-center gap-1 text-[10px] font-mono text-orbit-cyan bg-cyan-400/10 border border-cyan-400/22 px-1.5 py-0.5 rounded mr-2 hover:bg-cyan-400/20 transition-colors align-middle"
                            >
                              <Play size={8} /> {formatDuration(m.videoTimestamp)}
                            </button>
                          )}
                          {m.type === 'resource' ? (
                            <a
                              href={m.text.match(/https?:\/\/\S+/)?.[0] || '#'}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-start gap-2 text-[13.5px] text-orbit-cyan hover:underline break-words"
                            >
                              <Link2 size={13} className="shrink-0 mt-0.5" /> {m.text}
                            </a>
                          ) : (
                            <p className="text-[13.5px] text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
                              {m.text}
                            </p>
                          )}

                          {m.reactions?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(
                                m.reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {})
                              ).map(([emoji, count]) => (
                                <button
                                  key={emoji}
                                  onClick={() => react(m, emoji)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] hover:bg-white/[0.1] transition-colors"
                                >
                                  {emoji} <span className="text-slate-400 tabular-nums">{count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* hover actions */}
                        {isMember && (
                          <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                            {REACTIONS.slice(0, 3).map((e) => (
                              <button
                                key={e}
                                onClick={() => react(m, e)}
                                className="w-6 h-6 rounded hover:bg-white/[0.08] text-[12px] transition-colors"
                                aria-label={`React ${e}`}
                              >
                                {e}
                              </button>
                            ))}
                            <button
                              onClick={() => setReplyTo(m)}
                              className="w-6 h-6 rounded hover:bg-white/[0.08] flex items-center justify-center text-slate-500 hover:text-slate-200"
                              aria-label="Reply"
                              title="Reply"
                            >
                              <Reply size={12} />
                            </button>
                            {isModerator && (
                              <button
                                onClick={() => pin(m)}
                                className={`w-6 h-6 rounded hover:bg-white/[0.08] flex items-center justify-center ${m.isPinned ? 'text-amber-400' : 'text-slate-500 hover:text-slate-200'}`}
                                aria-label="Pin message"
                                title={m.isPinned ? 'Unpin' : 'Pin'}
                              >
                                <Pin size={12} />
                              </button>
                            )}
                            {!mine && (
                              <button
                                onClick={() => setReporting(m)}
                                className="w-6 h-6 rounded hover:bg-white/[0.08] flex items-center justify-center text-slate-500 hover:text-rose-400"
                                aria-label="Report message"
                                title="Report"
                              >
                                <Flag size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* typing */}
          <AnimatePresence>
            {typing.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-1 shrink-0"
              >
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                        className="w-1 h-1 rounded-full bg-orbit-violet"
                      />
                    ))}
                  </span>
                  {typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing…
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* composer */}
          <div className="border-t border-white/[0.06] p-3.5 shrink-0">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-orbit-violet/[0.09] border border-orbit-violet/22">
                <Reply size={12} className="text-orbit-violet shrink-0" />
                <p className="text-[11.5px] text-slate-300 truncate flex-1">
                  Replying to <strong>{replyTo.userId?.fullName || replyTo.authorName}</strong>: {replyTo.text}
                </p>
                <button onClick={() => setReplyTo(null)} className="text-slate-500 hover:text-white shrink-0" aria-label="Cancel reply">
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                className="input resize-none min-h-[44px] max-h-32 py-2.5 text-[13.5px]"
                placeholder={isMember ? 'Ask a question, share what you learned…' : 'Join the room to chat'}
                value={draft}
                disabled={!isMember}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
              />
              {watch && watchOpen && isMember && (
                <button
                  onClick={sendTimestampMessage}
                  className="btn-secondary btn-sm shrink-0 h-[44px]"
                  title="Attach this message to the current video time"
                >
                  <Clock size={14} /> Pin to timestamp
                </button>
              )}
              <button
                onClick={send}
                disabled={!draft.trim() || sending || !isMember}
                className="btn-primary shrink-0 h-[44px] px-4"
                aria-label="Send message"
              >
                {sending ? <Spinner size={15} /> : <Send size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">Enter to send · Shift+Enter for a new line</p>
          </div>
        </MotionCard>

        {/* ------------------------------------------------------ sidebar */}
        <div className="space-y-3">
          <Tabs
            tabs={[
              { key: 'members', label: 'Members', icon: Users },
              { key: 'meet', label: 'Live', icon: Video },
              { key: 'resources', label: 'Resources', icon: Link2 },
              { key: 'ai', label: 'Summary', icon: Sparkles },
            ]}
            active={sidebar}
            onChange={(k) => { setSidebar(k); if (k === 'ai' && !summary) loadSummary(); }}
            className="w-full"
          />

          {sidebar === 'members' && (
            <MotionCard hover={false} className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Members ({room.members?.length || 0})
              </p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin pr-1">
                {(room.members || []).map((m) => {
                  const isMod = room.moderators?.some((x) => String(x._id) === String(m._id));
                  return (
                    <div key={m._id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.035]">
                      <Avatar name={m.fullName} color={m.avatarColor} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-slate-200 truncate">{m.fullName}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{m.role}</p>
                      </div>
                      {isMod && <Shield size={12} className="text-orbit-violet shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {room.rules?.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-white/[0.06]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Room rules</p>
                  <ul className="space-y-1.5">
                    {room.rules.map((r, i) => (
                      <li key={i} className="text-[11.5px] text-slate-400 leading-relaxed flex gap-2">
                        <span className="text-orbit-violet shrink-0">{i + 1}.</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </MotionCard>
          )}

          {sidebar === 'meet' && (
            <MeetSessionPanel roomId={room._id} socket={socket} />
          )}

          {sidebar === 'resources' && (
            <MotionCard hover={false} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Shared resources ({room.resources?.length || 0})
                </p>
                {isMember && (
                  <button onClick={() => setResourceOpen(true)} className="btn-ghost btn-sm p-1.5" aria-label="Add resource">
                    <Plus size={13} />
                  </button>
                )}
              </div>
              {!room.resources?.length ? (
                <p className="text-[11.5px] text-slate-500">
                  No resources yet. Add the links that actually helped you.
                </p>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-thin pr-1">
                  {room.resources.map((r, i) => (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 hover:border-orbit-cyan/30 transition-all group"
                    >
                      <div className="flex items-start gap-2">
                        <Link2 size={12} className="text-orbit-cyan shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-slate-200 truncate">{r.label}</p>
                          <p className="text-[10px] text-slate-500 truncate">{r.url.replace(/^https?:\/\/(www\.)?/, '')}</p>
                          {r.note && <p className="text-[11px] text-slate-400 mt-1 leading-snug">{r.note}</p>}
                        </div>
                        <ExternalLink size={11} className="text-slate-600 group-hover:text-orbit-cyan shrink-0" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </MotionCard>
          )}

          {sidebar === 'ai' && (
            <MotionCard hover={false} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Room summary</p>
                <button onClick={loadSummary} disabled={summaryLoading} className="btn-ghost btn-sm p-1.5" aria-label="Refresh summary">
                  {summaryLoading ? <Spinner size={13} /> : <RotateCw size={13} />}
                </button>
              </div>

              {summaryLoading && !summary ? (
                <div className="flex justify-center py-8"><Spinner size={22} className="text-orbit-violet" /></div>
              ) : !summary ? (
                <p className="text-[11.5px] text-slate-500">Generate a summary of what this room has been discussing.</p>
              ) : (
                <div className="space-y-3.5">
                  {summary.mode === 'demo' && <Badge tone="amber" icon={Sparkles}>Demo AI Mode</Badge>}

                  <p className="text-[11.5px] text-slate-500">
                    Based on {summary.messageCount} messages.
                  </p>

                  {summary.mainTopics?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Main topics</p>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.mainTopics.map((t) => <span key={t} className="chip-violet">{t}</span>)}
                      </div>
                    </div>
                  )}

                  {summary.openQuestions?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Open questions</p>
                      <ul className="space-y-1.5">
                        {summary.openQuestions.map((q, i) => (
                          <li key={i} className="text-[11.5px] text-slate-400 leading-relaxed">• {q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.resources?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Links shared</p>
                      <ul className="space-y-1">
                        {summary.resources.map((r, i) => (
                          <li key={i} className="text-[11px] text-orbit-cyan truncate">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.suggestedNextSteps?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Suggested next steps</p>
                      <ul className="space-y-1.5">
                        {summary.suggestedNextSteps.map((s, i) => (
                          <li key={i} className="text-[11.5px] text-slate-400 leading-relaxed">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </MotionCard>
          )}

          {/* watch history */}
          {data.watchHistory?.length > 0 && (
            <MotionCard hover={false} className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <History size={11} /> Past watch sessions
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto scrollbar-thin pr-1">
                {data.watchHistory.map((s) => (
                  <div key={s._id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[12px] font-medium text-slate-200 truncate">{s.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {s.hostName} · {timeAgo(s.createdAt)} {s.isActive ? '· live' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </MotionCard>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- modals */}
      <Modal
        open={startWatchOpen}
        onClose={() => setStartWatchOpen(false)}
        title="Start a Watch Together session"
        subtitle="Everyone in the room watches the same video at the same second."
        icon={Tv}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setStartWatchOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={startWatch}><Tv size={15} /> Start session</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="wurl">YouTube URL</label>
            <input
              id="wurl"
              className="input"
              placeholder="https://www.youtube.com/watch?v=…"
              value={watchForm.url}
              onChange={(e) => setWatchForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="wtitle">Session title</label>
            <input
              id="wtitle"
              className="input"
              placeholder="e.g. Revising Express middleware together"
              value={watchForm.title}
              onChange={(e) => setWatchForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <Callout tone="violet" icon={Shield} title="You will be the host">
            Only you (and room moderators) can play, pause and seek. Everyone else follows automatically and can
            request a re-sync at any time. Chat messages can be pinned to exact video timestamps.
          </Callout>
        </div>
      </Modal>

      <Modal
        open={studyPointOpen}
        onClose={() => setStudyPointOpen(false)}
        title="Pin a study point"
        subtitle={`At ${formatDuration(Math.round(playerRef.current?.getCurrentTime?.() || 0))}`}
        icon={Bookmark}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setStudyPointOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={addStudyPoint}><Bookmark size={14} /> Pin it</button>
          </>
        }
      >
        <div>
          <label className="label" htmlFor="splabel">What happens here?</label>
          <input
            id="splabel"
            className="input"
            placeholder="e.g. The middleware chain explained clearly"
            value={studyLabel}
            onChange={(e) => setStudyLabel(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-slate-500 mt-2">
            Everyone in the session gets a clickable jump-to link at this exact second.
          </p>
        </div>
      </Modal>

      <Modal
        open={resourceOpen}
        onClose={() => setResourceOpen(false)}
        title="Add a shared resource"
        icon={Link2}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setResourceOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={addResource}><Plus size={15} /> Add resource</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="reslabel">Label</label>
            <input
              id="reslabel"
              className="input"
              placeholder="e.g. Best explanation of the event loop"
              value={resourceForm.label}
              onChange={(e) => setResourceForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="resurl">URL</label>
            <input
              id="resurl"
              className="input"
              placeholder="https://…"
              value={resourceForm.url}
              onChange={(e) => setResourceForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="resnote">Why is it worth it? (optional)</label>
            <textarea
              id="resnote"
              className="input min-h-[70px] resize-y"
              value={resourceForm.note}
              onChange={(e) => setResourceForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title="Report this message"
        subtitle="Moderators review every report"
        icon={Flag}
        size="sm"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReporting(null)}>Cancel</button>
            <button className="btn-danger" onClick={report}><Flag size={14} /> Report</button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 mb-1">
              {reporting?.userId?.fullName || reporting?.authorName}
            </p>
            <p className="text-[13px] text-slate-300">{reporting?.text}</p>
          </div>
          <div>
            <label className="label" htmlFor="reason">Reason</label>
            <select id="reason" className="input" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
              <option value="">Choose a reason…</option>
              <option value="Spam or self-promotion">Spam or self-promotion</option>
              <option value="Off-topic">Off-topic</option>
              <option value="Harassment or abuse">Harassment or abuse</option>
              <option value="Sharing paid content illegally">Sharing paid content illegally</option>
              <option value="Misinformation">Misinformation</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
