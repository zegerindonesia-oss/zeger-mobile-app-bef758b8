import { formatRupiah } from '@/lib/customer-art';

export interface VoucherLike {
  code?: string;
  description?: string | null;
  discount_type: string;
  discount_value: number;
  min_order?: number | null;
}

export type VoucherKind = 'percentage' | 'fixed' | 'shipping';

/** Back Office stores the type as free text — normalise every known spelling. */
export function voucherKind(v: Pick<VoucherLike, 'discount_type'>): VoucherKind {
  const t = String(v?.discount_type || '').toLowerCase();
  if (t === 'percentage' || t === 'percent' || t === 'persen') return 'percentage';
  if (t === 'shipping' || t === 'free_shipping' || t === 'freeship' || t === 'ongkir') return 'shipping';
  return 'fixed';
}

/** Big label shown on the red ticket stub, e.g. 15K / 10% / Ongkir. */
export function voucherStub(v: VoucherLike): { big: string; sub: string } {
  const kind = voucherKind(v);
  const value = Number(v.discount_value) || 0;
  if (kind === 'percentage') return { big: `${value}%`, sub: 'Off' };
  if (kind === 'shipping') return { big: 'Ongkir', sub: 'Gratis' };
  if (value >= 1000) return { big: `${Math.round(value / 1000)}K`, sub: 'Off' };
  return { big: formatRupiah(value), sub: 'Off' };
}

/** Human description used when the Back Office left the description empty. */
export function voucherHeadline(v: VoucherLike): string {
  if (v.description) return v.description;
  const kind = voucherKind(v);
  if (kind === 'percentage') return `Diskon ${Number(v.discount_value) || 0}%`;
  if (kind === 'shipping') return 'Gratis ongkos kirim';
  return `Potongan ${formatRupiah(Number(v.discount_value) || 0)}`;
}

export interface VoucherContext {
  /** Cart subtotal before any discount. */
  subtotal: number;
  /** Shipping still payable after the standing delivery discount (0 for pickup). */
  shippingDue?: number;
}

/** Rupiah value of a voucher for the given cart — 0 when it cannot be used. */
export function voucherDiscountFor(v: VoucherLike | null | undefined, ctx: VoucherContext): number {
  if (!v) return 0;
  const subtotal = Math.max(0, ctx.subtotal || 0);
  const shippingDue = Math.max(0, ctx.shippingDue || 0);
  if ((v.min_order || 0) > subtotal) return 0;

  const kind = voucherKind(v);
  const value = Number(v.discount_value) || 0;

  if (kind === 'shipping') {
    if (shippingDue <= 0) return 0;
    return value > 0 ? Math.min(value, shippingDue) : shippingDue;
  }
  const raw = kind === 'percentage' ? Math.floor((subtotal * value) / 100) : value;
  return Math.min(Math.max(0, raw), subtotal);
}

/** Why a voucher is greyed out, or null when it is ready to use. */
export function voucherBlockedReason(v: VoucherLike, ctx: VoucherContext): string | null {
  const subtotal = Math.max(0, ctx.subtotal || 0);
  if ((v.min_order || 0) > subtotal) return `Min. belanja ${formatRupiah(v.min_order || 0)}`;
  if (voucherKind(v) === 'shipping' && (ctx.shippingDue || 0) <= 0) return 'Khusus pesanan diantar';
  return null;
}
