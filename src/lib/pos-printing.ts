import { supabase } from '@/integrations/supabase/client';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { EscPos, btReady, btSend, tsplLabels, tsplBitmapLabels, type TsplLabel } from './bt-printer';

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
  /** Kitchen/sticker: product brands routed to this printer. */
  brands?: string[];
  /** 'bluetooth' = direct raw print (ESC/POS / TSPL) without dialog; 'system' = browser print. */
  connection?: 'system' | 'bluetooth';
  /** Label size in mm (sticker printers). */
  labelW?: number;
  labelH?: number;
  /** Sticker text size % (80–140) and line spacing (1.0–2.0). */
  fontScale?: number;
  lineSpacing?: number;
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
  connection: 'bluetooth', labelW: 33, labelH: 15,
});

export const DEFAULT_SETTINGS: PrintSettings = {
  printers: [
    newPrinter('receipt', 'Printer Kasir'),
    newPrinter('kitchen', 'Printer Kitchen'),
    newPrinter('sticker', 'Printer Label Stiker'),
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
      if (data.config.printers.some((p: PrinterConfig) => p.brands?.length)) await loadProductBrands();
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
  brand?: string | null;
  qty: number;
  price?: number;
  subtotal?: number;
  notes?: string;
}

/** product_id → brand, used for brand routing (cart items don't carry brand). */
const productBrands = new Map<string, string>();
const BRAND_CACHE = 'zeger_product_brands';
try { Object.entries(JSON.parse(localStorage.getItem(BRAND_CACHE) || '{}')).forEach(([k, v]) => productBrands.set(k, v as string)); } catch { /* ignore */ }
export const loadProductBrands = async () => {
  try {
    const { data } = await (supabase as any).from('products').select('id,brand').not('brand', 'is', null);
    if (!data) return;
    productBrands.clear();
    (data as { id: string; brand: string }[]).forEach((r) => r.brand && productBrands.set(r.id, r.brand));
    localStorage.setItem(BRAND_CACHE, JSON.stringify(Object.fromEntries(productBrands)));
  } catch { /* offline: keep cache */ }
};

/** Item goes to printer if product is explicitly selected, or its category or brand is checked.
 *  A printer with nothing selected receives all items. */
export const routeItems = (printer: PrinterConfig, items: PrintItem[]) => {
  const brands = printer.brands || [];
  const noFilter = printer.categories.length === 0 && printer.productIds.length === 0 && brands.length === 0;
  if (noFilter) return items;
  return items.filter((i) => {
    const brand = i.brand ?? (i.product_id ? productBrands.get(i.product_id) : undefined);
    return (i.product_id && printer.productIds.includes(i.product_id)) ||
      (i.category && printer.categories.includes(i.category)) ||
      (!!brand && brands.includes(brand));
  });
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
  queue_number?: number | null;
}
export const queueLabel = (d: { queue_number?: number | null; transaction_number: string }) =>
  d.queue_number ? String(d.queue_number).padStart(3, '0') : d.transaction_number.slice(-3);

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
${L.showQueue ? `<div class="hr"></div><div class="c">No. Antrean</div><div class="c" style="font-size:2.2em;font-weight:bold">${esc(queueLabel(d))}</div>` : ''}
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
${L.showPayment ? `${d.payment_method_2 ? '<div style="text-align:center;font-weight:800">** SPLIT BILL **</div>' : ''}${row(esc(d.payment_method_1.toUpperCase()), rp(d.amount_1))}
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
  queue_number?: number | null;
}
/** Same queue label as the receipt, TV and KDS. */
export const kitchenQueue = (k: { queue_number?: number | null; ref: string }) =>
  k.queue_number ? String(k.queue_number).padStart(3, '0') : k.ref.slice(-3);

export const renderKitchenTicket = (k: KitchenPrint, paper: PaperWidth) => doc(paper, `Dapur ${k.ref}`, `
<div class="c b">${esc(k.station.toUpperCase())}</div>
${k.addition ? '<div class="c b">** TAMBAHAN **</div>' : ''}
<div class="c big">${k.table_number ? `MEJA ${esc(k.table_number)}` : `#${esc(kitchenQueue(k))}`}</div>${k.table_number && k.queue_number ? `<div class="c b">Antrean #${esc(kitchenQueue(k))}</div>` : ''}
<div class="c">${esc(k.order_type.replace('_', ' ').toUpperCase())}${k.customer_name ? ` · ${esc(k.customer_name)}` : ''}</div>
<div class="c">${esc(k.ref)} · ${jkt(k.created_at)}</div>
<div class="hr"></div>
${k.items.map((i) => `<div class="b" style="font-size:1.3em">${i.qty}x ${esc(i.product_name)}</div>${i.notes ? `<div class="n">» ${esc(i.notes)}</div>` : ''}`).join('<div style="height:4px"></div>')}
<div class="hr"></div><div class="c">Total item: ${k.items.reduce((s, i) => s + i.qty, 0)}</div>`);

/** International label sizes (mm) for cup / food / bag stickers. */
export const LABEL_SIZES: { w: number; h: number; label: string }[] = [
  { w: 33, h: 15, label: '33×15 mm · Micro cup' },
  { w: 40, h: 20, label: '40×20 mm · Compact cup' },
  { w: 40, h: 30, label: '40×30 mm · Cup standar' },
  { w: 50, h: 25, label: '50×25 mm · Cup lebar' },
  { w: 50, h: 30, label: '50×30 mm · Starbucks/Toast' },
  { w: 58, h: 40, label: '58×40 mm · Box makanan' },
  { w: 60, h: 40, label: '60×40 mm · Full detail' },
  { w: 80, h: 50, label: '80×50 mm · Segel delivery' },
];

type StickerCfg = Partial<Pick<PrinterConfig, 'fontScale' | 'lineSpacing' | 'labelW' | 'labelH'>>;
const ORDER_MODE_NAMES: Record<string, string> = { take_away: 'TAKE AWAY', dine_in: 'DINE IN', delivery: 'DELIVERY', gofood: 'GOFOOD', grabfood: 'GRABFOOD', shopeefood: 'SHOPEEFOOD', pickup: 'PICK UP' };
const modeText = (m: string) => ORDER_MODE_NAMES[m] || String(m || '').replace(/_/g, ' ').toUpperCase();

/** One customer cup label at 203dpi. Same canvas feeds preview, system print and Bluetooth, so output always matches. */
export const drawCustomerLabel = (k: KitchenPrint, item: KitchenPrint['items'][number], n: number, total: number, p?: StickerCfg) => {
  const D = 8, Wmm = p?.labelW || 33, Hmm = p?.labelH || 15;
  const W = Math.round(Wmm * D), H = Math.round(Hmm * D);
  const cv = document.createElement('canvas'); cv.width = Math.ceil(W / 8) * 8; cv.height = H;
  const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, H); g.fillStyle = '#000'; g.textBaseline = 'top';
  const k1 = ((p?.fontScale ?? 100) / 100) * Math.min(Hmm / 15, Wmm / 33 * 1.2);
  const px = (pt: number) => pt * k1 * 0.3528 * D;
  const LS = Math.min(Math.max(p?.lineSpacing ?? 1.15, 1), 1.5);
  const font = (w: number, s: number) => (g.font = `${w} ${s}px Arial, Helvetica, sans-serif`);
  const pad = Math.round(0.8 * D), R = W - pad, B = H - pad;
  // Right block: queue number (big) + cup n/total
  const q = k.queue_number ? `#${kitchenQueue(k)}` : k.table_number ? `M${k.table_number}` : `#${kitchenQueue(k)}`;
  const qS = px(11); font(900, qS); const qW = g.measureText(q).width;
  const cS = px(5); font(800, cS); const cTxt = `${n}/${total}`; const cW = g.measureText(cTxt).width;
  const rW = Math.max(qW, cW); const rx = R - rW;
  g.textAlign = 'right'; font(900, qS); g.fillText(q, R, pad); font(800, cS); g.fillText(cTxt, R, pad + qS * 1.02); g.textAlign = 'left';
  const lw = rx - pad - 0.8 * D;
  // Left: order mode (inverted chip) + customer name
  const mS = px(5); font(900, mS); const mode = modeText(k.order_type);
  const mW = Math.min(g.measureText(mode).width + 0.8 * D, lw);
  g.fillRect(pad, pad, mW, mS * 1.25); g.fillStyle = '#fff'; g.fillText(mode, pad + 0.4 * D, pad + mS * 0.13, mW - 0.8 * D); g.fillStyle = '#000';
  let y = pad + mS * 1.25 + 0.3 * D;
  const nS = px(6); font(800, nS);
  if (k.customer_name) { g.fillText(k.customer_name, pad, y, lw); }
  y = Math.max(y + nS * LS, pad + qS * 1.02 + cS * LS);
  // Menu name (wrap up to 2 lines across full width)
  const iS = px(7); font(900, iS);
  const wrap = (txt: string, max: number, lines: number) => {
    const out: string[] = []; let cur = '';
    for (const w of txt.split(/\s+/)) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out.slice(0, lines);
  };
  const fullW = R - pad;
  const footer = Hmm >= 25; const fS = px(4.5);
  const limit = footer ? B - fS * LS : B;
  for (const t of wrap(item.product_name, fullW, 2)) { if (y + iS > limit + 1) break; g.fillText(t, pad, y, fullW); y += iS * LS; }
  if (item.notes) {
    const tS = px(5); font(700, tS);
    for (const t of wrap(item.notes, fullW, Hmm >= 25 ? 3 : 2)) { if (y + tS > limit + 1) break; g.fillText(t, pad, y, fullW); y += tS * LS; }
  }
  if (footer) { font(600, fS); g.fillText(jkt(k.created_at), pad, B - fS, fullW / 2); g.textAlign = 'right'; g.fillText(k.ref, R, B - fS, fullW / 2); g.textAlign = 'left'; }
  return cv;
};

export const customerLabelCanvases = (k: KitchenPrint, p?: StickerCfg) => {
  const total = k.items.reduce((s, i) => s + i.qty, 0); let n = 0;
  const out: HTMLCanvasElement[] = [];
  k.items.forEach((i) => { for (let x = 0; x < i.qty; x++) out.push(drawCustomerLabel(k, i, ++n, total, p)); });
  return out;
};

export const renderStickers = (k: KitchenPrint, p?: StickerCfg) => {
  const W = p?.labelW || 33, H = p?.labelH || 15;
  const imgs = customerLabelCanvases(k, p).map((c) => `<div class="lbl"><img src="${c.toDataURL('image/png')}"/></div>`);
  const css = `@page{size:${W}mm ${H}mm;margin:0}*{box-sizing:border-box;margin:0}body{margin:0}
.lbl{width:${W}mm;height:${H}mm;overflow:hidden;page-break-after:always;break-after:page}.lbl:last-child{page-break-after:auto;break-after:auto}
.lbl img{width:${W}mm;height:${H}mm;display:block;image-rendering:pixelated}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Stiker ${esc(k.ref)}</title><style>${css}</style></head><body>${imgs.join('')}</body></html>`;
};

export interface ShiftReportPrint {
  kind: 'X' | 'Z'; branch_name: string; kasir_name: string; shift_type: string;
  opened_at: string; closed_at?: string | null; printed_at: string;
  opening_cash: number; cash_in: number; cash_out: number;
  payments: { method: string; count: number; amount: number }[];
  categories: { category: string; qty: number; amount: number }[];
  products?: { name: string; qty: number; amount: number; brand?: string; category?: string }[];
  order_types?: { type: string; count: number; amount: number }[];
  discount_by_product?: number;
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
    // Real size off-screen: Chrome fails ("Print Failed") on 0×0 frames or frames removed while the print preview is open.
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:800px;border:0';
    document.body.appendChild(iframe);
    const d = iframe.contentDocument!;
    d.open(); d.write(html); d.close();
    let done = false;
    const finish = () => { if (done) return; done = true; setTimeout(() => { iframe.remove(); resolve(); }, 500); };
    setTimeout(() => {
      const w = iframe.contentWindow;
      try { w?.addEventListener('afterprint', finish); w?.focus(); w?.print(); } catch { finish(); }
      setTimeout(finish, 120000);
    }, 400);
  });

