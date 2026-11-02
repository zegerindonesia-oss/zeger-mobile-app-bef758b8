export interface PaymentMethodConfig { value: string; label: string; enabled: boolean }

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { value: 'cash', label: 'Tunai', enabled: true },
  { value: 'qris', label: 'QRIS', enabled: true },
  { value: 'transfer', label: 'Transfer Bank', enabled: true },
  { value: 'edc', label: 'EDC / Debit / Kredit', enabled: true },
  { value: 'shopeepay', label: 'ShopeePay', enabled: true },
  { value: 'gopay', label: 'GoPay', enabled: true },
  { value: 'ovo', label: 'OVO', enabled: true },
  { value: 'dana', label: 'DANA', enabled: true },
];

/** Merge saved branch config with defaults so new built-in methods appear and Tunai always exists. */
export const resolvePaymentMethods = (saved?: PaymentMethodConfig[] | null): PaymentMethodConfig[] => {
  const list = Array.isArray(saved) && saved.length ? [...saved] : [];
  DEFAULT_PAYMENT_METHODS.forEach((d) => { if (!list.some((m) => m.value === d.value)) list.push(d); });
  return list.map((m) => (m.value === 'cash' ? { ...m, enabled: true } : m));
};

export const slugMethod = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
