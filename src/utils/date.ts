// Centralised date handling — the whole app operates in Pakistan Standard Time
// (Asia/Karachi, UTC+5, no daylight saving) regardless of the device's timezone.

export const APP_TIMEZONE = 'Asia/Karachi';

// Formats a Date to YYYY-MM-DD in PKT.
const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Pakistan, as "YYYY-MM-DD". */
export function todayYMD(): string {
  return ymdFormatter.format(new Date());
}

/** The current year-month in Pakistan, as "YYYY-MM". */
export function currentMonth(): string {
  return todayYMD().slice(0, 7);
}

/** Any Date / timestamp / ISO string -> "YYYY-MM-DD" in PKT. */
export function toYMD(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return ymdFormatter.format(date);
}

/** Shift a "YYYY-MM-DD" string by a number of days (pure calendar math, no TZ drift). */
export function shiftYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().split('T')[0];
}

/** Turn a "YYYY-MM-DD" (or full timestamp) into a Date anchored so PKT shows the same day. */
function anchoredDate(value: string | Date | number): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Noon UTC = 5pm PKT — same calendar day in Pakistan, immune to TZ drift.
    return new Date(value + 'T12:00:00Z');
  }
  return value instanceof Date ? value : new Date(value);
}

/** Format a date value for display, always in PKT. */
export function formatDate(
  value: string | Date | number,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const date = anchoredDate(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: APP_TIMEZONE, ...opts });
}

/** The last `count` months (incl. current), newest first, as {value:"YYYY-MM", label:"Mon YYYY"} — anchored to PKT. */
export function recentMonths(count: number): { value: string; label: string }[] {
  const [y0, m0] = todayYMD().split('-').map(Number); // m0 is 1-12
  let y = y0, m = m0;
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ value, label: formatDate(`${value}-01`, { month: 'short', year: 'numeric' }) });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

/** Format a full timestamp (e.g. created_at) as date + time in PKT. */
export function formatDateTime(
  value: string | Date | number,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
): string {
  let date: Date;
  if (typeof value === 'string') {
    // A bare "YYYY-MM-DD HH:MM:SS" (e.g. SQLite CURRENT_TIMESTAMP) has no zone — it's UTC.
    const bare = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value.trim());
    date = new Date(bare ? value.trim().replace(' ', 'T') + 'Z' : value);
  } else {
    date = value instanceof Date ? value : new Date(value);
  }
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { timeZone: APP_TIMEZONE, ...opts });
}