export const printHtml = async (html: string, copies = 1) => {
  for (let i = 0; i < Math.max(1, copies); i++) await printOnce(html);
};

const enabled = (s: PrintSettings, role: PrinterRole) => s.printers.filter((p) => p.enabled && p.role === role);

// ---------- Raw encoders (Bluetooth) ----------
const colsOf = (p: PrinterConfig) => (p.paper === '58' ? 32 : 48);
const ascii = (x: unknown) => String(x ?? '');

const logoCache = new Map<string, HTMLCanvasElement | null>();
/** Loads the logo into a printer-width canvas (white background); null when it can't be loaded. */
const logoCanvas = async (url: string, dots: number) => {
  const key = `${url}|${dots}`;
  if (logoCache.has(key)) return logoCache.get(key)!;
  const c = await new Promise<HTMLCanvasElement | null>((res) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    const t = setTimeout(() => res(null), 4000);
    img.onload = () => {
      clearTimeout(t);
      const w = Math.min(dots, Math.round(img.naturalWidth * (120 / Math.max(1, img.naturalHeight))));
      const h = Math.max(1, Math.round(img.naturalHeight * (w / img.naturalWidth)));
      const cv = document.createElement('canvas'); cv.width = Math.ceil(w / 8) * 8; cv.height = h;
      const ctx = cv.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, h);
      ctx.drawImage(img, 0, 0, w, h);
      try { ctx.getImageData(0, 0, 1, 1); res(cv); } catch { res(null); }
    };
    img.onerror = () => { clearTimeout(t); res(null); };
    img.src = url;
  });
  logoCache.set(key, c);
  return c;
};

