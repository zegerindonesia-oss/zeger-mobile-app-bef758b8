import { supabase } from '@/integrations/supabase/client';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';

export type PrinterRole = 'receipt' | 'kitchen' | 'sticker';
export type PaperWidth = '58' | '80' | 'label';

export interface PrinterConfig {
  id: string;
  name: string;
  role: PrinterRole;
  paper: PaperWidth;
  enabled: boolean;
  autoPrint: boolean;
  copies: number;
  /** Kitchen/sticker: categories routed to this printer. Empty + no products = all items. */
  categories: string[];
  /** Kitchen/sticker: specific product ids routed to this printer (override). */
  productIds: string[];
}

export interface ReceiptLayout {
  showLogo: boolean; logoUrl: string; brandName: string;
  address: string; phone: string; instagram: string; taxId: string;
  showQueue: boolean; showCashier: boolean; showOrderType: boolean; showCustomer: boolean;
  showItemDetails: boolean; showUnitPrice: boolean; showNotes: boolean;
  showDiscount: boolean; showTaxService: boolean; showPayment: boolean; showItemCount: boolean;
  wifiName: string; wifiPass: string;
  showQr: boolean; qrUrl: string; qrCaption: string;
  policy: string; showPoweredBy: boolean;
  /** Overall text size in percent (80–140). */
  fontScale: number;
  /** Line height multiplier (1.1–2.0); also scales gaps between sections. */
  lineSpacing: number;
}

export const DEFAULT_LAYOUT: ReceiptLayout = {
  showLogo: false, logoUrl: '', brandName: '', address: '', phone: '', instagram: '', taxId: '',
  showQueue: true, showCashier: true, showOrderType: true, showCustomer: true,
  showItemDetails: true, showUnitPrice: true, showNotes: true,
  showDiscount: true, showTaxService: true, showPayment: true, showItemCount: true,
  wifiName: '', wifiPass: '', showQr: false, qrUrl: '', qrCaption: 'Scan untuk beri ulasan',
  policy: '', showPoweredBy: true, fontScale: 100, lineSpacing: 1.45,
};
const layoutOf = (s: PrintSettings): ReceiptLayout => ({ ...DEFAULT_LAYOUT, ...(s.layout || {}) });

export interface PrintSettings {
  printers: PrinterConfig[];
  receiptHeader: string;
  receiptFooter: string;
  layout?: Partial<ReceiptLayout>;
}

export const newPrinter = (role: PrinterRole, name: string): PrinterConfig => ({
  id: crypto.randomUUID(), name, role, paper: role === 'sticker' ? 'label' : '80',
  enabled: true, autoPrint: true, copies: 1, categories: [], productIds: [],
});

export const DEFAULT_SETTINGS: PrintSettings = {
  printers: [
    newPrinter('receipt', 'Printer Kasir'),
    { ...newPrinter('kitchen', 'Printer Dapur A (Minuman)'), categories: [] },
    { ...newPrinter('kitchen', 'Printer Dapur B (Makanan)'), enabled: false },
  ],
  receiptHeader: '',
  receiptFooter: 'Terima kasih atas kunjungan Anda!',
  layout: DEFAULT_LAYOUT,
};

const cacheKey = (branchId: string) => `zeger_print_settings_${branchId}`;

export const loadPrintSettings = async (branchId: string | null): Promise<PrintSettings> => {
  if (!branchId) return DEFAULT_SETTINGS;
  try {
    const { data } = await (supabase as any)
      .from('pos_printer_settings').select('config').eq('branch_id', branchId).maybeSingle();
    if (data?.config?.printers) {
      localStorage.setItem(cacheKey(branchId), JSON.stringify(data.config));
      return { ...DEFAULT_SETTINGS, ...data.config };
    }
  } catch { /* offline: use cache */ }
  const cached = localStorage.getItem(cacheKey(branchId));
  return cached ? { ...DEFAULT_SETTINGS, ...JSON.parse(cached) } : DEFAULT_SETTINGS;
};

export const savePrintSettings = async (branchId: string, settings: PrintSettings, userId?: string) => {
  localStorage.setItem(cacheKey(branchId), JSON.stringify(settings));
  const { error } = await (supabase as any).from('pos_printer_settings').upsert(
    { branch_id: branchId, config: settings, updated_by: userId || null },
    { onConflict: 'branch_id' },
  );
  if (error) throw error;
};

