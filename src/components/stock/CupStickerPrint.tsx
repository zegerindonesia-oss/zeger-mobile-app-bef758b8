import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer, Tag, Bluetooth } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { printRawToSticker, printHtml } from "@/lib/pos-printing";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface StickerItem { name: string; short_name?: string | null; price?: number | null; shelf_life_days?: number | null; qty: number; }

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
        <div className="p">{Math.round(it.price || 0).toLocaleString("id-ID")}</div>
        <div className="d">SD : {fmt(sd)}</div>
        <div className="d">ED : {fmt(ed)}</div>
      </div>
      <div className="r">
        <div className="b">Zeger!<small>COFFEE</small></div>
        {qr && <QRCodeSVG value={qr} size={64} level="L" />}
        <div className="rd">{rider}</div>
      </div>
    </div>
  );
}

export interface StickerCfg { w: number; h: number; font: number; line: number; pad: number; }
export const DEFAULT_STICKER_CFG: StickerCfg = { w: 33, h: 15, font: 100, line: 1.0, pad: 0.5 };
const CFG_KEY = "zeger_sticker_cfg";
export const loadStickerCfg = (): StickerCfg => { try { return { ...DEFAULT_STICKER_CFG, ...JSON.parse(localStorage.getItem(CFG_KEY) || "{}") }; } catch { return DEFAULT_STICKER_CFG; } };

export const stickerCss = (c: StickerCfg = DEFAULT_STICKER_CFG) => {
  const k = c.font / 100; const f = (n: number) => +(n * k * (c.h / 15)).toFixed(2); const L = c.line;
  const side = +(c.w * 0.26).toFixed(2);
  return `@page{size:${c.w}mm ${c.h}mm;margin:0}*{box-sizing:border-box;margin:0}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}
.stk{width:${c.w}mm;height:${c.h}mm;padding:${c.pad}mm;display:flex;gap:.4mm;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.stk:last-child{page-break-after:auto;break-after:auto}
.l{flex:1;min-width:0;line-height:${L};display:flex;flex-direction:column;justify-content:space-between}.n{font-weight:900;font-size:${f(7.5)}pt;line-height:${L};max-height:${2 * L}em;overflow:hidden;word-break:break-word}
.p{font-weight:900;font-size:${f(10)}pt;line-height:${L}}
.d{font-weight:700;font-size:${f(5.4)}pt;line-height:${L}}.r{width:${side}mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
.b{font-weight:900;font-size:${f(4.6)}pt;color:#c00;text-align:center;line-height:1}.b small{display:block;font-size:${f(2.4)}pt;color:#000;letter-spacing:.3px}
.rd{font-weight:700;font-size:${f(3.6)}pt;white-space:nowrap;max-width:${side}mm;overflow:hidden;text-align:center}.r svg{width:${+(side * 0.82).toFixed(2)}mm;height:${+(side * 0.82).toFixed(2)}mm}`;
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
        const labels = list.flatMap((it) => Array.from({ length: it.qty }, () => ({
          lines: [
            { text: (it.short_name || it.name).slice(0, 16), bold: true },
            { text: Math.round(it.price || 0).toLocaleString("id-ID"), big: true },
            { text: `SD:${fmt(sd)}` },
            { text: `ED:${fmt(addDays(sd, it.shelf_life_days || DEFAULT_DAYS))}` },
          ],
          qr, side: [rider],
        })));
        if (await printRawToSticker(userProfile?.branch_id || null, labels)) { toast.success(`${total} stiker terkirim ke printer Bluetooth`); return; }
        toast.info("Printer Bluetooth belum terhubung, membuka dialog cetak PC");
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
            <label>Jarak tepi (mm)<Input type="number" step="0.1" value={cfg.pad} onChange={(e) => setCfg({ pad: Math.max(0, Number(e.target.value)) })} /></label>
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