export const escReceipt = async (d: ReceiptPrint, s: PrintSettings, p: PrinterConfig) => {
  const L = layoutOf(s); const e = new EscPos(colsOf(p));
  e.align('c');
  if (L.showLogo && L.logoUrl) {
    const cv = await logoCanvas(L.logoUrl, Math.round((p.paper === '58' ? 384 : 576) * 0.6));
    if (cv) e.image(cv);
  }
  e.bold(true).size(2, 2).line(L.brandName || d.branch_name).size(1, 1).bold(false);
  if (L.brandName) e.line(d.branch_name);
  [L.address, L.phone, L.instagram, s.receiptHeader].filter(Boolean).forEach((x) => e.line(x));
  if (L.showQueue) e.hr().line('No. Antrean').bold(true).size(2, 2).line(queueLabel(d)).size(1, 1).bold(false);
  e.align('l').hr('=').row('No. Struk', d.transaction_number).row('Tanggal', jkt(d.created_at));
  if (L.showCashier) e.row('Kasir', d.kasir_name);
  if (L.showOrderType) e.row('Tipe', d.order_type.replace('_', ' ').toUpperCase() + (d.table_number ? ` Meja ${d.table_number}` : ''));
  if (L.showCustomer && d.customer_name) e.row('Customer', d.customer_name);
  e.hr('=');
  d.items.forEach((i) => {
    if (L.showUnitPrice) { e.line(i.product_name).row(`  ${i.qty} x ${rp(i.price || 0)}`, rp(i.subtotal || 0)); }
    else e.row(`${i.qty}x ${i.product_name}`, rp(i.subtotal || 0));
    if (L.showNotes && i.notes) e.line(`  ${i.notes}`);
  });
  e.hr().row('Subtotal', rp(d.subtotal));
  if (L.showDiscount && d.discount > 0) e.row('Diskon', `-${rp(d.discount)}`);
  if (L.showTaxService && d.service_charge > 0) e.row('Service', rp(d.service_charge));
  if (L.showTaxService && d.tax > 0) e.row('Pajak', rp(d.tax));
  e.bold(true).size(1, 2).row('TOTAL', rp(d.total)).size(1, 1).bold(false).hr();
  if (L.showPayment) {
    if (d.payment_method_2) e.bold(true).row('SPLIT BILL', '').bold(false);
    e.row(d.payment_method_1.toUpperCase(), rp(d.amount_1));
    if (d.payment_method_2) e.row(d.payment_method_2.toUpperCase(), rp(d.amount_2 || 0));
    if (d.change_amount > 0) e.row('Kembalian', rp(d.change_amount));
  }
  e.align('c').barcode(d.transaction_number).hr('=').line(s.receiptFooter);
  if (L.wifiName) e.line(`WiFi: ${L.wifiName}${L.wifiPass ? ` Pass: ${L.wifiPass}` : ''}`);
  if (L.policy) e.line(L.policy);
  if (L.showQr && L.qrUrl) { e.line().qr(L.qrUrl, p.paper === '58' ? 5 : 7); if (L.qrCaption) e.bold(true).line(L.qrCaption).bold(false); }
  if (L.showPoweredBy) e.line('Powered by Flow F&B');
  return e.feed(4).cut().bytes();
};

