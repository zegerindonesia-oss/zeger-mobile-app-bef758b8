export function normalizeCustomerPhone(value: string): string | null {
  let phone = value.replace(/[\s()+-]/g, '');
  if (phone.startsWith('0')) phone = `62${phone.slice(1)}`;
  if (!/^628\d{7,11}$/.test(phone)) return null;
  return `+${phone}`;
}

export const isGuestBrowseView = (view: string) =>
  ['menu', 'product-detail', 'cart', 'checkout', 'guest-success'].includes(view);

export function validGuestIdentity(name: string, phone: string) {
  return name.trim().length >= 2 && name.trim().length <= 80 && normalizeCustomerPhone(phone) !== null;
}