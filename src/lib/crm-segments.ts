export type Segment = 'vip' | 'loyal' | 'at_risk' | 'dormant' | 'new' | 'prospect';

export interface CrmCustomerLike {
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
}

export const SEGMENT_LABEL: Record<Segment, string> = {
  vip: 'VIP / Champion',
  loyal: 'Loyal',
  at_risk: 'Berisiko Hilang',
  dormant: 'Tidur (>60 hari)',
  new: 'Baru',
  prospect: 'Belum Belanja',
};

const DAY = 86_400_000;

/** RFM-style segment: recency (days since last order), frequency (orders), monetary (lifetime spend). */
export function segmentOf(c: CrmCustomerLike, now = new Date()): Segment {
  if (!c.order_count || !c.last_order_at) return 'prospect';
  const recency = (now.getTime() - new Date(c.last_order_at).getTime()) / DAY;
  const age = (now.getTime() - new Date(c.created_at).getTime()) / DAY;
  if (recency > 60) return 'dormant';
  if (c.order_count >= 10 && c.total_spent >= 500_000 && recency <= 30) return 'vip';
  if (recency > 30 && c.order_count >= 3) return 'at_risk';
  if (c.order_count >= 4) return 'loyal';
  if (age <= 30) return 'new';
  return recency > 30 ? 'at_risk' : 'loyal';
}

/** Days until next birthday (0 = today), or null when unknown. */
export function daysToBirthday(birthday: string | null, now = new Date()): number | null {
  if (!birthday) return null;
  const [, m, d] = birthday.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / DAY);
}

export function waPhone(phone: string | null): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.startsWith('0') ? '62' + d.slice(1) : d;
}