export const escKitchen = (k: KitchenPrint, p: PrinterConfig) => {
  const e = new EscPos(colsOf(p));
  e.align('c').bold(true).line(k.station.toUpperCase());
  if (k.addition) e.line('** TAMBAHAN **');
  e.size(2, 2).line(k.table_number ? `MEJA ${k.table_number}` : `#${kitchenQueue(k)}`).size(1, 1);
  if (k.table_number && k.queue_number) e.line(`Antrean #${kitchenQueue(k)}`);
  e.bold(false);
  e.line(k.order_type.replace('_', ' ').toUpperCase() + (k.customer_name ? ` - ${k.customer_name}` : ''));
  e.line(`${k.ref}  ${jkt(k.created_at)}`).align('l').hr();
  k.items.forEach((i) => { e.bold(true).size(1, 2).line(`${i.qty}x ${i.product_name}`).size(1, 1).bold(false); if (i.notes) e.line(`  >> ${i.notes}`); });
  return e.hr().align('c').line(`Total item: ${k.items.reduce((a, i) => a + i.qty, 0)}`).feed(4).cut().bytes();
};

/** Customer cup labels over Bluetooth: bitmap of the exact preview canvas. */
export const tsplCustomer = (k: KitchenPrint, p: PrinterConfig) =>
  tsplBitmapLabels(customerLabelCanvases(k, p), p.labelW || 33, p.labelH || 15, 2);

