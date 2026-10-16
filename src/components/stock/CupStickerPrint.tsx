import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Printer, Tag } from "lucide-react";

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

export const STICKER_CSS = `@page{size:33mm 15mm;margin:0}*{box-sizing:border-box;margin:0}body{font-family:Arial,Helvetica,sans-serif;color:#000}
.stk{width:33mm;height:15mm;padding:.4mm .5mm;display:flex;gap:.4mm;overflow:hidden;page-break-after:always;break-after:page;background:#fff}
.l{flex:1;min-width:0;line-height:1.02;display:flex;flex-direction:column;justify-content:space-between}.n{font-weight:900;font-size:7.5pt;line-height:1;max-height:2em;overflow:hidden;word-break:break-word}
.p{font-weight:900;font-size:10pt;line-height:1}
.d{font-weight:700;font-size:5.4pt}.r{width:8.5mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between}
.b{font-weight:900;font-size:4.6pt;color:#c00;text-align:center;line-height:1}.b small{display:block;font-size:2.4pt;color:#000;letter-spacing:.3px}
.rd{font-weight:700;font-size:3.6pt;white-space:nowrap;max-width:8.5mm;overflow:hidden;text-align:center}.r svg{width:7mm;height:7mm}`;

export function CupStickerButton({ items, rider }: { items: StickerItem[]; rider: string }) {
  const [qr, setQr] = useState(() => localStorage.getItem("zeger_sticker_qr") || "https://shorturl.at/d5luh");
  const [sdStr, setSdStr] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const sd = new Date(sdStr + "T00:00:00");
  const list = items.filter((i) => i.qty > 0);
  const total = list.reduce((s, i) => s + i.qty, 0);

  const print = () => {
    localStorage.setItem("zeger_sticker_qr", qr);
    const html = list.flatMap((it) => Array.from({ length: it.qty }, () => renderToStaticMarkup(<Sticker it={it} rider={rider} sd={sd} qr={qr} />))).join("");
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Stiker ${esc(rider)}</title><style>${STICKER_CSS}</style></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
    w.document.close();
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
        <style>{`.stk-prev .stk{transform:scale(2.2);transform-origin:top left;margin-bottom:19mm;border:1px dashed hsl(var(--border));border-radius:2mm}${STICKER_CSS.replace(/@page[^}]*}/, "").replace(/\*\{[^}]*}/, "").replace(/body\{[^}]*}/, "")}`}</style>
        <div className="stk-prev space-y-1">
          {list.map((it, i) => (
            <div key={i}>
              <p className="text-xs text-muted-foreground">{it.name} × {it.qty} • masa simpan H+{it.shelf_life_days || DEFAULT_DAYS}</p>
              <div style={{ height: "35mm" }}><Sticker it={it} rider={rider} sd={sd} qr={qr} /></div>
            </div>
          ))}
        </div>
        <Button onClick={print}><Printer className="mr-2 h-4 w-4" />Cetak {total} Stiker (33×15mm)</Button>
        <p className="text-xs text-muted-foreground">Pilih printer stiker (mis. Xprinter XP-420B) di dialog cetak, ukuran kertas 33×15mm, margin none.</p>
      </DialogContent>
    </Dialog>
  );
}
