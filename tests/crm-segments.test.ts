import { describe, it, expect } from 'bun:test';
import { segmentOf, daysToBirthday } from '../src/lib/crm-segments';

const now = new Date(2026, 10, 3);
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe('crm segments', () => {
  it('no orders is prospect', () => {
    expect(segmentOf({ order_count: 0, total_spent: 0, last_order_at: null, created_at: ago(5) }, now)).toBe('prospect');
  });
  it('no order for over 60 days is dormant', () => {
    expect(segmentOf({ order_count: 20, total_spent: 2_000_000, last_order_at: ago(61), created_at: ago(300) }, now)).toBe('dormant');
  });
  it('10+ orders, 500k+, recent is vip', () => {
    expect(segmentOf({ order_count: 10, total_spent: 500_000, last_order_at: ago(3), created_at: ago(200) }, now)).toBe('vip');
  });
  it('regular buyer gone 31-60 days is at risk', () => {
    expect(segmentOf({ order_count: 5, total_spent: 200_000, last_order_at: ago(40), created_at: ago(200) }, now)).toBe('at_risk');
  });
  it('birthday countdown', () => {
    expect(daysToBirthday('1990-11-03', now)).toBe(0);
    expect(daysToBirthday('1990-11-10', now)).toBe(7);
    expect(daysToBirthday(null, now)).toBeNull();
  });
});