// ---------- Routing ----------
export interface PrintItem {
  product_id?: string | null;
  product_name: string;
  category?: string | null;
  qty: number;
  price?: number;
  subtotal?: number;
  notes?: string;
}

/** Item goes to printer if product is explicitly selected, or its category is checked.
 *  A printer with nothing selected receives all items. */
export const routeItems = (printer: PrinterConfig, items: PrintItem[]) => {
  const noFilter = printer.categories.length === 0 && printer.productIds.length === 0;
  if (noFilter) return items;
  return items.filter((i) =>
    (i.product_id && printer.productIds.includes(i.product_id)) ||
    (i.category && printer.categories.includes(i.category)),
  );
};

// ---------- Rendering ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const rp = (n: number) => `Rp${Math.round(n || 0).toLocaleString('id-ID')}`;
export const jkt = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short', timeStyle: 'short' });

const pageCss = (paper: PaperWidth, scale = 100, spacing = 1.45) => {
  const w = paper === '58' ? '58mm' : paper === '80' ? '80mm' : '50mm';
  const size = paper === 'label' ? '50mm 30mm' : `${w} auto`;
  const base = paper === '58' ? 10.5 : paper === 'label' ? 9 : 12.5;
  const fs = +(base * scale / 100).toFixed(2);
  const gap = +(spacing / 1.45).toFixed(2);
  return `@page{size:${size};margin:0}*{box-sizing:border-box}body{margin:0;width:${w};padding:${paper === 'label' ? '1.5mm' : '3mm'};font-family:'Helvetica Neue',Helvetica,Arial,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums;font-size:${fs}px;color:#111;line-height:${spacing};-webkit-font-smoothing:antialiased}
.c{text-align:center}.b{font-weight:700}.big{font-size:1.65em;font-weight:800;letter-spacing:.02em}.hr{border-top:1px solid #222;margin:${7 * gap}px 0}.hr2{border-top:1px solid #222;border-bottom:1px solid #222;height:3px;margin:${8 * gap}px 0}.mut{color:#555}.ttl{font-size:1.15em;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.row{display:flex;justify-content:space-between;gap:8px}.row span:last-child{text-align:right;white-space:nowrap}.it{margin:${3 * gap}px 0}.bars{display:flex;justify-content:center;align-items:stretch;height:38px;margin-top:6px}.bars i{display:block;background:#111}.n{padding-left:10px;font-style:italic}.lbl{page-break-after:always;height:27mm;overflow:hidden}.lbl:last-child{page-break-after:auto}.qr svg{width:${Math.round(96 * scale / 100)}px;height:${Math.round(96 * scale / 100)}px}`;
};

const doc = (paper: PaperWidth, title: string, body: string, scale?: number, spacing?: number) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${pageCss(paper, scale, spacing)}</style></head><body>${body}</body></html>`;

/** Offline QR code as inline SVG (no external service, works in previews and printers). */
export const qrSvg = (text: string) => {
  try { return renderToStaticMarkup(createElement(QRCodeSVG, { value: text, size: 140, level: 'M', marginSize: 1 })); }
  catch { return ''; }
};

export interface ReceiptPrint {
  transaction_number: string; branch_name: string; kasir_name: string; created_at: string;
  order_type: string; table_number?: string | null; customer_name?: string | null;
  items: PrintItem[]; subtotal: number; discount: number; service_charge: number; tax: number; total: number;
  payment_method_1: string; amount_1: number; payment_method_2?: string | null; amount_2?: number; change_amount: number;
}

/** Decorative Code-128-look barcode built from the transaction number (CSS bars, printer-safe). */
export const barcodeHtml = (code: string) => {
  let bars = '';
  for (let i = 0; i < code.length * 3; i++) {
    const c = code.charCodeAt(i % code.length) + i * 7;
    bars += `<i style="width:${(c % 3) + 1}px;margin-right:${((c >> 2) % 2) + 1}px"></i>`;
  }
  return `<div class="bars">${bars}</div><div class="c mut" style="font-size:.85em;letter-spacing:.15em">#${esc(code)}#</div>`;
};

