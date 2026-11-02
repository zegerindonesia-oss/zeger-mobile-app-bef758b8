import { describe, it, expect } from 'bun:test';
import { applyModePrice } from '../src/lib/pos-mode-pricing';

describe('applyModePrice', () => {
  it('gross-up 20% on 10.000 gives 12.500 so net equals offline', () => {
    expect(applyModePrice(10000, { model: 'gross_up', value: 20, rounding: 'exact' })).toBe(12500);
  });
  it('percent 10% on 10.000 gives 11.000', () => {
    expect(applyModePrice(10000, { model: 'percent', value: 10, rounding: 'exact' })).toBe(11000);
  });
  it('fixed +2.000 on 10.000 gives 12.000', () => {
    expect(applyModePrice(10000, { model: 'fixed', value: 2000, rounding: 'exact' })).toBe(12000);
  });
  it('rounds up to 1.000', () => {
    expect(applyModePrice(18000, { model: 'gross_up', value: 20, rounding: '1000' })).toBe(23000);
  });
  it('none keeps offline price', () => {
    expect(applyModePrice(10000, { model: 'none', value: 50, rounding: '1000' })).toBe(10000);
  });
});