const sendBt = async (p: PrinterConfig, bytes: Uint8Array) => {
  if (p.connection !== 'bluetooth' || !(await btReady(p.id))) return false;
  try { for (let c = 0; c < Math.max(1, p.copies); c++) await btSend(p.id, bytes); return true; }
  catch (e) { console.warn('BT print failed, fallback to system print', e); return false; }
};

export const printReceipt = async (s: PrintSettings, d: ReceiptPrint, auto: boolean) => {
  for (const p of enabled(s, 'receipt')) {
    if (auto && !p.autoPrint) continue;
    if (await sendBt(p, await escReceipt(d, s, p))) continue;
    await printHtml(renderReceipt(d, s, p.paper), p.copies);
  }
};

/** Sends kitchen tickets + cup stickers to every matching station printer. */
export const printKitchen = async (s: PrintSettings, k: Omit<KitchenPrint, 'station'>, auto = true) => {
  for (const p of [...enabled(s, 'kitchen'), ...enabled(s, 'sticker')]) {
    if (auto && !p.autoPrint) continue;
    const items = routeItems(p, k.items);
    if (!items.length) continue;
    const kk = { ...k, station: p.name, items };
    if (await sendBt(p, p.role === 'sticker' ? tsplCustomer(kk, p) : escKitchen(kk, p))) continue;
    const html = p.role === 'sticker' ? renderStickers(kk, p) : renderKitchenTicket(kk, p.paper);
    await printHtml(html, p.copies);
  }
};

/** Manual 1-click: cup stickers only, for every enabled sticker printer. */
export const printStickersOnly = async (s: PrintSettings, k: Omit<KitchenPrint, 'station'>) => {
  const ps = enabled(s, 'sticker');
  const targets = ps.length ? ps : [newPrinter('sticker', 'Stiker')];
  for (const p of targets) {
    const items = routeItems(p, k.items);
    if (!items.length) continue;
    const kk = { ...k, station: p.name, items };
    if (await sendBt(p, tsplCustomer(kk, p))) continue;
    await printHtml(renderStickers(kk, p), p.copies);
  }
};

/** Rider/CK stickers over Bluetooth to the branch's sticker printer. Returns false if none connected. */
export const printRawToSticker = async (branchId: string | null, labels: TsplLabel[]) => {
  const s = await loadPrintSettings(branchId);
  const p = enabled(s, 'sticker').find((x) => x.connection === 'bluetooth');
  if (!p) return false;
  return sendBt({ ...p, copies: 1 }, tsplLabels(labels, p.labelW || 33, p.labelH || 15, 2, p.fontScale ?? 100, p.lineSpacing ?? 1.25));
};

