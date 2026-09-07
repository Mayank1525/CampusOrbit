/** Format seconds as m:ss or h:mm:ss */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatDate(date, opts = {}) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - Date.now()) / 86400000);
}

export function deadlineLabel(date) {
  const d = daysUntil(date);
  if (d === null) return { text: '—', tone: 'slate' };
  if (d < 0) return { text: 'Closed', tone: 'slate' };
  if (d === 0) return { text: 'Closes today', tone: 'coral' };
  if (d === 1) return { text: '1 day left', tone: 'coral' };
  if (d <= 5) return { text: `${d} days left`, tone: 'coral' };
  if (d <= 14) return { text: `${d} days left`, tone: 'amber' };
  return { text: `${d} days left`, tone: 'mint' };
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : plural || `${singular}s`}`;
}

export function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

/** Extract a YouTube video ID client-side (mirrors the server util). */
export function extractYouTubeId(input) {
  if (!input) return null;
  const value = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  return null;
}

export const STAGE_COLORS = {
  Saved: 'slate',
  Preparing: 'amber',
  Applied: 'cyan',
  Shortlisted: 'violet',
  Assessment: 'violet',
  'Technical Round': 'violet',
  'HR Round': 'violet',
  Selected: 'mint',
  Rejected: 'coral',
};

export const TYPE_META = {
  placement: { label: 'Placement', color: 'violet', icon: 'briefcase' },
  internship: { label: 'Internship', color: 'cyan', icon: 'graduation-cap' },
  hackathon: { label: 'Hackathon', color: 'coral', icon: 'zap' },
  scholarship: { label: 'Scholarship', color: 'amber', icon: 'award' },
  exam: { label: 'Exam', color: 'mint', icon: 'file-text' },
};

export function scoreTone(score) {
  if (score >= 75) return 'mint';
  if (score >= 50) return 'cyan';
  if (score >= 25) return 'amber';
  return 'coral';
}

/** Respect the user's reduced-motion preference. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ');
}