export const renderReceiptBody = (d: ReceiptPrint, s: PrintSettings) => {
  const L: ReceiptLayout = { ...DEFAULT_LAYOUT, ...(s.layout || {}) };
  const qty = d.items.reduce((a, i) => a + i.qty, 0);
  const row = (a: string, b: string, cls = '') => `<div class="row ${cls}"><span>${a}</span><span>${b}</span></div>`;
  return `
${L.showLogo && L.logoUrl ? `<div class="c"><img src="${esc(L.logoUrl)}" style="max-width:60%;max-height:60px;filter:grayscale(1) contrast(1.4)"/></div>` : ''}
<div class="c"><div class="big">${esc(L.brandName || d.branch_name)}</div>${L.brandName ? `<div>${esc(d.branch_name)}</div>` : ''}
${L.address ? `<div>${esc(L.address)}</div>` : ''}${L.phone ? `<div>${esc(L.phone)}</div>` : ''}${L.instagram ? `<div>${esc(L.instagram)}</div>` : ''}
${L.taxId ? `<div>NPWP: ${esc(L.taxId)}</div>` : ''}${s.receiptHeader ? `<div>${esc(s.receiptHeader)}</div>` : ''}</div>
${L.showQueue ? `<div class="hr"></div><div class="c">No. Antrean</div><div class="c" style="font-size:2.2em;font-weight:bold">${esc(d.transaction_number.slice(-3))}</div>` : ''}
<div class="hr2"></div>
${row('<span class="mut">No. Struk</span>', esc(d.transaction_number))}${row('<span class="mut">Tanggal</span>', jkt(d.created_at))}
${L.showCashier ? row('<span class="mut">Kasir</span>', esc(d.kasir_name)) : ''}
${L.showOrderType ? row('<span class="mut">Tipe</span>', `${esc(d.order_type.replace('_', ' ').toUpperCase())}${d.table_number ? ` · Meja ${esc(d.table_number)}` : ''}`) : ''}
${L.showCustomer && d.customer_name ? row('<span class="mut">Customer</span>', esc(d.customer_name)) : ''}
<div class="hr2"></div>${row('<b>Item</b>', '<b>Harga</b>')}<div style="height:3px"></div>
${L.showItemDetails
  ? d.items.map((i) => L.showUnitPrice
      ? `<div class="it"><div>${esc(i.product_name)}</div>${row(`<span class="mut">${i.qty} x ${rp(i.price || 0)}</span>`, rp(i.subtotal || 0))}</div>${L.showNotes && i.notes ? `<div class="n">${esc(i.notes)}</div>` : ''}`
      : `${row(`${i.qty}x ${esc(i.product_name)}`, rp(i.subtotal || 0))}${L.showNotes && i.notes ? `<div class="n">${esc(i.notes)}</div>` : ''}`).join('')
  : row(`${qty} item`, rp(d.subtotal))}
${L.showItemCount ? `<div class="c" style="margin-top:3px">Total item: ${qty}</div>` : ''}
<div class="hr"></div>
${row('Subtotal', rp(d.subtotal))}
${L.showDiscount && d.discount > 0 ? row('Diskon', `-${rp(d.discount)}`) : ''}
${L.showTaxService && d.service_charge > 0 ? row('Service', rp(d.service_charge)) : ''}
${L.showTaxService && d.tax > 0 ? row('Pajak', rp(d.tax)) : ''}
<div class="row" style="font-size:1.45em;font-weight:800;margin:4px 0"><span>Total</span><span>${rp(d.total)}</span></div><div class="hr"></div>
${L.showPayment ? `${row(esc(d.payment_method_1.toUpperCase()), rp(d.amount_1))}
${d.payment_method_2 ? row(esc(d.payment_method_2.toUpperCase()), rp(d.amount_2 || 0)) : ''}
${d.change_amount > 0 ? row('Kembalian', rp(d.change_amount)) : ''}` : ''}
${barcodeHtml(d.transaction_number)}<div class="hr2"></div><div class="c" style="font-size:1.15em;margin:4px 0">${esc(s.receiptFooter)}</div>
${L.wifiName ? `<div class="c" style="margin-top:4px">WiFi: ${esc(L.wifiName)}${L.wifiPass ? ` · Pass: ${esc(L.wifiPass)}` : ''}</div>` : ''}
${L.showQr && L.qrUrl ? `<div class="c qr" style="margin-top:8px;display:flex;flex-direction:column;align-items:center;gap:3px">${qrSvg(L.qrUrl)}<div class="b">${esc(L.qrCaption)}</div></div>` : ''}
${L.policy ? `<div class="c" style="margin-top:4px;font-size:.9em">${esc(L.policy)}</div>` : ''}
${L.showPoweredBy ? `<div class="c" style="margin-top:6px;font-size:.85em">Powered by Flow F&amp;B</div>` : ''}`;
};

