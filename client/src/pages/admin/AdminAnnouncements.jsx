import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Plus, Edit3, Trash2, Pin, Send, Eye, EyeOff, Calendar,
  Users, AlertTriangle, Info, Save, CheckCircle2, Search, Clock,
} from 'lucide-react';
import { notificationAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard,
} from '../../components/ui/Primitives';
import Modal, { ConfirmModal } from '../../components/ui/Modal';
import { timeAgo, formatDate, formatDateTime } from '../../utils/helpers';

const CATEGORIES = [
  { key: 'general', label: 'General', tone: 'slate' },
  { key: 'placement', label: 'Placement', tone: 'violet' },
  { key: 'exam', label: 'Exam', tone: 'cyan' },
  { key: 'urgent', label: 'Urgent', tone: 'coral' },
];
const AUDIENCES = [
  { key: 'all', label: 'Everyone' },
  { key: 'students', label: 'Students only' },
  { key: 'seniors', label: 'Seniors / alumni' },
];

const empty = () => ({
  title: '', body: '', category: 'general', audience: 'all',
  pinned: false, expiresAt: '', isPublished: true,
});

export default function AdminAnnouncements() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const d = await notificationAPI.announcements();
      setItems(d.announcements || []);
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
  const openEdit = (a) => {
    setForm({
      ...empty(), ...a,
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 10) : '',
    });
    setEditingId(a._id);
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) return toast.error('Title and body are required');
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        category: form.category,
        audience: form.audience,
        pinned: form.pinned,
        isPublished: form.isPublished,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };
      if (editingId) {
        await notificationAPI.updateAnnouncement(editingId, payload);
        toast.success('Announcement updated');
      } else {
        await notificationAPI.createAnnouncement(payload);
        toast.success(
          payload.isPublished
            ? 'Published — every targeted student gets an in-app notification.'
            : 'Saved as unpublished.'
        );
      }
      setEditorOpen(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const quickToggle = async (a, field) => {
    setBusy(a._id);
    try {
      await notificationAPI.updateAnnouncement(a._id, { [field]: !a[field] });
      toast.success(
        field === 'pinned'
          ? (a.pinned ? 'Unpinned' : 'Pinned to the top')
          : (a.isPublished ? 'Unpublished — hidden from students' : 'Published')
      );
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    try {
      await notificationAPI.removeAnnouncement(deleting._id);
      toast.success('Announcement deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Loading announcements…" />;

  const filtered = items.filter((a) => {
    if (filter && a.category !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
  });

  const published = items.filter((a) => a.isPublished);
  const pinned = items.filter((a) => a.pinned);
  const expired = items.filter((a) => a.expiresAt && new Date(a.expiresAt) < new Date());

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const catMeta = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[0];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Megaphone}
        title="Announcements"
        subtitle="Broadcast to the whole cohort. Every publish creates a real in-app notification for the targeted audience."
        action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New announcement</button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Megaphone} label="Total" value={items.length} sub="All announcements" tone="violet" />
        <StatCard icon={Send} label="Published" value={published.length} sub="Visible to students" tone="mint" delay={0.06} />
        <StatCard icon={Pin} label="Pinned" value={pinned.length} sub="Shown at the top" tone="amber" delay={0.12} />
        <StatCard icon={Clock} label="Expired" value={expired.length} sub="Past their date" tone="slate" delay={0.18} />
      </div>

      <Callout tone="violet" icon={Info} title="Announcements are not decoration">
        Publishing writes a Notification document for every user in the target audience, so it appears in their bell
        and on the Notifications page — the same pipeline as deadline and revision reminders. Unpublishing hides the
        announcement but leaves the notifications already delivered.
      </Callout>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-10" placeholder="Search announcements…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Tabs
          tabs={[
            { key: '', label: 'All', count: items.length },
            ...CATEGORIES.map((c) => ({ key: c.key, label: c.label, count: items.filter((a) => a.category === c.key).length })),
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={Megaphone}
            title="No announcements"
            description="Post drive schedules, exam dates or anything the whole cohort needs to know."
            action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> New announcement</button>}
          />
        </MotionCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered
              .slice()
              .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.createdAt) - new Date(a.createdAt))
              .map((a, i) => {
                const meta = catMeta(a.category);
                const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
                return (
                  <motion.div
                    key={a._id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.03, 0.25) }}
                    className={`glass p-4 ${a.pinned ? 'border-amber-400/28 bg-amber-400/[0.03]' : ''} ${!a.isPublished || isExpired ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {a.pinned && <Badge tone="amber" icon={Pin}>Pinned</Badge>}
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <Badge tone="slate" icon={Users}>
                            {AUDIENCES.find((x) => x.key === a.audience)?.label || a.audience}
                          </Badge>
                          {!a.isPublished && <Badge tone="coral" icon={EyeOff}>Unpublished</Badge>}
                          {isExpired && <Badge tone="slate">Expired</Badge>}
                        </div>

                        <h3 className="text-[14.5px] font-bold text-white mb-1.5">{a.title}</h3>
                        <p className="text-[13px] text-slate-400 leading-relaxed whitespace-pre-line line-clamp-3">{a.body}</p>

                        <p className="text-[10.5px] text-slate-600 mt-2.5">
                          {a.publishedByName ? `By ${a.publishedByName} · ` : ''}
                          {timeAgo(a.createdAt)}
                          {a.expiresAt ? ` · expires ${formatDate(a.expiresAt)}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <button
                          onClick={() => quickToggle(a, 'pinned')}
                          disabled={busy === a._id}
                          className={`btn-secondary btn-sm ${a.pinned ? 'text-amber-400' : ''}`}
                          title={a.pinned ? 'Unpin' : 'Pin to top'}
                        >
                          {busy === a._id ? <Spinner size={13} /> : <Pin size={13} />}
                        </button>
                        <button
                          onClick={() => quickToggle(a, 'isPublished')}
                          disabled={busy === a._id}
                          className="btn-secondary btn-sm"
                          title={a.isPublished ? 'Unpublish' : 'Publish'}
                        >
                          {a.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                          {a.isPublished ? 'Live' : 'Hidden'}
                        </button>
                        <button onClick={() => openEdit(a)} className="btn-secondary btn-sm p-2" aria-label="Edit"><Edit3 size={13} /></button>
                        <button onClick={() => setDeleting(a)} className="btn-secondary btn-sm p-2 hover:text-rose-400" aria-label="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}

      {/* editor */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit announcement' : 'New announcement'}
        subtitle="Publishing notifies every targeted student in-app"
        icon={Megaphone}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? <><Spinner size={14} /> Saving…</> : <><Save size={15} /> {editingId ? 'Save changes' : 'Create'}</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="atitle">Title *</label>
            <input
              id="atitle" className="input"
              placeholder="e.g. Nexora drive shifted to 18 September"
              value={form.title} onChange={(e) => set('title', e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="abody">Body *</label>
            <textarea
              id="abody"
              className="input min-h-[130px] resize-y"
              placeholder="The details students actually need: what changed, what they must do, by when."
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
            />
            <p className="text-[10.5px] text-slate-600 mt-1">{form.body.length} characters</p>
          </div>

          <div>
            <span className="label">Category</span>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => set('category', c.key)}
                  className={`rounded-lg border px-2 py-2 text-[12px] font-medium transition-all ${
                    form.category === c.key ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Audience</span>
            <div className="grid grid-cols-3 gap-1.5">
              {AUDIENCES.map((a) => (
                <button
                  key={a.key}
                  onClick={() => set('audience', a.key)}
                  className={`rounded-lg border px-2 py-2 text-[12px] font-medium transition-all ${
                    form.audience === a.key ? 'border-orbit-cyan/60 bg-cyan-400/12 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="aexp">Expires on <span className="text-slate-600">(optional)</span></label>
            <input id="aexp" className="input" type="date" value={form.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox" checked={form.pinned}
                onChange={(e) => set('pinned', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
              />
              <span className="text-[13px] text-slate-300">Pin to the top of the announcement list</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox" checked={form.isPublished}
                onChange={(e) => set('isPublished', e.target.checked)}
                className="w-4 h-4 rounded accent-orbit-violet cursor-pointer"
              />
              <span className="text-[13px] text-slate-300">Publish now and notify the audience</span>
            </label>
          </div>

          {form.category === 'urgent' && form.isPublished && (
            <Callout tone="coral" icon={AlertTriangle} title="Urgent announcements are high priority">
              This will land at the top of every targeted student's notification list. Use it for genuine schedule
              changes and deadline shifts — overuse and students stop reading them.
            </Callout>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this announcement?"
        message={`"${deleting?.title}" will be removed. Notifications already delivered to students stay in their inbox.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
