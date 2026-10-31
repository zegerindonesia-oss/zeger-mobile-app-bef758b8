import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer, Tag, Bluetooth } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { printBytesToSticker, printHtml } from "@/lib/pos-printing";
import { tsplBitmapLabels } from "@/lib/bt-printer";

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** Draws one sticker at 203dpi (8 dots/mm), mirroring the HTML preview layout. */
async function drawStickerCanvas(it: StickerItem, rider: string, sd: Date, qr: string, c: StickerCfg) {
  const D = 8, W = Math.round(c.w * D), H = Math.round(c.h * D);
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); g.fillStyle = "#000"; g.textBaseline = "top";
  const k = (c.font / 100) * (c.h / 15); const pt = (n: number) => n * k * 0.3528 * D; // pt → dots
  const m = (v?: number) => (v ?? c.pad) * D;
  const L = m(c.ml), T = m(c.mt), R = W - m(c.mr), B = H - m(c.mb), innerH = B - T;
  const sideW = Math.min(c.w * 0.4 * D, innerH);
  const lx = L, lw = R - sideW - 0.4 * D - L, rx = R - sideW;
  const font = (w: number, s: number) => (g.font = `${w} ${s}px Arial, Helvetica, sans-serif`);
  // left column
  const name = it.short_name || it.name; const nS = pt(7); font(900, nS);
  const words = name.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (g.measureText(t).width > lw && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const nl = lines.slice(0, 2); nl.forEach((t, i) => g.fillText(t, lx, T + i * nS * c.line, lw));
  const ed = addDays(sd, it.shelf_life_days || DEFAULT_DAYS);
  const dS = pt(5.2), pS = pt(9.5);
  if (!it.hide_dates) { font(700, dS); g.fillText(`ED : ${fmt(ed)}`, lx, B - dS, lw); g.fillText(`SD : ${fmt(sd)}`, lx, B - dS * 2 * c.line, lw); }
  const top = T + nl.length * nS * c.line, bot = it.hide_dates ? B : B - dS * 2 * c.line;
  if (!it.hide_price) { font(900, pS); g.fillText(Math.round(it.price || 0).toLocaleString("id-ID"), lx, top + (bot - top - pS) / 2, lw); }
  // right column
  const cx = rx + sideW / 2; g.textAlign = "center";
  const logo = await loadImg(ZEGER_BEAN_LOGO); const bS = pt(4.4), sS = pt(2.3), lh = pt(5.5);
  font(900, bS); const bw = Math.max(g.measureText("Zeger!").width, 0);
  const totalW = lh + 0.3 * D + bw; const sx = cx - totalW / 2;
  if (logo) g.drawImage(logo, sx, T, lh, lh);
  g.fillText("Zeger!", sx + lh + 0.3 * D + bw / 2, T); font(400, sS); g.fillText("COFFEE", sx + lh + 0.3 * D + bw / 2, T + bS);
  const mt = rider.trim().match(/^([A-Za-z]{1,3}-?\d+)\s+(.+)$/); const rl = mt ? [mt[1], mt[2]] : [rider];
  const rS = pt(5.2); font(900, rS);
  rl.forEach((t, i) => g.fillText(t, cx, B - (rl.length - i) * rS * 1.05, sideW));
  if (qr) {
    const q = Math.round((innerH * 0.3) / D * D);
    const svg = renderToStaticMarkup(<QRCodeSVG value={qr} size={q} level="L" />);
    const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    const hTop = T + Math.max(lh, bS + sS), hBot = B - rl.length * rS * 1.05;
    if (img) { g.imageSmoothingEnabled = false; g.drawImage(img, Math.round(cx - q / 2), Math.round(hTop + (hBot - hTop - q) / 2), q, q); }
  }
  return cv;
}
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ZEGER_BEAN_LOGO } from "@/assets/zeger-bean-logo";

export interface StickerItem { name: string; short_name?: string | null; price?: number | null; shelf_life_days?: number | null; qty: number; hide_price?: boolean; hide_dates?: boolean; }

const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const DEFAULT_DAYS = 3;

export function Sticker({ it, rider, sd, qr }: { it: StickerItem; rider: string; sd: Date; qr: string }) {
  const ed = addDays(sd, it.shelf_life_days || DEFAULT_DAYS);
  return (
    <div className="stk">
      <div className="l">
        <div className="n">{it.short_name || it.name}</div>
        {it.hide_price ? <div /> : <div className="p">{Math.round(it.price || 0).toLocaleString("id-ID")}</div>}
        {!it.hide_dates && <div className="d">SD : {fmt(sd)}</div>}
        {!it.hide_dates && <div className="d">ED : {fmt(ed)}</div>}
      </div>
      <div className="r">
        <div className="bw"><img className="lg" src={ZEGER_BEAN_LOGO} alt="" /><div className="b">Zeger!<small>COFFEE</small></div></div>
        {qr && <QRCodeSVG value={qr} size={64} level="L" />}
        {(() => { const m = rider.trim().match(/^([A-Za-z]{1,3}-?\d+)\s+(.+)$/); return m
          ? <div className="rd"><div>{m[1]}</div><div>{m[2]}</div></div>
          : <div className="rd">{rider}</div>; })()}
      </div>
    </div>
  );
}

