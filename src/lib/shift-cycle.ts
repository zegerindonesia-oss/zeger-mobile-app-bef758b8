// One shift = one closed stock cycle (receive → sell → return). All dates in Asia/Jakarta.
export const jakartaDate = (iso: string | Date): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

/** Parses shift time values that may be full ISO timestamps or bare "HH:mm[:ss]" (Jakarta-local). */
export const shiftTimeMs = (value: string | null | undefined, shiftDate: string): number | null => {
  if (!value) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) {
    const [h, m, s = '00'] = value.split(':');
    const t = new Date(`${shiftDate}T${h.padStart(2, '0')}:${m}:${s}+07:00`).getTime();
    return isNaN(t) ? null : t;
  }
  const t = new Date(value).getTime();
  return isNaN(t) ? null : t;
};

export interface ShiftLike { id: string; rider_id: string; shift_date: string; shift_number?: number | null; shift_start_time?: string | null; shift_end_time?: string | null }

/** Builds a picker that assigns an event timestamp to exactly one shift of that rider on that Jakarta day. */
export const buildShiftPicker = <T extends ShiftLike>(shifts: T[]) => {
  const byKey: Record<string, { s: T; start: number; end: number | null }[]> = {};
  shifts.forEach(s => {
    const k = `${s.rider_id}-${s.shift_date}`;
    (byKey[k] ||= []).push({ s, start: shiftTimeMs(s.shift_start_time, s.shift_date) ?? 0, end: shiftTimeMs(s.shift_end_time, s.shift_date) });
  });
  Object.values(byKey).forEach(arr => arr.sort((a, b) => (a.start - b.start) || ((a.s.shift_number || 0) - (b.s.shift_number || 0))));
  return (riderId: string, whenISO: string | null | undefined): T | null => {
    if (!whenISO) return null;
    const arr = byKey[`${riderId}-${jakartaDate(whenISO)}`];
    if (!arr?.length) return null;
    const t = new Date(whenISO).getTime();
    // 1) shift whose window contains the event
    const inside = arr.find(x => x.start <= t && (x.end === null || t <= x.end + 5 * 60_000));
    if (inside) return inside.s;
    // 2) latest shift that started before the event; else first shift of the day
    let chosen = arr[0];
    for (const x of arr) if (x.start <= t) chosen = x;
    return chosen.s;
  };
};
