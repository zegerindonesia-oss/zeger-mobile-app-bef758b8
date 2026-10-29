import { expect, test } from 'bun:test';
import { latestShiftLeftover } from '../src/lib/rider-leftover';

const shifts = [
  { id: 'first', rider_id: 'tri', shift_date: '2026-10-28', shift_number: 1, shift_start_time: '2026-10-28T00:00:43+07:00', shift_end_time: '2026-10-28T00:00:44+07:00' },
  { id: 'second', rider_id: 'tri', shift_date: '2026-10-28', shift_number: 2, shift_start_time: '2026-10-28T16:19:59+07:00', shift_end_time: '2026-10-28T23:58:02+07:00' },
];
const returns = [
  { product_id: 'coffee', quantity: 39, notes: 'Verified quantity: 39 (expected: 39)', created_at: '2026-10-28T00:00:21+07:00', actual_delivery_date: '2026-10-28T17:05:38+07:00', products: { name: 'Coffee' } },
  { product_id: 'coffee', quantity: 25, notes: 'Verified quantity: 25 (expected: 25)', created_at: '2026-10-28T23:57:53+07:00', actual_delivery_date: '2026-10-29T11:05:41+07:00', products: { name: 'Coffee' } },
];

test('Pak Tri latest shift returns 25, not the daily total of 64', () => {
  const result = latestShiftLeftover(shifts, returns, []);
  expect(result?.shift.id).toBe('second');
  expect(result?.items.coffee.qty).toBe(25);
});
test('later Hub verification never moves the first-shift 39 into shift two', () => {
  const result = latestShiftLeftover(shifts, [returns[0]], []);
  expect(result?.shift.id).toBe('first');
  expect(result?.items.coffee.qty).toBe(39);
});
test('verified physical 25 is final and waste is not subtracted twice', () => {
  expect(latestShiftLeftover(shifts, returns, [{ product_id: 'coffee', quantity: 4, created_at: returns[1].created_at }])?.items.coffee.qty).toBe(25);
});
test('unverified returns deduct only waste belonging to the same shift', () => {
  const result = latestShiftLeftover(shifts, [{ ...returns[1], notes: null }], [
    { product_id: 'coffee', quantity: 4, created_at: '2026-10-28T23:50:00+07:00' },
    { product_id: 'coffee', quantity: 10, created_at: '2026-10-29T10:00:00+07:00' },
  ]);
  expect(result?.items.coffee.qty).toBe(21);
});
test('zero final stock does not fall back to the previous 39', () => {
  expect(latestShiftLeftover(shifts, [returns[0], { ...returns[1], notes: 'Verified quantity: 0' }], [])?.items).toEqual({});
});
test('bare Jakarta shift times still separate 39 from 25', () => {
  const localShifts = shifts.map((s, i) => ({ ...s, shift_start_time: i === 0 ? '00:00:43' : '16:19:59', shift_end_time: i === 0 ? '00:00:44' : '23:58:02' }));
  expect(latestShiftLeftover(localShifts, returns, [])?.items.coffee.qty).toBe(25);
});