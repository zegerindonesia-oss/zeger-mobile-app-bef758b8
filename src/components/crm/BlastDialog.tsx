import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { waPhone } from "@/lib/crm-segments";

type Target = { id: string; name: string | null; phone: string | null; email: string | null };

const fill = (t: string, c: Target) => t.replace(/\{nama\}/gi, (c.name || "Kak").split(" ")[0]);

export function BlastDialog({ open, onOpenChange, targets }: { open: boolean; onOpenChange: (v: boolean) => void; targets: Target[] }) {
  const [msg, setMsg] = useState("Halo {nama}! Ada promo spesial minggu ini di Zeger Coffee ☕ Tunjukkan pesan ini ke kasir ya.");
  const [subject, setSubject] = useState("Promo Spesial Zeger Coffee");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const wa = useMemo(() => targets.filter((c) => waPhone(c.phone || "").length >= 10), [targets]);
  const mail = useMemo(() => targets.filter((c) => /\S+@\S+\.\S+/.test(c.email || "")), [targets]);

  const openWa = (c: Target) => {
    window.open(`https://wa.me/${waPhone(c.phone || "")}?text=${encodeURIComponent(fill(msg, c))}`, "_blank");
    setSent((s) => new Set(s).add(c.id));
  };
  const nextWa = () => { const c = wa.find((x) => !sent.has(x.id)); if (c) openWa(c); else toast.success("Semua sudah dikirim"); };
  const emails = mail.map((c) => c.email).join(",");
  const plain = msg.replace(/\{nama\}/gi, "Pelanggan");

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSent(new Set()); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" />Kirim Promo</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Target mengikuti filter di tab Data Pelanggan ({targets.length} pelanggan). Gunakan <b>{"{nama}"}</b> untuk nama depan.</p>
        <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <Tabs defaultValue="wa">
          <TabsList><TabsTrigger value="wa"><MessageCircle className="w-4 h-4 mr-1" />WhatsApp ({wa.length})</TabsTrigger><TabsTrigger value="mail"><Mail className="w-4 h-4 mr-1" />Email ({mail.length})</TabsTrigger></TabsList>
          <TabsContent value="wa" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">Terkirim {sent.size}/{wa.length}</span>
              <Button onClick={nextWa} disabled={!wa.length}><Send className="w-4 h-4 mr-2" />Kirim ke berikutnya</Button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y rounded-md border">
              {wa.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 text-sm">
                  <div><div className="font-medium">{c.name || "-"}</div><div className="text-xs text-muted-foreground">{c.phone}</div></div>
                  {sent.has(c.id) ? <Badge variant="secondary"><Check className="w-3 h-3 mr-1" />Dibuka</Badge>
                    : <Button size="sm" variant="outline" onClick={() => openWa(c)}>Kirim</Button>}
                </div>
              ))}
              {!wa.length && <p className="p-4 text-center text-sm text-muted-foreground">Tidak ada nomor WA valid</p>}
            </div>
          </TabsContent>
          <TabsContent value="mail" className="space-y-3">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subjek email" />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!mail.length} onClick={() => { window.location.href = `mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plain)}`; }}><Mail className="w-4 h-4 mr-2" />Buka di aplikasi email (BCC)</Button>
              <Button variant="outline" disabled={!mail.length} onClick={() => { navigator.clipboard.writeText(emails); toast.success("Daftar email disalin"); }}><Copy className="w-4 h-4 mr-2" />Salin daftar email</Button>
            </div>
            <p className="text-xs text-muted-foreground">Untuk daftar besar, tempel daftar email ke Gmail/Mailchimp. Email dikirim sebagai BCC agar privasi pelanggan terjaga.</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
