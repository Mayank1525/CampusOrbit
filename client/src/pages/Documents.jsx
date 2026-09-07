import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderLock, Upload, Link2, Trash2, Download, FileText, Image as ImageIcon,
  Award, IdCard, Github, Code2, Paperclip, ShieldCheck, Plus, Search,
  CheckCircle2, AlertCircle, Info, Briefcase, ExternalLink, Loader2, Lock,
} from 'lucide-react';
import { documentAPI, opportunityAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  PageHeader, LoadingScreen, EmptyState, Badge, MotionCard, Tabs,
  Spinner, Callout, SectionHeader, StatCard, ProgressBar,
} from '../components/ui/Primitives';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { formatDate, timeAgo } from '../utils/helpers';

const CATEGORIES = [
  { key: 'resume', label: 'Resume', icon: FileText, tone: 'violet' },
  { key: 'marksheet', label: 'Marksheet / Transcript', icon: FileText, tone: 'cyan' },
  { key: 'certificate', label: 'Certificate', icon: Award, tone: 'amber' },
  { key: 'photo', label: 'Photograph', icon: ImageIcon, tone: 'mint' },
  { key: 'government-id', label: 'Government ID', icon: IdCard, tone: 'coral' },
  { key: 'project-link', label: 'Project link', icon: Github, tone: 'violet' },
  { key: 'coding-profile', label: 'Coding profile', icon: Code2, tone: 'cyan' },
  { key: 'other', label: 'Other', icon: Paperclip, tone: 'slate' },
];

const catMeta = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[7];

function humanSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [docs, setDocs] = useState([]);
  const [proof, setProof] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [checkOpp, setCheckOpp] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [uploadForm, setUploadForm] = useState({ file: null, label: '', category: 'other', notes: '' });
  const [linkForm, setLinkForm] = useState({ label: '', url: '', category: 'project-link', notes: '' });

  const load = async () => {
    try {
      const [d, p, o] = await Promise.all([
        documentAPI.list(),
        documentAPI.proofOfWork().catch(() => null),
        opportunityAPI.list({ limit: 20 }).catch(() => ({ opportunities: [] })),
      ]);
      setDocs(d.documents || []);
      setProof(p);
      setOpportunities(o.opportunities || []);
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

  const pickFile = (file) => {
    if (!file) return;
    setUploadForm((f) => ({ ...f, file, label: f.label || file.name.replace(/\.[^.]+$/, '') }));
  };

  const doUpload = async () => {
    if (!uploadForm.file) return toast.error('Choose a file first');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('label', uploadForm.label || uploadForm.file.name);
      fd.append('category', uploadForm.category);
      fd.append('notes', uploadForm.notes);
      await documentAPI.upload(fd);
      toast.success('Uploaded to your private wallet');
      setUploadOpen(false);
      setUploadForm({ file: null, label: '', category: 'other', notes: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doAddLink = async () => {
    if (!linkForm.url.trim() || !linkForm.label.trim()) return toast.error('Label and URL are required');
    setBusy(true);
    try {
      await documentAPI.addLink(linkForm);
      toast.success('Link saved to your wallet');
      setLinkOpen(false);
      setLinkForm({ label: '', url: '', category: 'project-link', notes: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await documentAPI.remove(deleting._id);
      toast.success('Removed from your wallet');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const runChecklist = async (oppId) => {
    setCheckOpp(oppId);
    if (!oppId) return setChecklist(null);
    try {
      const d = await documentAPI.checklist(oppId);
      setChecklist(d);
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <LoadingScreen label="Opening your document wallet…" />;

  const filtered = docs.filter((d) => {
    if (filter !== 'all' && d.category !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return d.label?.toLowerCase().includes(q) || d.fileName?.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q);
  });

  const byCategory = CATEGORIES.map((c) => ({ ...c, count: docs.filter((d) => d.category === c.key).length }));
  const files = docs.filter((d) => d.kind === 'file');
  const links = docs.filter((d) => d.kind === 'link');
  const totalSize = files.reduce((s, d) => s + (d.sizeBytes || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FolderLock}
        title="Document Wallet"
        subtitle="One private place for every marksheet, certificate and project link a drive can ask for."
        badge={<Badge tone="mint" icon={Lock}>Private to you</Badge>}
        action={
          <>
            <button onClick={() => setLinkOpen(true)} className="btn-secondary"><Link2 size={15} /> Add link</button>
            <button onClick={() => setUploadOpen(true)} className="btn-primary"><Upload size={15} /> Upload file</button>
          </>
        }
      />

      <Callout tone="violet" icon={ShieldCheck} title="Nobody else can see these">
        Documents in your wallet are scoped to your account in MongoDB. Other students, seniors and even the placement
        cell cannot list or download them — the API filters every query by your user id. When you apply to a drive,
        only a <strong>checklist of which categories you have</strong> travels with the application, never the files
        themselves.
      </Callout>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={FolderLock} label="Items" value={docs.length} sub={`${files.length} files · ${links.length} links`} tone="violet" />
        <StatCard icon={Upload} label="Storage used" value={humanSize(totalSize) || '0 KB'} sub="5 MB max per file" tone="cyan" delay={0.06} />
        <StatCard icon={CheckCircle2} label="Categories covered" value={`${byCategory.filter((c) => c.count > 0).length}/${CATEGORIES.length}`} sub="Breadth of your wallet" tone="mint" delay={0.12} />
        <StatCard icon={Award} label="Proof of work" value={proof?.items?.length ?? proof?.proofs?.length ?? 0} sub="Milestone submissions" tone="amber" delay={0.18} />
      </div>

      {/* per-opportunity checklist */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader
          icon={Briefcase}
          title="Check my wallet against a drive"
          subtitle="See exactly what is missing before you apply"
          className="mb-4"
        />
        <div className="flex gap-2.5 flex-wrap items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="label" htmlFor="oppSel">Opportunity</label>
            <select id="oppSel" className="input" value={checkOpp} onChange={(e) => runChecklist(e.target.value)}>
              <option value="">Select a drive…</option>
              {opportunities.map((o) => (
                <option key={o._id} value={o._id}>{o.title} — {o.company}</option>
              ))}
            </select>
          </div>
          {checkOpp && (
            <Link to={`/opportunities/${checkOpp}`} className="btn-secondary">
              <ExternalLink size={14} /> Open drive
            </Link>
          )}
        </div>

        <AnimatePresence>
          {checklist?.checklist && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <ProgressBar
                  value={(checklist.checklist.filter((c) => c.satisfied).length / checklist.checklist.length) * 100}
                  tone={checklist.checklist.every((c) => c.satisfied) ? 'mint' : 'amber'}
                  className="mb-3.5"
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  {checklist.checklist.map((c) => (
                    <div
                      key={c.label}
                      className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] border ${
                        c.satisfied
                          ? 'text-emerald-200 bg-emerald-400/[0.055] border-emerald-400/18'
                          : 'text-amber-200 bg-amber-400/[0.05] border-amber-400/18'
                      }`}
                    >
                      {c.satisfied ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-400 shrink-0" />
                      )}
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </MotionCard>

      {/* filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input className="input pl-10" placeholder="Search your wallet…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
              filter === 'all' ? 'border-orbit-violet/50 bg-orbit-violet/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
            }`}
          >
            All ({docs.length})
          </button>
          {byCategory.filter((c) => c.count > 0).map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                filter === c.key ? 'border-orbit-violet/50 bg-orbit-violet/15 text-white' : 'border-white/10 text-slate-400 hover:border-white/25'
              }`}
            >
              <c.icon size={12} /> {c.label} ({c.count})
            </button>
          ))}
        </div>
      </div>

      {/* documents grid */}
      {filtered.length === 0 ? (
        <MotionCard hover={false} className="p-8">
          <EmptyState
            icon={FolderLock}
            title={docs.length ? 'Nothing matches' : 'Your wallet is empty'}
            description={
              docs.length
                ? 'Try a different search or category.'
                : 'Upload your marksheet, photograph and certificates once. Every drive checklist then fills itself in.'
            }
            action={!docs.length && <button onClick={() => setUploadOpen(true)} className="btn-primary"><Upload size={15} /> Upload your first file</button>}
          />
        </MotionCard>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((d, i) => {
              const meta = catMeta(d.category);
              const Icon = d.kind === 'link' ? Link2 : meta.icon;
              return (
                <motion.div
                  key={d._id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  whileHover={{ y: -4 }}
                  className="glass p-4 group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                      <Icon size={17} className="text-orbit-violet" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-slate-100 truncate">{d.label}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {d.kind === 'file'
                          ? `${d.fileName} · ${humanSize(d.sizeBytes)}`
                          : (d.url || '').replace(/^https?:\/\/(www\.)?/, '')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <Badge tone="slate">{d.kind}</Badge>
                    {d.verified && <Badge tone="mint" icon={ShieldCheck}>Verified</Badge>}
                  </div>

                  {d.notes && (
                    <p className="text-[11.5px] text-slate-400 leading-relaxed line-clamp-2 mb-3 italic border-l-2 border-white/10 pl-2.5">
                      {d.notes}
                    </p>
                  )}

                  <p className="text-[10.5px] text-slate-600 mb-3">Added {timeAgo(d.createdAt)}</p>

                  <div className="flex gap-1.5">
                    {d.kind === 'file' ? (
                      <a
                        href={documentAPI.downloadUrl(d._id)}
                        className="btn-secondary btn-sm flex-1"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <Download size={13} /> Download
                      </a>
                    ) : (
                      <a href={d.url} target="_blank" rel="noreferrer noopener" className="btn-secondary btn-sm flex-1">
                        <ExternalLink size={13} /> Open
                      </a>
                    )}
                    <button
                      onClick={() => setDeleting(d)}
                      className="btn-secondary btn-sm p-2 hover:text-rose-400"
                      aria-label="Delete document"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* proof of work */}
      {(proof?.items?.length > 0 || proof?.proofs?.length > 0) && (
        <MotionCard hover={false} className="p-5">
          <SectionHeader
            icon={Award}
            title="Proof of work from your path"
            subtitle="Milestone proof links you submitted — recruiters love these"
            className="mb-4"
          />
          <div className="grid sm:grid-cols-2 gap-2.5">
            {(proof.items || proof.proofs || []).map((p, i) => (
              <a
                key={i}
                href={p.proofUrl || p.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 hover:border-orbit-cyan/30 transition-all"
              >
                <Award size={15} className="text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-100 truncate">{p.title || p.milestoneTitle}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {(p.proofUrl || p.url || '').replace(/^https?:\/\/(www\.)?/, '')}
                  </p>
                </div>
                <ExternalLink size={13} className="text-slate-500 shrink-0" />
              </a>
            ))}
          </div>
        </MotionCard>
      )}

      {/* --------------------------------------------------- upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a document"
        subtitle="PDF, DOC, DOCX, PNG, JPG or WebP up to 5 MB"
        icon={Upload}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setUploadOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={doUpload} disabled={busy || !uploadForm.file}>
              {busy ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={15} /> Upload</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-7 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-orbit-violet/60 bg-orbit-violet/[0.08]'
                : uploadForm.file
                ? 'border-emerald-400/40 bg-emerald-400/[0.05]'
                : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {uploadForm.file ? (
              <>
                <CheckCircle2 size={26} className="text-emerald-400 mx-auto mb-2.5" />
                <p className="text-[13.5px] font-semibold text-slate-100">{uploadForm.file.name}</p>
                <p className="text-[11.5px] text-slate-400 mt-1">{humanSize(uploadForm.file.size)} — click to choose a different file</p>
              </>
            ) : (
              <>
                <Upload size={26} className="text-slate-500 mx-auto mb-2.5" />
                <p className="text-[13.5px] font-semibold text-slate-200">Drop a file here or click to browse</p>
                <p className="text-[11.5px] text-slate-500 mt-1">PDF, DOC, DOCX, PNG, JPG, WebP · max 5 MB</p>
              </>
            )}
          </div>

          <div>
            <label className="label" htmlFor="dlabel">Label</label>
            <input
              id="dlabel"
              className="input"
              placeholder="e.g. Semester 5 marksheet"
              value={uploadForm.label}
              onChange={(e) => setUploadForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="dcat">Category</label>
            <select
              id="dcat"
              className="input"
              value={uploadForm.category}
              onChange={(e) => setUploadForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1.5">
              The category is what drive checklists match against — pick it carefully.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="dnotes">Notes (optional)</label>
            <textarea
              id="dnotes"
              className="input min-h-[70px] resize-y"
              placeholder="Anything you want to remember about this document"
              value={uploadForm.notes}
              onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ----------------------------------------------------- link modal */}
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Add a link"
        subtitle="GitHub repos, deployed projects, coding profiles, certificate URLs"
        icon={Link2}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setLinkOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={doAddLink} disabled={busy}>
              {busy ? <Spinner size={14} /> : <Plus size={15} />} Save link
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="llabel">Label</label>
            <input
              id="llabel"
              className="input"
              placeholder="e.g. CampusOrbit repo"
              value={linkForm.label}
              onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="lurl">URL</label>
            <input
              id="lurl"
              className="input"
              placeholder="https://github.com/you/project"
              value={linkForm.url}
              onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="lcat">Category</label>
            <select
              id="lcat"
              className="input"
              value={linkForm.category}
              onChange={(e) => setLinkForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lnotes">Notes (optional)</label>
            <textarea
              id="lnotes"
              className="input min-h-[70px] resize-y"
              value={linkForm.notes}
              onChange={(e) => setLinkForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Remove from wallet?"
        message={`"${deleting?.label}" will be deleted permanently${deleting?.kind === 'file' ? ', including the stored file' : ''}.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
