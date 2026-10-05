import { supabase } from '@/integrations/supabase/client';

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

export interface PrintSettings {
  printers: PrinterConfig[];
  receiptHeader: string;
  receiptFooter: string;
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

const pageCss = (paper: PaperWidth) => {
  const w = paper === '58' ? '58mm' : paper === '80' ? '80mm' : '50mm';
  const size = paper === 'label' ? '50mm 30mm' : `${w} auto`;
  return `@page{size:${size};margin:0}*{box-sizing:border-box}body{margin:0;width:${w};padding:${paper === 'label' ? '1.5mm' : '3mm'};font-family:'Courier New',monospace;font-size:${paper === '58' ? '10px' : paper === 'label' ? '9px' : '12px'};color:#000;line-height:1.25}
.c{text-align:center}.b{font-weight:bold}.big{font-size:1.6em;font-weight:bold}.hr{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between;gap:6px}.n{padding-left:10px;font-style:italic}.lbl{page-break-after:always;height:27mm;overflow:hidden}.lbl:last-child{page-break-after:auto}`;
};

const doc = (paper: PaperWidth, title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${pageCss(paper)}</style></head><body>${body}</body></html>`;

export interface ReceiptPrint {
  transaction_number: string; branch_name: string; kasir_name: string; created_at: string;
  order_type: string; table_number?: string | null; customer_name?: string | null;
  items: PrintItem[]; subtotal: number; discount: number; service_charge: number; tax: number; total: number;
  payment_method_1: string; amount_1: number; payment_method_2?: string | null; amount_2?: number; change_amount: number;
}

export const renderReceipt = (d: ReceiptPrint, s: PrintSettings, paper: PaperWidth) => doc(paper, `Struk ${d.transaction_number}`, `
<div class="c"><div class="big">${esc(d.branch_name)}</div>${s.receiptHeader ? `<div>${esc(s.receiptHeader)}</div>` : ''}</div>
<div class="hr"></div>
<div>No: ${esc(d.transaction_number)}</div><div>${jkt(d.created_at)}</div><div>Kasir: ${esc(d.kasir_name)}</div>
<div>Tipe: ${esc(d.order_type.replace('_', ' ').toUpperCase())}${d.table_number ? ` · Meja ${esc(d.table_number)}` : ''}</div>
${d.customer_name ? `<div>Customer: ${esc(d.customer_name)}</div>` : ''}
<div class="hr"></div>
${d.items.map((i) => `<div>${esc(i.product_name)}</div><div class="row"><span>${i.qty} x ${rp(i.price || 0)}</span><span>${rp(i.subtotal || 0)}</span></div>${i.notes ? `<div class="n">${esc(i.notes)}</div>` : ''}`).join('')}
<div class="hr"></div>
<div class="row"><span>Subtotal</span><span>${rp(d.subtotal)}</span></div>
${d.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${rp(d.discount)}</span></div>` : ''}
${d.service_charge > 0 ? `<div class="row"><span>Service</span><span>${rp(d.service_charge)}</span></div>` : ''}
${d.tax > 0 ? `<div class="row"><span>Pajak</span><span>${rp(d.tax)}</span></div>` : ''}
<div class="row b" style="font-size:1.25em"><span>TOTAL</span><span>${rp(d.total)}</span></div>
<div class="row"><span>${esc(d.payment_method_1.toUpperCase())}</span><span>${rp(d.amount_1)}</span></div>
${d.payment_method_2 ? `<div class="row"><span>${esc(d.payment_method_2.toUpperCase())}</span><span>${rp(d.amount_2 || 0)}</span></div>` : ''}
${d.change_amount > 0 ? `<div class="row"><span>Kembalian</span><span>${rp(d.change_amount)}</span></div>` : ''}
<div class="hr"></div><div class="c">${esc(s.receiptFooter)}</div>`);

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
  gross: number; discount: number; service: number; tax: number; net: number;
  tx_count: number; void_count: number; expected_cash: number;
  closing_cash?: number | null; difference?: number | null; notes?: string | null;
}

export const renderShiftReport = (r: ShiftReportPrint, paper: PaperWidth) => doc(paper, `${r.kind}-Report`, `
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
`);

// ---------- Print engine ----------
/** Prints HTML via a hidden iframe. Each call is one print job; browser picks the printer
 *  (set the default printer, or run Chrome with --kiosk-printing for silent printing). */
export const printHtml = (html: string, copies = 1) =>
  new Promise<void>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(iframe);
    const d = iframe.contentDocument!;
    const body = copies > 1 ? html.replace('<body>', '<body>').replace(/<\/body>/, '') : html;
    d.open(); d.write(copies > 1 ? Array(copies).fill(body).join('<div style="page-break-after:always"></div>') : html); d.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(() => { iframe.remove(); resolve(); }, 1000);
    }, 250);
  });

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
  await printHtml(renderShiftReport(r, p?.paper || '80'));
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
  for (let i = 0; i < ids.length; i += 200) {
    const { data: items } = await db.from('pos_transaction_items').select('category,qty,subtotal_item').in('transaction_id', ids.slice(i, i + 200));
    (items || []).forEach((it: any) => {
      const c = it.category || 'Lainnya';
      cats[c] ??= { qty: 0, amount: 0 };
      cats[c].qty += Number(it.qty || 0); cats[c].amount += Number(it.subtotal_item || 0);
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
    categories: Object.entries(cats).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    gross: sum('subtotal'), discount: sum('discount_item') + sum('discount_bill'), service: sum('service_charge'), tax: sum('tax'),
    net: sum('total'), tx_count: paid.length, void_count: all.filter((t: any) => t.status === 'void' || t.status === 'voided').length,
    expected_cash: expected,
    closing_cash: shift.closing_cash ?? null,
    difference: shift.closing_cash != null ? Number(shift.closing_cash) - expected : null,
    notes: shift.notes ?? null,
  };
};