export interface StickerCfg { w: number; h: number; font: number; line: number; pad: number; ml?: number; mt?: number; mr?: number; mb?: number; }
export const DEFAULT_STICKER_CFG: StickerCfg = { w: 33, h: 15, font: 100, line: 1.0, pad: 0.5, ml: 0.5, mt: 0.5, mr: 0.5, mb: 0.5 };
const CFG_KEY = "zeger_sticker_cfg";
export const loadStickerCfg = (): StickerCfg => { try { return { ...DEFAULT_STICKER_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; } catch { return DEFAULT_STICKER_CFG; } };

export const stickerCss = (c: StickerCfg = DEFAULT_STICKER_CFG) => {
  const k = c.font / 100; const f = (n: number) => +(n * k * (c.h / 15)).toFixed(2); const L = c.line;
  const m = (v?: number) => v ?? c.pad;
  const innerH = c.h - m(c.mt) - m(c.mb);
  const side = +Math.min(c.w * 0.4, innerH * 1.0).toFixed(2);
  const qrSide = +(innerH * 0.3).toFixed(2);
  return `@page{size:${c.w}mm ${c.h}mm;margin:0}*{box-sizing:border-box;margin:0}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}
.stk{width:${c.w}mm;height:${c.h}mm;padding:${m(c.mt)}mm ${m(c.mr)}mm ${m(c.mb)}mm ${m(c.ml)}mm;display:flex;gap:.4mm;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.stk:last-child{page-break-after:auto;break-after:auto}
.l{flex:1;min-width:0;line-height:${L};display:flex;flex-direction:column;justify-content:space-between}.n{font-weight:900;font-size:${f(7)}pt;line-height:${L};max-height:${2 * L}em;overflow:hidden;word-break:break-word}
.p{font-weight:900;font-size:${f(9.5)}pt;line-height:${L}}
.d{font-weight:700;font-size:${f(5.2)}pt;line-height:${L};white-space:nowrap}.r{width:${side}mm;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;overflow:hidden}
.bw{display:flex;align-items:center;gap:.3mm}.lg{height:${f(5.5) * 0.3528}mm;width:auto}
.b{font-weight:900;font-size:${f(4.4)}pt;color:#c00;text-align:center;line-height:1}.b small{display:block;font-size:${f(2.3)}pt;color:#000;letter-spacing:.3px}
.rd{font-weight:900;font-size:${f(5.2)}pt;line-height:1.05;white-space:nowrap;max-width:100%;overflow:hidden;text-align:center}.r svg{width:${qrSide}mm;height:${qrSide}mm;flex-shrink:0}`;
};
export const STICKER_CSS = stickerCss();

export function CupStickerButton({ items, rider }: { items: StickerItem[]; rider: string }) {
  const [qr, setQr] = useState(() => localStorage.getItem("zeger_sticker_qr") || "https://shorturl.at/d5luh");
  const [sdStr, setSdStr] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const sd = new Date(sdStr + "T00:00:00");
  const list = items.filter((i) => i.qty > 0);
  const total = list.reduce((s, i) => s + i.qty, 0);

  const [cfg, setCfgState] = useState<StickerCfg>(loadStickerCfg);
  const setCfg = (p: Partial<StickerCfg>) => setCfgState((c) => { const n = { ...c, ...p }; localStorage.setItem(CFG_KEY, JSON.stringify(n)); return n; });
  const [mode, setMode] = useState<"pc" | "bt">(() => (localStorage.getItem("zeger_sticker_mode") as any) || "pc");
  const css = stickerCss(cfg);
  const { userProfile } = useAuth() as any;
  const [busy, setBusy] = useState(false);
  const print = async () => {
    localStorage.setItem("zeger_sticker_qr", qr);
    localStorage.setItem("zeger_sticker_mode", mode);
    setBusy(true);
    try {
      if (mode === "bt") {
        const ok = await printBytesToSticker(userProfile?.branch_id || null, async () => {
          const canvases: HTMLCanvasElement[] = [];
          for (const it of list) { const c = await drawStickerCanvas(it, rider, sd, qr, cfg); for (let i = 0; i < it.qty; i++) canvases.push(c); }
          return tsplBitmapLabels(canvases, cfg.w, cfg.h);
        });
        if (ok) { toast.success(`${total} stiker terkirim ke printer Bluetooth`); return; }
        toast.info("Printer stiker Bluetooth belum diatur. Buka Pengaturan Printer → Stiker Cup → Hubungkan, lalu Simpan. Sementara membuka dialog cetak.");
      }
      const html = list.flatMap((it) => Array.from({ length: it.qty }, () => renderToStaticMarkup(<Sticker it={it} rider={rider} sd={sd} qr={qr} />))).join("");
      await printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Stiker ${esc(rider)}</title><style>${css}</style></head><body>${html}</body></html>`);
    } catch (e) { toast.error("Gagal mencetak stiker"); console.error(e); } finally { setBusy(false); }
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" className="btn-glossy-primary" disabled={!total}><Tag className="mr-1 h-4 w-4" />Cetak Stiker ({total})</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Stiker Cup — {rider}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Tanggal Produksi (SD)<Input type="date" value={sdStr} onChange={(e) => setSdStr(e.target.value)} /></label>
          <label className="text-xs">Link QR Code<Input value={qr} onChange={(e) => setQr(e.target.value)} /></label>
        </div>
        <style>{`.stk-prev .stk{transform:scale(2.2);transform-origin:top left;margin-bottom:19mm;border:1px dashed hsl(var(--border));border-radius:2mm}${css.replace(/@page[^}]*}/, "").replace(/\*\{[^}]*}/, "").replace(/body\{[^}]*}/, "")}`}</style>
        <div className="stk-prev space-y-1">
          {list.map((it, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground">{it.name} × {it.qty} • masa simpan H+{it.shelf_life_days || DEFAULT_DAYS}</p>
              <div style={{ height: `${cfg.h * 2.2 + 4}mm` }}><Sticker it={it} rider={rider} sd={sd} qr={qr} /></div>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex gap-2">
            {([["pc", "Printer PC / USB"], ["bt", "Bluetooth (POS)"]] as const).map(([v, l]) => (
              <Button key={v} size="sm" variant={mode === v ? "default" : "outline"} onClick={() => setMode(v)}>{l}</Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <label>Lebar (mm)<Input type="number" value={cfg.w} onChange={(e) => setCfg({ w: Number(e.target.value) || 33 })} /></label>
            <label>Tinggi (mm)<Input type="number" value={cfg.h} onChange={(e) => setCfg({ h: Number(e.target.value) || 15 })} /></label>
          </div>
          <p className="text-xs font-semibold">Jarak tepi (mm) — geser isi stiker</p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {([["ml", "Kiri"], ["mt", "Atas"], ["mr", "Kanan"], ["mb", "Bawah"]] as const).map(([key, l]) => (
              <label key={key}>{l}<Input type="number" step="0.1" min={0} value={cfg[key] ?? cfg.pad} onChange={(e) => setCfg({ [key]: Math.max(0, Number(e.target.value) || 0) })} /></label>
            ))}
          </div>
          <div className="space-y-1"><div className="flex justify-between text-xs"><span>Ukuran tulisan</span><b>{cfg.font}%</b></div>
            <Slider min={70} max={150} step={5} value={[cfg.font]} onValueChange={([v]) => setCfg({ font: v })} /></div>
          <div className="space-y-1"><div className="flex justify-between text-xs"><span>Jarak antar baris</span><b>{cfg.line.toFixed(2)}</b></div>
            <Slider min={0.8} max={2} step={0.05} value={[cfg.line]} onValueChange={([v]) => setCfg({ line: v })} /></div>
          <Button size="sm" variant="ghost" onClick={() => setCfg(DEFAULT_STICKER_CFG)}>Reset ke default</Button>
        </div>
        <Button onClick={print} disabled={busy}><Printer className="mr-2 h-4 w-4" />Cetak {total} Stiker ({cfg.w}×{cfg.h}mm)</Button>
        <p className="text-xs text-muted-foreground"><Bluetooth className="inline h-3 w-3" /> Mode PC: pilih printer stiker di dialog cetak, ukuran kertas sama dengan lebar×tinggi di atas, margin None, skala 100%. Mode Bluetooth: pakai printer stiker yang sudah dihubungkan di Pengaturan Printer POS. Pengaturan tersimpan otomatis.</p>
      </DialogContent>
    </Dialog>
  );
}

export const COPY_PRESETS = [1, 5, 10, 25, 50, 100];
/** Clamps a requested copy count to a safe printable range (1–999). */
export const clampCopies = (n: number) => Math.min(999, Math.max(1, Math.floor(Number(n) || 1)));

/** Free-form label: any text, any price, any number of copies — no order needed. */
export function CustomLabelButton({ trigger }: { trigger?: React.ReactNode }) {
  const today = new Date();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState(() => localStorage.getItem("zeger_custom_label_note") || "");
  const [hidePrice, setHidePrice] = useState(false);
  const [showDates, setShowDates] = useState(true);
  const [days, setDays] = useState(3);
  const [qr, setQr] = useState(() => localStorage.getItem("zeger_sticker_qr") || "https://shorturl.at/d5luh");
  const [copies, setCopies] = useState(1);
  const [sdStr, setSdStr] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const sd = new Date(sdStr + "T00:00:00");
  const cfg = loadStickerCfg(); const css = stickerCss(cfg);
  const [mode, setMode] = useState<"pc" | "bt">(() => (localStorage.getItem("zeger_sticker_mode") as any) || "pc");
  const { userProfile } = useAuth() as any;
  const [busy, setBusy] = useState(false);
  const item: StickerItem = { name: name.trim() || "Nama Label", price: Number(price.replace(/\D/g, "")) || 0, shelf_life_days: days, qty: clampCopies(copies), hide_price: hidePrice, hide_dates: !showDates };

  const print = async () => {
    if (!name.trim()) { toast.error("Isi nama label dulu"); return; }
    localStorage.setItem("zeger_custom_label_note", note); localStorage.setItem("zeger_sticker_qr", qr); localStorage.setItem("zeger_sticker_mode", mode);
    setBusy(true);
    try {
      if (mode === "bt") {
        const ok = await printBytesToSticker(userProfile?.branch_id || null, async () => {
          const c = await drawStickerCanvas(item, note, sd, qr, cfg);
          return tsplBitmapLabels(Array.from({ length: item.qty }, () => c), cfg.w, cfg.h);
        });
        if (ok) { toast.success(`${item.qty} label terkirim ke printer Bluetooth`); return; }
        toast.info("Printer stiker Bluetooth belum diatur. Membuka dialog cetak.");
      }
      const one = renderToStaticMarkup(<Sticker it={item} rider={note} sd={sd} qr={qr} />);
      await printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Label ${esc(item.name)}</title><style>${css}</style></head><body>${one.repeat(item.qty)}</body></html>`);
    } catch (e) { toast.error("Gagal mencetak label"); console.error(e); } finally { setBusy(false); }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger || <Button size="sm" variant="outline"><Tag className="mr-1 h-4 w-4" />Label Custom</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Cetak Label Custom</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-xs">Nama / Tulisan Label<Input value={name} maxLength={40} placeholder="mis. Biji Kopi Robusta 250g" onChange={(e) => setName(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Harga (Rp)<Input inputMode="numeric" value={price} disabled={hidePrice} placeholder="25000" onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} /></label>
            <label className="text-xs">Tulisan kanan bawah<Input value={note} maxLength={20} placeholder="mis. Kemiri" onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={hidePrice} onChange={(e) => setHidePrice(e.target.checked)} />Tanpa harga</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showDates} onChange={(e) => setShowDates(e.target.checked)} />Tampilkan SD / ED</label>
          </div>
          {showDates && <div className="grid grid-cols-2 gap-2">
            <label className="text-xs">Tanggal Produksi (SD)<Input type="date" value={sdStr} onChange={(e) => setSdStr(e.target.value)} /></label>
            <label className="text-xs">Masa simpan (hari)<Input type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} /></label>
          </div>}
          <label className="block text-xs">Link QR (kosongkan = tanpa QR)<Input value={qr} onChange={(e) => setQr(e.target.value)} /></label>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Jumlah cetak</p>
            <div className="flex flex-wrap gap-2">
              {COPY_PRESETS.map((n) => <Button key={n} size="sm" variant={copies === n ? "default" : "outline"} onClick={() => setCopies(n)}>{n}×</Button>)}
              <Input type="number" min={1} max={999} className="w-24 h-9" value={copies} onChange={(e) => setCopies(clampCopies(Number(e.target.value)))} aria-label="Jumlah cetak bebas" />
            </div>
          </div>
          <style>{`.stk-prev .stk{transform:scale(2.2);transform-origin:top left;border:1px dashed hsl(var(--border));border-radius:2mm}${css.replace(/@page[^}]*}/, "").replace(/\*\{[^}]*}/, "").replace(/body\{[^}]*}/, "")}`}</style>
          <div className="stk-prev rounded-lg bg-muted p-3" style={{ height: `${cfg.h * 2.2 + 8}mm` }}><Sticker it={item} rider={note} sd={sd} qr={qr} /></div>
          <div className="flex gap-2">
            {([["pc", "Printer PC / USB"], ["bt", "Bluetooth (POS)"]] as const).map(([v, l]) => (
              <Button key={v} size="sm" variant={mode === v ? "default" : "outline"} onClick={() => setMode(v)}>{l}</Button>
            ))}
          </div>
          <Button className="w-full" onClick={print} disabled={busy}><Printer className="mr-2 h-4 w-4" />Cetak {item.qty} Label ({cfg.w}×{cfg.h}mm)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
