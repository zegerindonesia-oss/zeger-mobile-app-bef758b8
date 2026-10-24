/** Store operating hours (Asia/Jakarta). Times are "HH:MM"; close may pass midnight. */
export const DEFAULT_OPEN = '07:00';
export const DEFAULT_CLOSE = '22:00';

const toMin = (t: string) => {
  const [h, m] = (t || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Minutes since midnight in Jakarta for the given instant. */
export const jakartaMinutes = (d: Date = new Date()) => {
  const utc = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (utc + 7 * 60) % 1440;
};

export function isStoreOpen(open = DEFAULT_OPEN, close = DEFAULT_CLOSE, now: Date = new Date()) {
  const o = toMin(open), c = toMin(close), n = jakartaMinutes(now);
  if (o === c) return true;
  return o < c ? n >= o && n < c : n >= o || n < c;
}
