import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Edit3, Trash2, Hash, Flag, Shield, MessageSquare, Tv,
  EyeOff, CheckCircle2, X, Info, Search, ArrowRight, Save, AlertTriangle,
} from 'lucide-react';
import { roomAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, Avatar,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { timeAgo, formatDateTime } from '../../utils/helpers';

const empty = () => ({ name: '', topic: '', description: '', accentColor: '#7c5cff', rules: [] });

export default function AdminRooms() {
  const toast = useToast();
  const [rooms, setRooms] = useState([]);
  const [reported, setReported] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('rooms');
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState('');
  const [ruleDraft, setRuleDraft] = useState('');

  const load = async () => {
    try {
      const [r, m] = await Promise.all([roomAPI.list(), roomAPI.reported().catch(() => ({ messages: [] }))]);
      setRooms(r.rooms || []);
      setReported(m.messages || []);
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

  const openNew = () => { setForm(empty()); setEditingId(null); setEditorOpen(true); };
  const openEdit = (r) => {
    setForm({ ...empty(), name: r.name, topic: r.topic || '', description: r.description || '', accentColor: r.accentColor || '#7c5cff', rules: r.rules || [] });
    setEditingId(r._id);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Room name is required');
    setSaving(true);
    try {
      if (editingId) {
        await roomAPI.update(editingId, form);
        toast.success('Room updated');
      } else {
        await roomAPI.create(form);
        toast.success('Room created and open to students');
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await roomAPI.remove(deleting._id);
      toast.success('Room archived');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const moderate = async (msg, action) => {
    setBusy(msg._id);
    try {
      await roomAPI.moderate(msg._id, action);
      toast.success(action === 'hide' ? 'Message hidden from the room' : 'Report dismissed, message kept');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LoadingScreen label="Loading rooms & moderation queue…" />;

  const filtered = rooms.filter((r) => !query || r.name.toLowerCase().includes(query.toLowerCase()) || r.topic?.toLowerCase().includes(query.toLowerCase()));
  const liveWatch = rooms.filter((r) => r.activeWatchSessionId);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title="Rooms & Moderation"
        subtitle="Create study rooms, set the rules, and act on what students report."
        badge={reported.length > 0 && <Badge tone="coral" icon={Flag}>{reported.length} reported</Badge>}
        action={
          <>
            <Tabs
              tabs={[
                { key: 'rooms', label: 'Rooms', icon: Hash, count: rooms.length },
                { key: 'reports', label: 'Reports', icon: Flag, count: reported.length },
              ]}
              active={tab}
              onChange={setTab}
            />
            <button onClick={openNew} className="btn-primary"><Plus size={15} /> New room</button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Hash} label="Rooms" value={rooms.length} sub="Open to students" tone="violet" />
        <StatCard icon={MessageSquare} label="Messages" value={rooms.reduce((s, r) => s + (r.messageCount || 0), 0)} sub="Across all rooms" tone="cyan" delay={0.06} />
        <StatCard icon={Tv} label="Live sessions" value={liveWatch.length} sub="Watching together now" tone="mint" delay={0.12} />
        <StatCard icon={Flag} label="Reports" value={reported.length} sub="Awaiting your call" tone={reported.length ? 'coral' : 'mint'} delay={0.18} />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'rooms' ? (
          <motion.div key="rooms" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input className="input pl-10" placeholder="Search rooms…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {filtered.length === 0 ? (
              <MotionCard hover={false} className="p-8">
                <EmptyState
                  icon={Hash}
                  title="No rooms"
                  description="Create rooms around the topics your cohort actually struggles with."
                  action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New room</button>}
                />
              </MotionCard>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((r, i) => {
                  const accent = r.accentColor || '#7c5cff';
                  return (
                    <motion.div
                      key={r._id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.3) }}
                      whileHover={{ y: -4 }}
                      className="glass p-5 relative overflow-hidden"
                    >
                      <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full blur-3xl opacity-25" style={{ background: accent }} />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                            style={{ background: `${accent}1f`, borderColor: `${accent}44`, color: accent }}
                          >
                            <Hash size={18} />
                          </div>
                          {r.activeWatchSessionId && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/18 text-rose-300 border border-rose-400/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> LIVE
                            </span>
                          )}
                        </div>

                        <h3 className="text-[14.5px] font-bold text-white mb-1">{r.name}</h3>
                        {r.topic && <p className="text-[11.5px] mb-2" style={{ color: accent }}>{r.topic}</p>}
                        <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2 mb-3">{r.description}</p>

                        <div className="flex items-center gap-3.5 text-[11px] text-slate-500 mb-3.5">
                          <span className="flex items-center gap-1.5"><Users size={11} /> {r.memberCount}</span>
                          <span className="flex items-center gap-1.5"><MessageSquare size={11} /> {r.messageCount}</span>
                          {r.lastActivityAt && <span className="truncate">{timeAgo(r.lastActivityAt)}</span>}
                        </div>

                        {r.rules?.length > 0 && (
                          <p className="text-[10.5px] text-slate-600 mb-3">{r.rules.length} rule(s) set</p>
                        )}

                        <div className="flex gap-1.5">
                          <Link to={`/rooms/${r.slug || r._id}`} className="btn-secondary btn-sm flex-1">
                            Open <ArrowRight size={12} />
                          </Link>
                          <button onClick={() => openEdit(r)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                          <button onClick={() => setDeleting(r)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Archive"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          /* ------------------------------------------------ reports tab */
          <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <Callout tone="violet" icon={Shield} title="Moderation is a two-option decision">
              <strong>Hide</strong> removes the message from every student's view immediately (it stays in the
              database with an audit trail). <strong>Dismiss</strong> clears the report and keeps the message.
              Rooms only work if students trust that reporting does something.
            </Callout>

            {reported.length === 0 ? (
              <MotionCard hover={false} className="p-8">
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing reported"
                  description="No student has flagged a message. Check back after a busy study session."
                />
              </MotionCard>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {reported.map((m, i) => (
                    <motion.div
                      key={m._id}
                      layout
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="glass p-4 border-rose-400/22"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <Avatar name={m.userId?.fullName || m.authorName} color={m.userId?.avatarColor} size={30} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-100">
                                {m.userId?.fullName || m.authorName}
                              </p>
                              <p className="text-[10.5px] text-slate-500">
                                {m.roomId?.name || 'Room'} · {timeAgo(m.createdAt)}
                              </p>
                            </div>
                            {m.isHidden && <Badge tone="slate" icon={EyeOff}>Already hidden</Badge>}
                          </div>

                          <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 mb-3">
                            <p className="text-[13px] text-slate-300 leading-relaxed">{m.text}</p>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-300">
                              {m.reports?.length || 0} report(s)
                            </p>
                            {(m.reports || []).map((r, ri) => (
                              <p key={ri} className="text-[11.5px] text-rose-200/70 flex items-start gap-1.5">
                                <Flag size={10} className="shrink-0 mt-0.5" />
                                {r.reason} <span className="text-slate-600">· {formatDateTime(r.at)}</span>
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            onClick={() => moderate(m, 'hide')}
                            disabled={busy === m._id || m.isHidden}
                            className="btn-danger btn-sm"
                          >
                            {busy === m._id ? <Spinner size={13} /> : <EyeOff size={13} />} Hide message
                          </button>
                          <button
                            onClick={() => moderate(m, 'dismiss')}
                            disabled={busy === m._id}
                            className="btn-secondary btn-sm"
                          >
                            <CheckCircle2 size={13} /> Dismiss report
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* room editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit room' : 'New peer room'}
        icon={Hash}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> {editingId ? 'Save changes' : 'Create room'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="arname">Room name *</label>
            <input id="arname" className="input" placeholder="DSA — Graphs & Trees" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="artopic">Topic</label>
            <input id="artopic" className="input" placeholder="Data Structures" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="ardesc">Description</label>
            <textarea id="ardesc" className="input min-h-[80px] resize-y" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="araccent">Accent colour</label>
            <div className="flex gap-2">
              <input
                id="araccent" type="color" value={form.accentColor}
                onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                className="h-9 w-14 rounded-lg bg-transparent border border-white/10 cursor-pointer"
              />
              <input className="input font-mono text-[13px]" value={form.accentColor} onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))} />
            </div>
          </div>

          <div>
            <span className="label">Room rules <span className="text-slate-600">(shown in the sidebar)</span></span>
            <div className="flex gap-1.5 mb-2">
              <input
                className="input text-[13px] py-2 flex-1"
                placeholder="e.g. No spamming placement rumours"
                value={ruleDraft}
                onChange={(e) => setRuleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && ruleDraft.trim()) {
                    e.preventDefault();
                    setForm((f) => ({ ...f, rules: [...f.rules, ruleDraft.trim()] }));
                    setRuleDraft('');
                  }
                }}
              />
              <button
                onClick={() => { if (ruleDraft.trim()) { setForm((f) => ({ ...f, rules: [...f.rules, ruleDraft.trim()] })); setRuleDraft(''); } }}
                className="btn-secondary btn-sm px-3"
                aria-label="Add rule"
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="space-y-1.5">
              {form.rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-3 py-2">
                  <span className="text-[11px] text-orbit-violet font-bold shrink-0">{i + 1}.</span>
                  <span className="text-[12.5px] text-slate-300 flex-1">{r}</span>
                  <button
                    onClick={() => setForm((f) => ({ ...f, rules: f.rules.filter((_, x) => x !== i) }))}
                    className="text-slate-500 hover:text-rose-400 shrink-0"
                    aria-label="Remove rule"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {form.rules.length === 0 && <p className="text-[11px] text-slate-600">No rules yet.</p>}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Archive this room?"
        message={`"${deleting?.name}" will disappear from the student room list. Its messages stay in the database.`}
        confirmLabel="Archive"
        danger
      />
    </div>
  );
}
