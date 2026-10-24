import { describe, expect, test } from 'bun:test';
import { normalizeCustomerPhone, isGuestBrowseView, validGuestIdentity } from '../src/lib/customer-entry';

describe('QR guest and phone entry', () => {
  test('QR guests can browse menu and reach checkout without signing in', () => {
    for (const view of ['menu', 'product-detail', 'cart', 'checkout']) expect(isGuestBrowseView(view)).toBe(true);
  });
  test('unverified guests cannot access member benefits or profile', () => {
    for (const view of ['loyalty', 'vouchers', 'profile', 'orders']) expect(isGuestBrowseView(view)).toBe(false);
  });
  test('Indonesian local and international phone forms identify the same OTP destination', () => {
    expect(normalizeCustomerPhone('0812 3456 7890')).toBe('+6281234567890');
    expect(normalizeCustomerPhone('+62 812-3456-7890')).toBe('+6281234567890');
  });
  test('checkout requires name and a valid phone, not email or password', () => {
    expect(validGuestIdentity('Ayu', '081234567890')).toBe(true);
    expect(validGuestIdentity('', '081234567890')).toBe(false);
    expect(validGuestIdentity('Ayu', '123')).toBe(false);
    expect(normalizeCustomerPhone('08abc12345678')).toBe(null);
  });
});