import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { tableQrUrl } from '@/lib/table-qr';

export type QrTemplate = 'tent' | 'sticker' | 'thermal';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const card = (tpl: QrTemplate, branchId: string, branchName: string, table: string, wifi?: string) => {
  const size = tpl === 'tent' ? 260 : tpl === 'sticker' ? 170 : 200;
  const qr = renderToStaticMarkup(<QRCodeSVG value={tableQrUrl(branchId, table)} size={size} level="M" marginSize={1} />);
  return `<div class="card ${tpl}">
    <div class="brand">${esc(branchName)}</div>
    <div class="table">MEJA ${esc(table)}</div>
    <div class="qr">${qr}</div>
    <div class="cta">Scan untuk Pesan</div>
    ${tpl !== 'sticker' ? `<div class="sub">Pesan dari meja · Kumpulkan poin member</div>` : ''}
    ${wifi && tpl === 'tent' ? `<div class="wifi">WiFi: ${esc(wifi)}</div>` : ''}
  </div>`;
};

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111}
body{display:flex;flex-wrap:wrap;gap:6mm;padding:6mm;justify-content:center}
.card{border:1px dashed #999;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;page-break-inside:avoid}
.tent{width:105mm;height:148mm;padding:8mm;gap:4mm}
.sticker{width:62mm;height:80mm;padding:4mm;gap:2mm;border-radius:6mm}
.thermal{width:58mm;padding:3mm;gap:2mm;border:none}
.brand{font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase}
.table{font-size:34px;font-weight:800}
.sticker .table{font-size:22px}
.cta{font-size:16px;font-weight:700}
.sub,.wifi{font-size:11px;color:#444}
@media print{.card{border-color:#ddd}.thermal{border:none}@page{margin:4mm}}
`;

export const printTableQrs = (
  tpl: QrTemplate, branchId: string, branchName: string, tables: string[], wifi?: string,
) => {
  const w = window.open('', '_blank', 'width=900,height=900');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><title>QR Meja</title><style>${CSS}</style></head><body>${tables
    .map((t) => card(tpl, branchId, branchName, t, wifi)).join('')}<script>setTimeout(()=>window.print(),400)</script></body></html>`);
  w.document.close();
  return true;
};
