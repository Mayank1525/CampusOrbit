import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Orbit, Compass, PlayCircle, Briefcase, FileText, MessagesSquare, Sparkles,
  ArrowRight, CheckCircle2, Target, Repeat, ShieldCheck, Mic, BarChart3, Layers,
} from 'lucide-react';
import StarField, { AuroraBlobs } from '../components/three/StarField';
import { Badge } from '../components/ui/Primitives';

const FEATURES = [
  {
    icon: Compass,
    title: 'Path Navigator',
    body: 'Answer four questions, get exactly ONE path. No 40-tab roadmap, no playlist graveyard.',
    tone: 'violet',
  },
  {
    icon: Orbit,
    title: '3D Learning Orbit',
    body: 'Your milestones orbit a core star. Completed nodes glow, the current one pulses, the rest stay locked.',
    tone: 'cyan',
  },
  {
    icon: PlayCircle,
    title: 'One curated video per topic',
    body: 'A human-verified primary video per lesson with a written reason for the pick. Watch it, do the quiz, move on.',
    tone: 'coral',
  },
  {
    icon: Repeat,
    title: 'Spaced revision 1 / 7 / 21',
    body: 'Completing a topic auto-schedules revision. Reschedule when life happens; nothing silently disappears.',
    tone: 'mint',
  },
  {
    icon: Briefcase,
    title: 'Placement Hub',
    body: 'Browse drives Indeed-style. Eligibility is explained in plain English — every rule, pass or fail.',
    tone: 'amber',
  },
  {
    icon: FileText,
    title: 'Resume Studio',
    body: 'Four templates, live preview, switch without losing data, versions, and a real PDF download.',
    tone: 'violet',
  },
  {
    icon: Mic,
    title: 'Interview Practice',
    body: 'Text-only. Structured feedback on accuracy, clarity, structure and missing concepts — with history.',
    tone: 'cyan',
  },
  {
    icon: MessagesSquare,
    title: 'Peer Prep Rooms',
    body: 'Group chat with pins, reactions and Watch Together — a synchronised video for the whole room.',
    tone: 'coral',
  },
];

const STEPS = [
  { n: '01', title: 'Tell us your goal', body: 'Placement, internship, GATE, or a specific stack. Plus your level, hours and timeline.' },
  { n: '02', title: 'Get one path', body: 'The navigator explains why it picked that path, and how many lessons per week you need.' },
  { n: '03', title: 'Do three things a day', body: "Today's Orbit shows at most three tasks. Revision, one lesson, one deadline. That's it." },
  { n: '04', title: 'Turn prep into proof', body: 'Proof tasks, resume, documents and applications all live in one place when the drive opens.' },
];

