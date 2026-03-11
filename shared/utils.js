/**
 * Extract Google Meet URL from a calendar event.
 */
export function extractMeetUrl(event) {
  if (event.hangoutLink) return event.hangoutLink;

  const meetPattern = /https:\/\/meet\.google\.com\/[a-z]+-[a-z]+-[a-z]+/i;

  if (event.conferenceData?.entryPoints) {
    for (const ep of event.conferenceData.entryPoints) {
      if (ep.entryPointType === 'video' && ep.uri) return ep.uri;
    }
  }

  for (const field of [event.description, event.location]) {
    if (field) {
      const match = field.match(meetPattern);
      if (match) return match[0];
    }
  }

  return null;
}

/**
 * Validate that a URL is a legitimate Google Meet URL.
 * Returns the URL string if valid, null otherwise.
 */
export function validateMeetUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.hostname !== 'meet.google.com') return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize an Akashi URL.
 * Only allows HTTPS URLs on *.ak4.jp domains.
 * Returns the origin if valid, default URL otherwise.
 */
export function validateAkashiUrl(url) {
  const DEFAULT = 'https://atnd.ak4.jp';
  if (!url) return DEFAULT;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return DEFAULT;
    if (!parsed.hostname.endsWith('.ak4.jp')) return DEFAULT;
    return parsed.origin;
  } catch {
    return DEFAULT;
  }
}

/**
 * Check if a date string is today (local time).
 */
export function isToday(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

/**
 * Format time as HH:MM.
 */
export function formatTime(dateString) {
  const d = new Date(dateString);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get today's date string as YYYY-MM-DD.
 */
export function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