/** Same as printRawToSticker but sends pre-rendered bitmap bytes (exact preview match). */
export const printBytesToSticker = async (branchId: string | null, build: (wMm: number, hMm: number) => Promise<Uint8Array>) => {
  const s = await loadPrintSettings(branchId);
  const p = enabled(s, 'sticker').find((x) => x.connection === 'bluetooth');
  if (!p || !(await btReady(p.id))) return false;
  return sendBt({ ...p, copies: 1 }, await build(p.labelW || 33, p.labelH || 15));
};

export const printShiftReport = async (s: PrintSettings, r: ShiftReportPrint) => {
  const p = enabled(s, 'receipt')[0];
  await printHtml(renderShiftReport(r, p?.paper || '80', s));
};

// ---------- Shift report data ----------
/** Bill share per payment method. Single payments count the bill total (never cash tendered minus change). */
export const shiftPaymentSplit = (t: any): [string, number][] => {
  const total = Number(t.total || 0);
  if (!t.payment_method_2) return t.payment_method_1 ? [[t.payment_method_1, total]] : [];
  const a1 = Number(t.amount_1 || 0), a2 = Number(t.amount_2 || 0);
  const over = Math.max(0, a1 + a2 - total);
  // Overpayment (change) always comes out of the cash part.
  const r1 = t.payment_method_1 === 'cash' ? a1 - over : a1;
  const r2 = t.payment_method_1 !== 'cash' && t.payment_method_2 === 'cash' ? a2 - over : a2;
  return [[t.payment_method_1, r1], [t.payment_method_2, r2]];
};
export const buildShiftReport = async (shift: any, meta: { kind: 'X' | 'Z'; branch_name: string; kasir_name: string }): Promise<ShiftReportPrint> => {
  const db = supabase as any;
  const { data: txs } = await db.from('pos_transactions')
    .select('id,total,subtotal,discount_item,discount_bill,service_charge,tax,payment_method_1,amount_1,payment_method_2,amount_2,change_amount,status,order_type')
    .eq('shift_id', shift.id);
  const all = txs || [];
  const paid = all.filter((t: any) => t.status === 'paid');
  const pay: Record<string, { count: number; amount: number }> = {};
  const add = (m: string | null, a: number) => { if (!m) return; pay[m] ??= { count: 0, amount: 0 }; pay[m].count++; pay[m].amount += a; };
  paid.forEach((t: any) => {
    const split = shiftPaymentSplit(t);
    split.forEach(([m, a]) => add(m, a));
  });
  const ids = paid.map((t: any) => t.id);
  const cats: Record<string, { qty: number; amount: number }> = {};
  const prods: Record<string, { qty: number; amount: number; brand?: string; category?: string }> = {};
  const brandOf: Record<string, string> = {};
  const types: Record<string, { count: number; amount: number }> = {};
  paid.forEach((t: any) => { const k = t.order_type || 'dine_in'; types[k] ??= { count: 0, amount: 0 }; types[k].count++; types[k].amount += Number(t.total || 0); });
  for (let i = 0; i < ids.length; i += 200) {
    const { data: items } = await db.from('pos_transaction_items').select('category,product_name,product_id,qty,subtotal_item').in('transaction_id', ids.slice(i, i + 200));
    const pids = [...new Set((items || []).map((x: any) => x.product_id).filter((x: any) => x && !brandOf[x]))];
    if (pids.length) {
      const { data: ps } = await db.from('products').select('id,brand').in('id', pids);
      (ps || []).forEach((p: any) => { brandOf[p.id] = p.brand || ''; });
    }
    (items || []).forEach((it: any) => {
      const c = it.category || 'Lainnya';
      cats[c] ??= { qty: 0, amount: 0 };
      cats[c].qty += Number(it.qty || 0); cats[c].amount += Number(it.subtotal_item || 0);
      const n = it.product_name || 'Item';
      prods[n] ??= { qty: 0, amount: 0, brand: brandOf[it.product_id] || 'Lainnya', category: c };
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
    order_types: Object.entries(types).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.amount - a.amount),
    categories: Object.entries(cats).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    gross: sum('subtotal'), discount: sum('discount_item') + sum('discount_bill'), service: sum('service_charge'), tax: sum('tax'),
    net: sum('total'), tx_count: paid.length, void_count: all.filter((t: any) => t.status === 'void' || t.status === 'voided').length,
    expected_cash: expected,
    closing_cash: shift.closing_cash ?? null,
    difference: shift.closing_cash != null ? Number(shift.closing_cash) - expected : null,
    notes: shift.notes ?? null,
  };
};
