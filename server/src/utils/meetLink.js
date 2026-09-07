/**
 * Google Meet link validation.
 *
 * Meet codes look like  xxx-yyyy-zzz  (3-4-3 lowercase letters).
 * We accept the canonical https://meet.google.com/abc-defg-hij form and the
 * dial-in/lookup variants, and we normalise everything to a canonical URL.
 *
 * We deliberately do NOT accept arbitrary URLs: a "meeting link" that silently
 * points somewhere else is a phishing vector inside a student community.
 */

const MEET_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function parseMeetLink(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'Paste a Google Meet link' };
  }

  let raw = input.trim();
  if (!raw) return { valid: false, reason: 'Paste a Google Meet link' };

  // Bare code, e.g. "abc-defg-hij"
  if (MEET_CODE.test(raw.toLowerCase())) {
    const code = raw.toLowerCase();
    return { valid: true, code, url: `https://meet.google.com/${code}` };
  }

  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { valid: false, reason: 'That does not look like a valid URL' };
  }

  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    return { valid: false, reason: 'Link must start with https://' };
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const allowedHosts = ['meet.google.com', 'g.co'];
  if (!allowedHosts.includes(host)) {
    return {
      valid: false,
      reason: 'Only Google Meet links are allowed (meet.google.com/…)',
    };
  }

  // https://g.co/meet/xyz  — Google's short form
  if (host === 'g.co') {
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg[0] !== 'meet' || !seg[1]) {
      return { valid: false, reason: 'Only Google Meet links are allowed' };
    }
    return { valid: true, code: seg[1], url: `https://g.co/meet/${seg[1]}` };
  }

  // https://meet.google.com/lookup/<alias>  — named meetings
  const segments = u.pathname.split('/').filter(Boolean);
  if (segments[0] === 'lookup' && segments[1]) {
    return {
      valid: true,
      code: segments[1],
      url: `https://meet.google.com/lookup/${segments[1]}`,
    };
  }

  const code = (segments[0] || '').toLowerCase();
  if (!code) {
    return { valid: false, reason: 'Meet link is missing its meeting code' };
  }
  if (!MEET_CODE.test(code)) {
    return {
      valid: false,
      reason: 'Meeting code should look like abc-defg-hij',
    };
  }

  return { valid: true, code, url: `https://meet.google.com/${code}` };
}

export const isValidMeetLink = (v) => parseMeetLink(v).valid;
