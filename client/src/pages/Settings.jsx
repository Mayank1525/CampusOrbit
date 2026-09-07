import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Sparkles, Server, Database, Shield, Info, LogOut,
  Eye, Zap, Languages, Bell, CheckCircle2, XCircle, ExternalLink, User,
  Github, Cpu, Radio, Palette, Accessibility,
} from 'lucide-react';
import { noteAPI, userAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../hooks/useSocket';
import {
  PageHeader, LoadingScreen, Badge, MotionCard, Spinner, Callout,
  SectionHeader, Toggle,
} from '../components/ui/Primitives';
import { ConfirmModal } from '../components/ui/Modal';

const PREF_KEY = 'campusorbit.prefs';

const loadPrefs = () => {
  try {
    return { reduceMotion: false, compactMode: false, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
  } catch {
    return { reduceMotion: false, compactMode: false };
  }
};

export default function Settings() {
  const { user, logout, updateProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { connected } = useSocket(true);

  const [ai, setAi] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [a, h] = await Promise.all([
          noteAPI.aiStatus().catch(() => null),
          fetch('/api/health').then((r) => r.json()).then((j) => j.data).catch(() => null),
        ]);
        setAi(a?.ai || a);
        setHealth(h);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setPref = (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
    document.documentElement.classList.toggle('reduce-motion', next.reduceMotion);
    document.documentElement.classList.toggle('compact', next.compactMode);
    toast.success('Preference saved');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
    document.documentElement.classList.toggle('compact', prefs.compactMode);
  }, [prefs]);

  const setLanguage = async (lang) => {
    setSavingLang(true);
    try {
      await updateProfile({ profile: { preferredLanguage: lang } });
      toast.success(`Explanations will open in ${lang} first`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingLang(false);
    }
  };

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) return <LoadingScreen label="Loading settings…" />;

  const aiConfigured = ai?.configured;

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Preferences, system status and an honest account of what this build can and cannot do."
      />

      {/* AI honesty */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader
          icon={Sparkles}
          title="AI status"
          subtitle="What is actually generating your notes, quizzes and feedback"
          className="mb-4"
        />

        <div
          className={`rounded-xl border p-4 mb-4 ${
            aiConfigured ? 'border-emerald-400/28 bg-emerald-400/[0.06]' : 'border-amber-400/28 bg-amber-400/[0.06]'
          }`}
        >
          <div className="flex items-start gap-3">
            {aiConfigured ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <p className="text-[14px] font-bold text-white">{ai?.label || 'Demo AI Mode'}</p>
                <Badge tone={aiConfigured ? 'mint' : 'amber'}>{ai?.mode || 'demo'}</Badge>
                {ai?.provider && ai.provider !== 'none' && <Badge tone="slate">{ai.provider}</Badge>}
              </div>
              <p className="text-[13px] text-slate-300 leading-relaxed">{ai?.notice}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 text-[13px] text-slate-400 leading-relaxed">
          <p>
            <strong className="text-slate-200">What "Demo AI Mode" means:</strong> no API key is configured, so every
            "AI" output — smart notes, flashcards, quizzes, interview feedback, room summaries — is produced by a
            deterministic rule engine written in plain JavaScript. It extracts key terms, builds definitions, scores
            keyword coverage and sentence structure. It is repeatable and genuinely useful for practice.
          </p>
          <p>
            <strong className="text-slate-200">What it is not:</strong> a language model. CampusOrbit will never label
            rule-engine output as live AI. Set <code className="px-1.5 py-0.5 rounded bg-white/[0.07] text-orbit-cyan text-[12px] font-mono">GEMINI_API_KEY</code> in{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/[0.07] text-orbit-cyan text-[12px] font-mono">server/.env</code>{' '}
            and restart to switch the label and the behaviour.
          </p>
          <p>
            <strong className="text-slate-200">Transcript policy:</strong> AI notes can only be generated from
            transcripts an admin has explicitly marked as authorised. The API rejects generation on any lesson without
            one — CampusOrbit does not scrape YouTube transcripts.
          </p>
        </div>
      </MotionCard>

      {/* system status */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={Server} title="System status" subtitle="Live checks against the running backend" className="mb-4" />
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            {
              icon: Server, label: 'API server',
              value: health?.status === 'healthy' ? 'Healthy' : 'Unreachable',
              ok: health?.status === 'healthy',
              sub: health?.env ? `${health.env} mode` : '',
            },
            {
              icon: Database, label: 'MongoDB',
              value: health?.status === 'healthy' ? 'Connected' : 'Unknown',
              ok: health?.status === 'healthy',
              sub: 'Mongoose — the only persistence layer',
            },
            {
              icon: Radio, label: 'Socket.IO',
              value: connected ? 'Connected' : 'Disconnected',
              ok: connected,
              sub: 'Peer rooms & watch together',
            },
            {
              icon: Cpu, label: 'AI provider',
              value: aiConfigured ? 'Configured' : 'Demo fallback',
              ok: aiConfigured,
              sub: ai?.provider === 'none' ? 'No key set' : ai?.provider,
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.ok ? 'bg-emerald-400/12' : 'bg-amber-400/12'}`}>
                <s.icon size={16} className={s.ok ? 'text-emerald-400' : 'text-amber-400'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-slate-100">{s.label}</p>
                <p className="text-[11px] text-slate-500 truncate">{s.sub}</p>
              </div>
              <span className={`text-[11.5px] font-bold shrink-0 ${s.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
                {s.value}
              </span>
            </motion.div>
          ))}
        </div>
        {health?.time && (
          <p className="text-[11px] text-slate-600 mt-3">
            Last checked {new Date(health.time).toLocaleString('en-IN')}
          </p>
        )}
      </MotionCard>

      {/* preferences */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={Palette} title="Interface preferences" subtitle="Stored in your browser" className="mb-4" />
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.05]">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-100 flex items-center gap-2">
                <Accessibility size={14} className="text-orbit-cyan" /> Reduce motion
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                Disables the 3D orbit auto-rotation, particle drift and spring transitions. CampusOrbit also honours
                your OS-level <code className="text-[11px] font-mono text-slate-400">prefers-reduced-motion</code> setting.
              </p>
            </div>
            <Toggle checked={prefs.reduceMotion} onChange={(v) => setPref('reduceMotion', v)} />
          </div>

          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-100 flex items-center gap-2">
                <Eye size={14} className="text-orbit-violet" /> Compact density
              </p>
              <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                Tightens padding across cards and lists so more fits on smaller laptop screens.
              </p>
            </div>
            <Toggle checked={prefs.compactMode} onChange={(v) => setPref('compactMode', v)} />
          </div>
        </div>
      </MotionCard>

      {/* language */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={Languages} title="Explanation language" subtitle="Which version of a Smart Note opens first" className="mb-4" />
        <div className="grid grid-cols-3 gap-2">
          {['English', 'Hindi', 'Hinglish'].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              disabled={savingLang}
              className={`rounded-xl border px-3 py-3 text-[13px] font-semibold transition-all ${
                user?.profile?.preferredLanguage === l
                  ? 'border-orbit-violet/60 bg-orbit-violet/12 text-white'
                  : 'border-white/10 text-slate-400 hover:border-white/25'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-slate-500 mt-3">
          Every Smart Note ships with English, beginner-level and Hinglish versions regardless of this setting — it
          only chooses the default tab.
        </p>
      </MotionCard>

      {/* account */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={User} title="Account" className="mb-4" />
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-slate-100">{user?.fullName}</p>
              <p className="text-[12px] text-slate-500">{user?.email} · {user?.role}</p>
            </div>
            <Link to="/profile" className="btn-secondary btn-sm"><User size={13} /> Edit profile</Link>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-400/18 bg-rose-400/[0.04] px-4 py-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-rose-200">Sign out</p>
              <p className="text-[12px] text-slate-500">Clears your session cookie on this device.</p>
            </div>
            <button onClick={() => setLogoutOpen(true)} className="btn-danger btn-sm"><LogOut size={13} /> Sign out</button>
          </div>
        </div>
      </MotionCard>

      {/* limitations */}
      <MotionCard hover={false} className="p-5">
        <SectionHeader icon={Shield} title="Known limitations" subtitle="Stated up front, not buried" className="mb-4" />
        <ul className="space-y-2.5 text-[13px] text-slate-400 leading-relaxed">
          {[
            'No video or audio calls, no WebRTC, no direct messages. Peer Rooms are structured group chat only — this is a deliberate scope decision.',
            'No payments, subscriptions or paid tiers anywhere in the product.',
            'Watch Together synchronises YouTube playback via Socket.IO with drift correction, but it cannot control a viewer who has the video muted or blocked by an ad — hit Re-sync in that case.',
            'Video progress is tracked by polling the YouTube IFrame API every few seconds, so the last few seconds before you close a tab may not persist.',
            'CampusOrbit deliberately never estimates your probability of being selected for a job. The preparation score measures what you have completed, nothing more.',
            'AI features run in Demo Mode without an API key and are labelled as such everywhere they appear.',
            'File uploads are capped at 5 MB and stored on the server filesystem, not object storage.',
          ].map((l, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="text-orbit-violet mt-1 shrink-0">▸</span> {l}
            </li>
          ))}
        </ul>
      </MotionCard>

      <ConfirmModal
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={doLogout}
        title="Sign out of CampusOrbit?"
        message="Your progress, notes and applications are stored in MongoDB and will be exactly where you left them when you sign back in."
        confirmLabel="Sign out"
        danger
      />
    </div>
  );
}