const TONE_MAP = {
  violet: 'from-orbit-violet/22 text-orbit-violet border-orbit-violet/25',
  cyan: 'from-cyan-400/22 text-cyan-300 border-cyan-400/25',
  coral: 'from-rose-400/22 text-rose-300 border-rose-400/25',
  mint: 'from-emerald-400/22 text-emerald-300 border-emerald-400/25',
  amber: 'from-amber-400/22 text-amber-300 border-amber-400/25',
};

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <StarField density={0.00016} />

      {/* ------------------------------------------------------------- nav */}
      <header className="relative z-20 border-b border-white/[0.06] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9">
              <motion.div
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-cyan blur-[7px] opacity-75"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 3.4, repeat: Infinity }}
              />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-orbit-violet to-orbit-indigo flex items-center justify-center border border-white/15">
                <Orbit size={19} className="text-white" />
              </div>
            </div>
            <p className="text-[15px] font-bold text-white font-display">
              Campus<span className="text-gradient">Orbit</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">
              Get started <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section className="relative z-10 px-5 pt-16 pb-24 sm:pt-24">
        <AuroraBlobs />
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge tone="violet" icon={Sparkles} className="mb-6">
              Built for Indian students preparing for placements, internships & exams
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white font-display tracking-tight leading-[1.05] text-balance"
          >
            From <span className="text-slate-500 line-through decoration-rose-400/60 decoration-4">confusion</span>
            <br />
            to <span className="text-gradient-animate">career-ready</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed text-balance"
          >
            You do not have a resource problem. You have a <span className="text-slate-200 font-medium">sequence</span> problem.
            CampusOrbit gives you one path, one video per topic, three tasks a day — and connects that preparation
            straight to the drives on your campus.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/register" className="btn-primary px-6 py-3 text-base">
              Start your orbit <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn-secondary px-6 py-3 text-base">
              Try the demo account
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 text-xs text-slate-500"
          >
            Demo login · <code className="text-slate-300">student@campusorbit.dev</code> / <code className="text-slate-300">Student@123</code>
          </motion.div>

          {/* Honest-AI banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
            className="mt-12 inline-flex items-start gap-3 text-left rounded-xl border border-cyan-400/22 bg-cyan-400/[0.06] px-4 py-3 max-w-2xl"
          >
            <ShieldCheck size={17} className="text-cyan-300 shrink-0 mt-0.5" />
            <p className="text-[13px] text-cyan-100/85 leading-relaxed">
              <strong className="text-cyan-200">Honest by design.</strong> Without an AI key configured, every AI
              feature is clearly labelled <em>Demo AI Mode</em> and serves curated fallbacks. We never dress up
              canned text as live model output, and we never scrape transcripts we are not authorised to use.
            </p>
          </motion.div>
        </div>

        {/* ------------------------------------------------- orbit preview */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="relative max-w-4xl mx-auto mt-16"
        >
          <div className="gradient-border p-5 sm:p-8">
            <div className="relative h-[300px] sm:h-[360px] flex items-center justify-center">
              {/* Pure-CSS/SVG orbit teaser — the real R3F canvas lives inside the app */}
              <div className="absolute inset-0 flex items-center justify-center">
                {[1, 2, 3, 4].map((r) => (
                  <motion.div
                    key={r}
                    className="absolute rounded-full border border-orbit-violet/18"
                    style={{ width: r * 88, height: r * 88 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 26 + r * 9, repeat: Infinity, ease: 'linear' }}
                  >
                    <span
                      className="absolute rounded-full"
                      style={{
                        width: r <= 2 ? 13 : 10,
                        height: r <= 2 ? 13 : 10,
                        top: -6,
                        left: '50%',
                        marginLeft: -6,
                        background: r === 1 ? '#34d399' : r === 2 ? '#22d3ee' : r === 3 ? '#7c5cff' : '#39406b',
                        boxShadow: r <= 3 ? `0 0 16px ${r === 1 ? '#34d399' : r === 2 ? '#22d3ee' : '#7c5cff'}` : 'none',
                      }}
                    />
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="relative w-24 h-24 rounded-full bg-gradient-to-br from-orbit-violet to-orbit-cyan flex items-center justify-center"
                animate={{ scale: [1, 1.06, 1], boxShadow: ['0 0 36px rgba(124,92,255,0.5)', '0 0 62px rgba(124,92,255,0.85)', '0 0 36px rgba(124,92,255,0.5)'] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="text-center">
                  <p className="text-2xl font-bold text-white font-display leading-none">42%</p>
                  <p className="text-[8px] uppercase tracking-widest text-white/70 mt-1">path done</p>
                </div>
              </motion.div>
            </div>
            <div className="flex items-center justify-center gap-5 mt-4 flex-wrap">
              {[
                { c: '#34d399', l: 'Completed' },
                { c: '#7c5cff', l: 'Current focus' },
                { c: '#39406b', l: 'Locked' },
              ].map((x) => (
                <span key={x.l} className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: x.c, boxShadow: `0 0 8px ${x.c}` }} />
                  {x.l}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* --------------------------------------------------------- steps */}
      <section className="relative z-10 px-5 py-20 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge tone="cyan" icon={Target} className="mb-4">How it works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-display">Four steps. Then just show up.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.09 }}
                whileHover={{ y: -6 }}
                className="glass p-5 relative overflow-hidden group"
              >
                <div className="absolute -top-6 -right-3 text-[76px] font-bold text-white/[0.035] font-display select-none group-hover:text-orbit-violet/10 transition-colors">
                  {s.n}
                </div>
                <p className="relative text-xs font-bold text-orbit-cyan tracking-widest mb-2.5">{s.n}</p>
                <h3 className="relative text-base font-bold text-white mb-2">{s.title}</h3>
                <p className="relative text-[13px] text-slate-400 leading-relaxed">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ features */}
      <section className="relative z-10 px-5 py-20 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge tone="violet" icon={Layers} className="mb-4">Everything in one orbit</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-display mb-3">
              Learning, proof and placement — connected
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Most students juggle a playlist app, a spreadsheet, a resume builder and a WhatsApp group.
              CampusOrbit is the single loop where preparation actually turns into an application.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.07 }}
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                className="glass p-5 group"
              >
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br to-transparent border flex items-center justify-center mb-3.5 transition-transform group-hover:scale-110 ${TONE_MAP[f.tone]}`}
                >
                  <f.icon size={20} />
                </div>
                <h3 className="text-[15px] font-bold text-white mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-slate-400 leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- honesty section */}
      <section className="relative z-10 px-5 py-20 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="gradient-border p-7 sm:p-10">
            <Badge tone="mint" icon={ShieldCheck} className="mb-5">What CampusOrbit will never do</Badge>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
              {[
                'Predict your "chance of selection" — we show a preparation score, never a job probability.',
                'Claim AI output when the AI is not configured — it says Demo AI Mode, honestly.',
                'Scrape transcripts we are not authorised to use for note generation.',
                'Show your private wallet documents to other students. Ever.',
                'Offer video or audio calls. Peer Rooms are structured group chat only.',
                'Give you a dead button, a fake download, or a placeholder dashboard.',
              ].map((t) => (
                <div key={t} className="flex gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-slate-300 leading-relaxed">{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- CTA */}
      <section className="relative z-10 px-5 py-24 border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto text-center">
          <BarChart3 size={34} className="mx-auto text-orbit-violet mb-5" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-display mb-4">
            Stop collecting playlists. Start finishing one.
          </h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Create an account, answer four questions, and your orbit is live in under a minute.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/register" className="btn-primary px-7 py-3 text-base">
              Create free account <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn-secondary px-7 py-3 text-base">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>CampusOrbit — a MERN student platform. MongoDB · Express · React · Node.</p>
          <p>No video calls · No payments · No DMs · Your data stays in your MongoDB.</p>
        </div>
      </footer>
    </div>
  );
}