export const renderReceipt = (d: ReceiptPrint, s: PrintSettings, paper: PaperWidth) =>
  doc(paper, `Struk ${d.transaction_number}`, renderReceiptBody(d, s), layoutOf(s).fontScale, layoutOf(s).lineSpacing);

export const SAMPLE_RECEIPT: ReceiptPrint = {
  transaction_number: 'TRX-20261013-042', branch_name: 'Zeger Branch Malang', kasir_name: 'Nia', created_at: new Date().toISOString(),
  order_type: 'dine_in', table_number: '7', customer_name: 'Budi Santoso',
  items: [
    { product_name: 'Aren Latte (Large)', qty: 2, price: 23000, subtotal: 46000, notes: 'Ice, Less Sugar, +Extra Shot' },
    { product_name: 'Americano', qty: 1, price: 15000, subtotal: 15000 },
    { product_name: 'Croissant Butter', qty: 1, price: 22000, subtotal: 22000, notes: 'Dipanaskan' },
  ],
  subtotal: 83000, discount: 8300, service_charge: 0, tax: 7470, total: 82170,
  payment_method_1: 'cash', amount_1: 100000, change_amount: 17830,
};

export interface KitchenPrint {
  station: string; ref: string; order_type: string; table_number?: string | null;
  customer_name?: string | null; created_at: string; items: PrintItem[]; addition?: boolean;
}

