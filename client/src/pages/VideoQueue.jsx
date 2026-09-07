import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListVideo, Plus, Trash2, Bookmark, Youtube, CheckCircle2, Save, Info,
  Link2, Search, ExternalLink, X, Sparkles, ShieldAlert, PlayCircle,
} from 'lucide-react';
import { videoQueueAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import YouTubePlayer from '../components/YouTubePlayer';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, ProgressBar, Spinner, Callout,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { extractYouTubeId, formatDuration } from '../utils/helpers';

export default function VideoQueue() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [active, setActive] = useState(null);
  const [query, setQuery] = useState('');

  // add form
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [adding, setAdding] = useState(false);

  // player note state
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const lastSaveRef = useRef(0);

  const load = async () => {
    try {
      const d = await videoQueueAPI.list();
      setItems(d.items);
      setNotice(d.notice);
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

  /* ---------------------------------------------- live URL validation */
  useEffect(() => {
    setValidationError('');
    setPreview(null);
    if (!url.trim()) return undefined;

    const localId = extractYouTubeId(url);
    if (!localId) {
      setValidationError('Not a valid YouTube URL or 11-character video ID.');
      return undefined;
    }

    const t = setTimeout(async () => {
      setValidating(true);
      try {
        const d = await videoQueueAPI.validate(url.trim());
        setPreview(d);
      } catch (e) {
        setValidationError(e.message);
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [url]);

  const add = async () => {
    setAdding(true);
    try {
      const d = await videoQueueAPI.add({
        url: url.trim(),
        title: preview?.title || undefined,
        relatedTopic: topic.trim() || undefined,
      });
      toast.success('Added to your personal queue');
      setUrl('');
      setTopic('');
      setPreview(null);
      setAddOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const remove = async () => {
    try {
      await videoQueueAPI.remove(deleting._id);
      toast.success('Removed from your queue');
      if (active?._id === deleting._id) setActive(null);
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleBookmark = async (item) => {
    try {
      const d = await videoQueueAPI.bookmark(item._id);
      toast.success(d.item.bookmarked ? 'Bookmarked' : 'Bookmark removed');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const markComplete = async (item) => {
    try {
      await videoQueueAPI.update(item._id, { completed: !item.completed, percent: item.completed ? item.percent : 100 });
      toast.success(item.completed ? 'Marked as not watched' : 'Marked as watched');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const saveNote = async () => {
    if (!active) return;
    setSavingNote(true);
    try {
      await videoQueueAPI.update(active._id, { personalNotes: noteDraft });
      toast.success('Your notes are saved');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleProgress = useCallback(
    ({ current, percent }) => {
      if (!active) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 12000) return;
      lastSaveRef.current = now;
      videoQueueAPI
        .update(active._id, {
          lastTimestamp: Math.round(current),
          watchedSeconds: Math.round(current),
          percent: Math.round(percent),
        })
        .catch(() => {});
    },
    [active]
  );

  const openPlayer = (item) => {
    setActive(item);
    setNoteDraft(item.personalNotes || '');
    lastSaveRef.current = 0;
  };

  if (loading) return <LoadingScreen label="Loading your video queue…" />;

  const filtered = items.filter(
    (i) =>
      !query ||
      i.title?.toLowerCase().includes(query.toLowerCase()) ||
      i.relatedTopic?.toLowerCase().includes(query.toLowerCase()) ||
      i.channelName?.toLowerCase().includes(query.toLowerCase())
  );

  const watched = items.filter((i) => i.completed).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ListVideo}
        title="My Video Queue"
        subtitle="Your own YouTube resources, embedded and tracked. Separate from the curated path videos."
        badge={<Badge tone="cyan">{items.length} saved · {watched} watched</Badge>}
        action={
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus size={15} /> Add a video
          </button>
        }
      />

      {/* honesty notice */}
      <Callout tone="amber" icon={ShieldAlert} title="How your personal queue works">
        {notice || 'This is your personal resource. The primary recommended video remains the official path resource.'}
        <span className="block mt-1.5">
          CampusOrbit embeds the video and tracks your own progress and notes. It does <strong>not</strong> scrape or
          transcribe arbitrary videos — AI notes are only ever generated from transcripts the placement cell is
          authorised to use.
        </span>
      </Callout>

      {/* search */}
      {items.length > 0 && (
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            className="input pl-10"
            placeholder="Search your queue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {items.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Youtube}
            title="Your queue is empty"
            description="Found a video that explains something better? Paste the link here. It stays yours — separate from the curated path video for each topic."
            action={<button onClick={() => setAddOpen(true)} className="btn-primary"><Plus size={15} /> Add your first video</button>}
          />
        </MotionCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i * 0.04, 0.3) }}
                whileHover={{ y: -5 }}
                className="glass overflow-hidden group"
              >
                {/* thumbnail */}
                <button onClick={() => openPlayer(item)} className="relative w-full aspect-video bg-black overflow-hidden block">
                  <img
                    src={item.thumbnail || `https://i.ytimg.com/vi/${item.youtubeVideoId}/hqdefault.jpg`}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => { e.currentTarget.style.opacity = 0.15; }}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-space-950 via-transparent to-transparent" />
                  <motion.span
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  >
                    <span className="w-14 h-14 rounded-full bg-orbit-violet/85 backdrop-blur flex items-center justify-center border border-white/25">
                      <PlayCircle size={26} className="text-white" />
                    </span>
                  </motion.span>
                  {item.completed && (
                    <span className="absolute top-2 left-2">
                      <Badge tone="mint" icon={CheckCircle2}>Watched</Badge>
                    </span>
                  )}
                  {item.bookmarked && (
                    <span className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-amber-500/85 flex items-center justify-center">
                      <Bookmark size={13} className="text-white" fill="currentColor" />
                    </span>
                  )}
                  {item.percent > 0 && item.percent < 100 && (
                    <span className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <span className="block h-full bg-gradient-to-r from-orbit-violet to-orbit-cyan" style={{ width: `${item.percent}%` }} />
                    </span>
                  )}
                </button>

                {/* body */}
                <div className="p-4">
                  <p className="text-[13.5px] font-semibold text-slate-100 leading-snug line-clamp-2 mb-1.5">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-slate-500 mb-3 truncate">
                    {item.channelName || 'Unknown channel'}
                    {item.lastTimestamp > 5 && ` · resumes at ${formatDuration(item.lastTimestamp)}`}
                  </p>

                  {item.relatedTopic && (
                    <div className="mb-3">
                      <span className="chip-violet">{item.relatedTopic}</span>
                    </div>
                  )}

                  {item.personalNotes && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 italic border-l-2 border-white/10 pl-2.5">
                      {item.personalNotes}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => openPlayer(item)} className="btn-primary btn-sm flex-1">
                      <PlayCircle size={13} /> Watch
                    </button>
                    <button
                      onClick={() => toggleBookmark(item)}
                      className={`btn-sm p-2 ${item.bookmarked ? 'btn-primary' : 'btn-secondary'}`}
                      aria-label={item.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                      title={item.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                    >
                      <Bookmark size={13} fill={item.bookmarked ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => markComplete(item)}
                      className={`btn-sm p-2 ${item.completed ? 'btn-success' : 'btn-secondary'}`}
                      aria-label="Toggle watched"
                      title="Toggle watched"
                    >
                      <CheckCircle2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleting(item)}
                      className="btn-secondary btn-sm p-2 hover:text-rose-400"
                      aria-label="Delete from queue"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {filtered.length === 0 && items.length > 0 && (
        <MotionCard hover={false} className="p-8">
          <EmptyState icon={Search} title="No matches" description="Try a different search term." />
        </MotionCard>
      )}

      {/* --------------------------------------------------- add modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a video to your queue"
        subtitle="Paste any YouTube link — we validate it and extract the video ID."
        icon={Youtube}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={add} disabled={!preview || adding}>
              {adding ? <><Spinner size={14} /> Adding…</> : <><Plus size={15} /> Add to queue</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="vurl">YouTube URL or video ID</label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                id="vurl"
                className="input pl-10 pr-10"
                placeholder="https://www.youtube.com/watch?v=…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
              {validating && <Spinner size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-orbit-cyan" />}
              {preview && !validating && (
                <CheckCircle2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
              )}
            </div>
            {validationError && <p className="field-error">{validationError}</p>}
            <p className="text-[11px] text-slate-500 mt-1.5">
              Supports youtube.com/watch, youtu.be, /embed/, /shorts/ and bare 11-character IDs.
            </p>
          </div>

          <AnimatePresence>
            {preview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3.5">
                  <div className="flex gap-3.5">
                    <img
                      src={preview.thumbnail}
                      alt=""
                      className="w-32 aspect-video object-cover rounded-lg border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-100 line-clamp-2">
                        {preview.title || 'Video found'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{preview.channelName}</p>
                      <p className="text-[10px] font-mono text-emerald-300 mt-1.5">ID: {preview.videoId}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="label" htmlFor="vtopic">Related topic (optional)</label>
            <input
              id="vtopic"
              className="input"
              placeholder="e.g. React hooks, Binary search, DBMS normalisation"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <Callout tone="cyan" icon={Info}>
            This is your personal resource. The primary recommended video for each lesson stays the official path
            resource — your queue never replaces it.
          </Callout>
        </div>
      </Modal>

      {/* -------------------------------------------------- player modal */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title}
        subtitle={active?.channelName}
        icon={PlayCircle}
        size="xl"
        footer={
          <>
            <a
              href={`https://www.youtube.com/watch?v=${active?.youtubeVideoId}`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost btn-sm"
            >
              <ExternalLink size={13} /> YouTube
            </a>
            <button className="btn-secondary" onClick={() => setActive(null)}>Close</button>
            <button className="btn-primary" onClick={saveNote} disabled={savingNote}>
              {savingNote ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> Save notes</>}
            </button>
          </>
        }
      >
        {active && (
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
            <div>
              <YouTubePlayer
                videoId={active.youtubeVideoId}
                startAt={active.lastTimestamp || 0}
                onProgress={handleProgress}
              />
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Your progress on this video</span>
                  <span className="tabular-nums">{active.percent || 0}%</span>
                </div>
                <ProgressBar value={active.percent || 0} tone="cyan" height="h-1.5" />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Position saved automatically to MongoDB every few seconds.
                </p>
              </div>
            </div>

            <div className="flex flex-col">
              <label className="label" htmlFor="vnotes">Your notes on this video</label>
              <textarea
                id="vnotes"
                className="input flex-1 min-h-[220px] resize-y"
                placeholder="What did this explain better than the primary video? Timestamps, insights, gotchas…"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <Info size={11} className="shrink-0 mt-0.5" />
                Private to you. Stored in MongoDB against this queue item.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Remove from your queue?"
        message={`"${deleting?.title}" will be deleted from your personal queue along with your notes and progress on it. This cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
