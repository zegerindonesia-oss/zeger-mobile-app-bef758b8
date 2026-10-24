import { describe, expect, it } from 'bun:test';
import { isStoreOpen } from '../src/lib/store-hours';

// Jakarta = UTC+7
const at = (jktHour: number, min = 0) => new Date(Date.UTC(2026, 9, 25, (jktHour - 7 + 24) % 24, min));

describe('store hours', () => {
  it('open at 08:00 for 07:00-22:00', () => expect(isStoreOpen('07:00', '22:00', at(8))).toBe(true));
  it('closed at 22:00 for 07:00-22:00', () => expect(isStoreOpen('07:00', '22:00', at(22))).toBe(false));
  it('closed at 00:06 for 07:00-22:00', () => expect(isStoreOpen('07:00', '22:00', at(0, 6))).toBe(false));
  it('overnight 18:00-02:00 open at 01:00', () => expect(isStoreOpen('18:00', '02:00', at(1))).toBe(true));
});
