import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PlayCircle, CheckCircle2, ArrowLeft, ArrowRight, Clock, ShieldCheck, Youtube,
  NotebookPen, Layers, HelpCircle, ListChecks, Target, Lightbulb, ExternalLink,
  Plus, Save, Trash2, Repeat, Info, Award,
} from 'lucide-react';
import { lessonAPI, noteAPI, revisionAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import YouTubePlayer, { YT_STATE } from '../components/YouTubePlayer';
import QuizRunner from '../components/QuizRunner';
import NoteViewer from '../components/NoteViewer';
import FlashcardDeck from '../components/FlashcardDeck';
import {
  LoadingScreen, EmptyState, Badge, Tabs, ProgressBar, Callout, Spinner, MotionCard,
} from '../components/ui/Primitives';
import { formatDuration } from '../utils/helpers';

export default function LessonDetail() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('notes');
  const [completing, setCompleting] = useState(false);
  const [watchPercent, setWatchPercent] = useState(0);
  const [personalNote, setPersonalNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const playerRef = useRef(null);
  const lastSaveRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await lessonAPI.get(lessonId);
      setData(d);
      setWatchPercent(d.myProgress?.percent || 0);
      setTab(d.notes?.length ? 'notes' : d.quiz ? 'quiz' : 'notes');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [load]);

  /** Persist playback progress to MongoDB (throttled). */
  const handleProgress = useCallback(
    ({ current, percent }) => {
      setWatchPercent((p) => Math.max(p, Math.round(percent)));
      const now = Date.now();
      if (now - lastSaveRef.current < 10000) return;
      lastSaveRef.current = now;
      lessonAPI
        .saveProgress(lessonId, {
          watchedSeconds: Math.round(current),
          lastTimestamp: Math.round(current),
          percent: Math.round(percent),
        })
        .catch(() => {});
    },
    [lessonId]
  );

  const handleStateChange = useCallback(
    (state) => {
      if (state === YT_STATE.PAUSED || state === YT_STATE.ENDED) {
        const p = playerRef.current;
        if (!p) return;
        const current = p.getCurrentTime();
        const duration = p.getDuration();
        lastSaveRef.current = Date.now();
        lessonAPI
          .saveProgress(lessonId, {
            watchedSeconds: Math.round(current),
            lastTimestamp: Math.round(current),
            percent: duration ? Math.round((current / duration) * 100) : 0,
          })
          .catch(() => {});
      }
    },
    [lessonId]
  );

  const markPractice = async () => {
    try {
      await lessonAPI.saveProgress(lessonId, { practiceDone: !data.myProgress?.practiceDone });
      toast.success(data.myProgress?.practiceDone ? 'Practice unmarked' : 'Practice task marked done');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const complete = async () => {
    setCompleting(true);
    try {
      const res = await lessonAPI.complete(lessonId);
      toast.success(res.message || 'Lesson completed. Revision scheduled for tomorrow.');
      load();
    } catch (e) {
      toast.error(e.message);
      if (/quiz/i.test(e.message)) setTab('quiz');
    } finally {
      setCompleting(false);
    }
  };

  const savePersonalNote = async () => {
    if (!personalNote.trim()) return;
    setSavingNote(true);
    try {
      await noteAPI.createPersonal({
        lessonId,
        title: `My notes — ${data.lesson.title}`,
        body: personalNote.trim(),
      });
      toast.success('Your personal note is saved to MongoDB');
      setPersonalNote('');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const scheduleRevision = async () => {
    try {
      await revisionAPI.create({ lessonId, topic: data.lesson.title });
      toast.success('Revision scheduled — day 1, then 7, then 21.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Opening lesson…" />;
  if (!data) return <EmptyState title="Lesson not found" description="It may have been unpublished." />;

  const { lesson, milestone, notes, personalNotes, flashcards, quiz, navigation, myProgress } = data;
  const pv = lesson.primaryVideo;
  const isCompleted = myProgress?.completed;

  const tabs = [
    { key: 'notes', label: 'Smart Notes', icon: NotebookPen, count: notes.length },
    { key: 'flashcards', label: 'Flashcards', icon: Layers, count: flashcards.length },
    { key: 'quiz', label: 'Quiz', icon: HelpCircle, count: quiz?.questions?.length || 0 },
    { key: 'mynotes', label: 'My Notes', icon: Plus, count: personalNotes.length },
  ];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* --------------------------------------------------------- header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button onClick={() => navigate('/learn')} className="btn-ghost btn-sm mb-2.5 -ml-2">
            <ArrowLeft size={14} /> All lessons
          </button>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {milestone && <Badge tone="violet">{milestone.title}</Badge>}
            <Badge tone="slate">{lesson.difficulty}</Badge>
            <Badge tone="cyan" icon={Clock}>{lesson.estimatedMinutes} min</Badge>
            {isCompleted && <Badge tone="mint" icon={CheckCircle2}>Completed</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight">{lesson.title}</h1>
          {lesson.summary && <p className="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">{lesson.summary}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {navigation.previous && (
            <Link to={`/learn/${navigation.previous._id}`} className="btn-secondary btn-sm" title={navigation.previous.title}>
              <ArrowLeft size={14} /> Prev
            </Link>
          )}
          <span className="text-[11px] text-slate-500 tabular-nums px-1">
            {navigation.index} / {navigation.total}
          </span>
          {navigation.next && (
            <Link to={`/learn/${navigation.next._id}`} className="btn-secondary btn-sm" title={navigation.next.title}>
              Next <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        {/* -------------------------------------------------- left column */}
        <div className="space-y-4">
          {/* video */}
          <MotionCard hover={false} className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Youtube size={16} className="text-rose-400" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                The one curated video for this topic
              </p>
            </div>

            {pv?.isEmbeddable === false ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-6 text-center">
                <p className="text-sm text-amber-100/85 mb-3">
                  The creator has disabled embedding for this video. Watch it on YouTube and come back.
                </p>
                <a
                  href={`https://www.youtube.com/watch?v=${pv.youtubeVideoId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-secondary btn-sm"
                >
                  <ExternalLink size={13} /> Open on YouTube
                </a>
              </div>
            ) : (
              <YouTubePlayer
                ref={playerRef}
                videoId={pv.youtubeVideoId}
                startAt={myProgress?.lastTimestamp || 0}
                onProgress={handleProgress}
                onStateChange={handleStateChange}
              />
            )}

            {/* video meta */}
            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-100 leading-snug">{pv.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {pv.channelName}
                    {pv.duration ? ` · ${formatDuration(pv.duration)}` : ''}
                  </p>
                </div>
                <a
                  href={`https://www.youtube.com/watch?v=${pv.youtubeVideoId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-ghost btn-sm shrink-0"
                >
                  <ExternalLink size={13} /> YouTube
                </a>
              </div>

              {myProgress?.lastTimestamp > 5 && !isCompleted && (
                <p className="text-[11px] text-cyan-300 flex items-center gap-1.5">
                  <Info size={11} /> Resumed from {formatDuration(myProgress.lastTimestamp)} — your position is saved in MongoDB.
                </p>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Watch progress</span>
                  <span className="tabular-nums">{watchPercent}%</span>
                </div>
                <ProgressBar value={watchPercent} tone="coral" height="h-1.5" />
              </div>

              {/* why this video */}
              {pv.reasonForRecommendation && (
                <Callout tone="mint" icon={ShieldCheck} title="Why this video was chosen">
                  {pv.reasonForRecommendation}
                  <span className="block mt-1.5 text-[11px] opacity-75">
                    Verified by {pv.verifiedBy}. There is exactly one primary video per topic on purpose — no playlist
                    paralysis.
                  </span>
                </Callout>
              )}
            </div>
          </MotionCard>

          {/* key takeaways */}
          {lesson.keyTakeaways?.length > 0 && (
            <MotionCard hover={false} className="p-5" delay={0.06}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Lightbulb size={12} /> Key takeaways
              </p>
              <ul className="space-y-2">
                {lesson.keyTakeaways.map((k, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-2.5 text-[13px] text-slate-300 leading-relaxed"
                  >
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                    {k}
                  </motion.li>
                ))}
              </ul>
            </MotionCard>
          )}

          {/* practice task */}
          {lesson.practiceTask && (
            <MotionCard hover={false} className="p-5" delay={0.1}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <ListChecks size={12} /> Practice task
              </p>
              <p className="text-[13px] text-slate-300 leading-relaxed mb-4">{lesson.practiceTask}</p>
              <button
                onClick={markPractice}
                className={myProgress?.practiceDone ? 'btn-success btn-sm' : 'btn-secondary btn-sm'}
              >
                <CheckCircle2 size={14} />
                {myProgress?.practiceDone ? 'Practice done' : 'Mark practice done'}
              </button>
            </MotionCard>
          )}

          {/* completion */}
          <MotionCard hover={false} className="p-5" delay={0.14}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-white mb-1">
                  {isCompleted ? 'Lesson completed ✅' : 'Ready to close this lesson?'}
                </p>
                <p className="text-[12px] text-slate-400 leading-relaxed max-w-md">
                  {isCompleted
                    ? 'This lesson counts towards your milestone and preparation score. A revision task was scheduled automatically.'
                    : lesson.requiresQuizToComplete
                    ? 'Pass the quiz first. That requirement is what keeps your preparation score honest.'
                    : 'Marking complete unlocks the next lesson and schedules spaced revision.'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={scheduleRevision} className="btn-secondary btn-sm">
                  <Repeat size={14} /> Schedule revision
                </button>
                {!isCompleted && (
                  <button onClick={complete} disabled={completing} className="btn-success btn-sm">
                    {completing ? <><Spinner size={13} /> Saving…</> : <><CheckCircle2 size={14} /> Mark complete</>}
                  </button>
                )}
                {isCompleted && navigation.next && (
                  <Link to={`/learn/${navigation.next._id}`} className="btn-primary btn-sm">
                    Next lesson <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>

            {isCompleted && myProgress?.quizPassed && (
              <div className="mt-3.5 pt-3.5 border-t border-white/[0.06] flex items-center gap-2">
                <Award size={14} className="text-emerald-400" />
                <span className="text-[12px] text-emerald-300">Quiz passed — full credit on your preparation score.</span>
              </div>
            )}
          </MotionCard>
        </div>

        {/* ------------------------------------------------- right column */}
        <MotionCard hover={false} className="p-4 sm:p-5 lg:sticky lg:top-20">
          <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

          <div className="min-h-[320px]">
            {tab === 'notes' && (
              notes.length ? (
                <div className="space-y-5 max-h-[65vh] overflow-y-auto scrollbar-thin pr-1">
                  {notes.map((n) => (
                    <NoteViewer key={n._id} note={n} onChanged={load} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={NotebookPen}
                  title="No smart notes yet"
                  description="Notes are generated by the placement cell from an authorised transcript. Write your own in the My Notes tab meanwhile."
                />
              )
            )}

            {tab === 'flashcards' && <FlashcardDeck flashcards={flashcards} />}

            {tab === 'quiz' && (
              quiz ? (
                <QuizRunner quiz={quiz} onCompleted={load} />
              ) : (
                <EmptyState icon={HelpCircle} title="No quiz for this lesson" description="This lesson can be completed without a quiz." />
              )
            )}

            {tab === 'mynotes' && (
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="mynote">Write a personal note</label>
                  <textarea
                    id="mynote"
                    className="input min-h-[130px] resize-y"
                    placeholder="What clicked for you? What is still fuzzy? Write it in your own words — that is what makes it stick."
                    value={personalNote}
                    onChange={(e) => setPersonalNote(e.target.value)}
                  />
                  <button
                    onClick={savePersonalNote}
                    disabled={!personalNote.trim() || savingNote}
                    className="btn-primary btn-sm mt-2.5 w-full"
                  >
                    {savingNote ? <><Spinner size={13} /> Saving…</> : <><Save size={14} /> Save note</>}
                  </button>
                </div>

                {personalNotes.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-white/[0.07] max-h-[45vh] overflow-y-auto scrollbar-thin pr-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Your notes ({personalNotes.length})
                    </p>
                    {personalNotes.map((n) => (
                      <div key={n._id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[12px] font-semibold text-slate-200">{n.title}</p>
                          <button
                            onClick={async () => {
                              try {
                                await noteAPI.remove(n._id);
                                toast.success('Note deleted');
                                load();
                              } catch (e) {
                                toast.error(e.message);
                              }
                            }}
                            className="text-slate-500 hover:text-rose-400 shrink-0"
                            aria-label="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line">{n.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </MotionCard>
      </div>
    </div>
  );
}