export const renderKitchenTicket = (k: KitchenPrint, paper: PaperWidth) => doc(paper, `Dapur ${k.ref}`, `
<div class="c b">${esc(k.station.toUpperCase())}</div>
${k.addition ? '<div class="c b">** TAMBAHAN **</div>' : ''}
<div class="c big">${k.table_number ? `MEJA ${esc(k.table_number)}` : `#${esc(k.ref.slice(-3))}`}</div>
<div class="c">${esc(k.order_type.replace('_', ' ').toUpperCase())}${k.customer_name ? ` · ${esc(k.customer_name)}` : ''}</div>
<div class="c">${esc(k.ref)} · ${jkt(k.created_at)}</div>
<div class="hr"></div>
${k.items.map((i) => `<div class="b" style="font-size:1.3em">${i.qty}x ${esc(i.product_name)}</div>${i.notes ? `<div class="n">» ${esc(i.notes)}</div>` : ''}`).join('<div style="height:4px"></div>')}
<div class="hr"></div><div class="c">Total item: ${k.items.reduce((s, i) => s + i.qty, 0)}</div>`);

export const renderStickers = (k: KitchenPrint) => {
  const labels: string[] = [];
  const total = k.items.reduce((s, i) => s + i.qty, 0);
  let n = 0;
  k.items.forEach((i) => {
    for (let q = 0; q < i.qty; q++) {
      n++;
      labels.push(`<div class="lbl"><div class="row b"><span>${k.table_number ? `M${esc(k.table_number)}` : `#${esc(k.ref.slice(-3))}`}</span><span>${n}/${total}</span></div>
<div class="b" style="font-size:1.25em">${esc(i.product_name)}</div>${i.notes ? `<div>${esc(i.notes)}</div>` : ''}
<div>${esc(k.customer_name || '')}</div><div>${jkt(k.created_at)}</div></div>`);
    }
  });
  return doc('label', `Stiker ${k.ref}`, labels.join(''));
};

export interface ShiftReportPrint {
  kind: 'X' | 'Z'; branch_name: string; kasir_name: string; shift_type: string;
  opened_at: string; closed_at?: string | null; printed_at: string;
  opening_cash: number; cash_in: number; cash_out: number;
  payments: { method: string; count: number; amount: number }[];
  categories: { category: string; qty: number; amount: number }[];
  products?: { name: string; qty: number; amount: number }[];
  gross: number; discount: number; service: number; tax: number; net: number;
  tx_count: number; void_count: number; expected_cash: number;
  closing_cash?: number | null; difference?: number | null; notes?: string | null;
}

export const renderShiftReport = (r: ShiftReportPrint, paper: PaperWidth, s?: PrintSettings) => doc(paper, `${r.kind}-Report`, `
<div class="c big">${r.kind}-REPORT</div>
<div class="c">${r.kind === 'X' ? 'Laporan Sementara (shift masih buka)' : 'Laporan Tutup Shift'}</div>
<div class="c b">${esc(r.branch_name)}</div><div class="hr"></div>
<div>Kasir: ${esc(r.kasir_name)}</div><div>Shift: ${esc(r.shift_type)}</div>
<div>Buka : ${jkt(r.opened_at)}</div>${r.closed_at ? `<div>Tutup: ${jkt(r.closed_at)}</div>` : ''}<div>Cetak: ${jkt(r.printed_at)}</div>
<div class="hr"></div><div class="b">PENJUALAN</div>
<div class="row"><span>Penjualan Kotor</span><span>${rp(r.gross)}</span></div>
<div class="row"><span>Diskon</span><span>-${rp(r.discount)}</span></div>
<div class="row"><span>Service</span><span>${rp(r.service)}</span></div>
<div class="row"><span>Pajak</span><span>${rp(r.tax)}</span></div>
<div class="row b"><span>Penjualan Bersih</span><span>${rp(r.net)}</span></div>
<div class="row"><span>Jumlah Transaksi</span><span>${r.tx_count}</span></div>
<div class="row"><span>Rata-rata</span><span>${rp(r.tx_count ? r.net / r.tx_count : 0)}</span></div>
<div class="row"><span>Void</span><span>${r.void_count}</span></div>
<div class="hr"></div><div class="b">METODE BAYAR</div>
${r.payments.map((p) => `<div class="row"><span>${esc(p.method.toUpperCase())} (${p.count})</span><span>${rp(p.amount)}</span></div>`).join('') || '<div>-</div>'}
<div class="hr"></div><div class="b">PER KATEGORI</div>
${r.categories.map((c) => `<div class="row"><span>${esc(c.category)} (${c.qty})</span><span>${rp(c.amount)}</span></div>`).join('') || '<div>-</div>'}
<div class="hr"></div><div class="b">RINCIAN PRODUK</div>
${(r.products || []).map((p) => `<div class="row"><span>${p.qty}x ${esc(p.name)}</span><span>${rp(p.amount)}</span></div>`).join('') || '<div>-</div>'}
<div class="hr"></div><div class="b">KAS LACI</div>
<div class="row"><span>Modal Awal</span><span>${rp(r.opening_cash)}</span></div>
<div class="row"><span>Tunai Masuk Penjualan</span><span>${rp(r.payments.find((p) => p.method === 'cash')?.amount || 0)}</span></div>
<div class="row"><span>Kas Masuk</span><span>${rp(r.cash_in)}</span></div>
<div class="row"><span>Kas Keluar</span><span>-${rp(r.cash_out)}</span></div>
<div class="row b"><span>Seharusnya</span><span>${rp(r.expected_cash)}</span></div>
${r.kind === 'Z' ? `<div class="row"><span>Fisik Dihitung</span><span>${rp(r.closing_cash || 0)}</span></div>
<div class="row b"><span>Selisih</span><span>${(r.difference || 0) >= 0 ? '+' : ''}${rp(r.difference || 0)}</span></div>
${r.notes ? `<div>Catatan: ${esc(r.notes)}</div>` : ''}
<div style="height:30px"></div><div class="row"><span>Kasir</span><span>Supervisor</span></div><div style="height:30px"></div><div class="row"><span>(________)</span><span>(________)</span></div>` : ''}
`, s ? layoutOf(s).fontScale : 100, s ? layoutOf(s).lineSpacing : 1.45);

// ---------- Print engine ----------
/** Prints HTML via a hidden iframe. Each call is one print job; browser picks the printer
 *  (set the default printer, or run Chrome with --kiosk-printing for silent printing). */
const printOnce = (html: string) =>
  new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    const d = iframe.contentDocument!;
    d.open(); d.write(html); d.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => { iframe.remove(); resolve(); }, 1000);
    }, 250);
  });

export const printHtml = async (html: string, copies = 1) => {
  for (let i = 0; i < Math.max(1, copies); i++) await printOnce(html);
};

const enabled = (s: PrintSettings, role: PrinterRole) => s.printers.filter((p) => p.enabled && p.role === role);

export const printReceipt = async (s: PrintSettings, d: ReceiptPrint, auto: boolean) => {
  for (const p of enabled(s, 'receipt')) {
    if (auto && !p.autoPrint) continue;
    await printHtml(renderReceipt(d, s, p.paper), p.copies);
  }
};

/** Sends kitchen tickets + cup stickers to every matching station printer. */
export const printKitchen = async (s: PrintSettings, k: Omit<KitchenPrint, 'station'>, auto = true) => {
  for (const p of [...enabled(s, 'kitchen'), ...enabled(s, 'sticker')]) {
    if (auto && !p.autoPrint) continue;
    const items = routeItems(p, k.items);
    if (!items.length) continue;
    const html = p.role === 'sticker' ? renderStickers({ ...k, station: p.name, items }) : renderKitchenTicket({ ...k, station: p.name, items }, p.paper);
    await printHtml(html, p.copies);
  }
};

export const printShiftReport = async (s: PrintSettings, r: ShiftReportPrint) => {
  const p = enabled(s, 'receipt')[0];
  await printHtml(renderShiftReport(r, p?.paper || '80', s));
};

// ---------- Shift report data ----------
export const buildShiftReport = async (shift: any, meta: { kind: 'X' | 'Z'; branch_name: string; kasir_name: string }): Promise<ShiftReportPrint> => {
  const db = supabase as any;
  const { data: txs } = await db.from('pos_transactions')
    .select('id,total,subtotal,discount_item,discount_bill,service_charge,tax,payment_method_1,amount_1,payment_method_2,amount_2,change_amount,status')
    .eq('shift_id', shift.id);
  const all = txs || [];
  const paid = all.filter((t: any) => t.status === 'paid');
  const pay: Record<string, { count: number; amount: number }> = {};
  const add = (m: string | null, a: number) => { if (!m) return; pay[m] ??= { count: 0, amount: 0 }; pay[m].count++; pay[m].amount += a; };
  paid.forEach((t: any) => {
    const cashNet = (m: string, a: number) => (m === 'cash' ? a - Number(t.change_amount || 0) : a);
    add(t.payment_method_1, cashNet(t.payment_method_1, Number(t.amount_1 || 0)));
    if (t.payment_method_2) add(t.payment_method_2, Number(t.amount_2 || 0));
  });
  const ids = paid.map((t: any) => t.id);
  const cats: Record<string, { qty: number; amount: number }> = {};
  const prods: Record<string, { qty: number; amount: number }> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data: items } = await db.from('pos_transaction_items').select('category,product_name,qty,subtotal_item').in('transaction_id', ids.slice(i, i + 200));
    (items || []).forEach((it: any) => {
      const c = it.category || 'Lainnya';
      cats[c] ??= { qty: 0, amount: 0 };
      cats[c].qty += Number(it.qty || 0); cats[c].amount += Number(it.subtotal_item || 0);
      const n = it.product_name || 'Item';
      prods[n] ??= { qty: 0, amount: 0 };
      prods[n].qty += Number(it.qty || 0); prods[n].amount += Number(it.subtotal_item || 0);
    });
  }
  const sum = (k: string) => paid.reduce((s: number, t: any) => s + Number(t[k] || 0), 0);
  const cashSales = pay.cash?.amount || 0;
  const expected = Number(shift.opening_cash || 0) + cashSales + Number(shift.total_cash_in || 0) - Number(shift.total_cash_out || 0);
  return {
    ...meta, shift_type: shift.shift_type, opened_at: shift.opened_at, closed_at: shift.closed_at,
    printed_at: new Date().toISOString(), opening_cash: Number(shift.opening_cash || 0),
    cash_in: Number(shift.total_cash_in || 0), cash_out: Number(shift.total_cash_out || 0),
    payments: Object.entries(pay).map(([method, v]) => ({ method, ...v })),
    products: Object.entries(prods).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty),
    categories: Object.entries(cats).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    gross: sum('subtotal'), discount: sum('discount_item') + sum('discount_bill'), service: sum('service_charge'), tax: sum('tax'),
    net: sum('total'), tx_count: paid.length, void_count: all.filter((t: any) => t.status === 'void' || t.status === 'voided').length,
    expected_cash: expected,
    closing_cash: shift.closing_cash ?? null,
    difference: shift.closing_cash != null ? Number(shift.closing_cash) - expected : null,
    notes: shift.notes ?? null,
  };
};
