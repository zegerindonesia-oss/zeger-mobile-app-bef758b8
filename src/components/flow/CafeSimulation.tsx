import { useState } from "react";
import cafe from "@/assets/flow-cafe-iso.jpg";

export const SIM_SPOTS = [
  { x: 14, y: 30, t: "Barang Masuk & Invoice", p: "Nota supplier hilang, stok dihitung manual.", s: "Purchase Order, terima barang, invoice & jatuh tempo — stok bertambah otomatis." },
  { x: 26, y: 15, t: "Gudang & Stok", p: "Bahan habis tanpa ketahuan.", s: "Stok real-time, konversi satuan, peringatan stok menipis." },
  { x: 43, y: 20, t: "Dapur (KDS)", p: "Kertas order hilang, pesanan terlambat.", s: "Kitchen Display: tiket lengkap, timer, satu ketuk Siap. Resep memotong bahan otomatis." },
  { x: 37, y: 44, t: "Kasir POS", p: "Antre panjang, salah hitung, kas selisih.", s: "POS sentuh cepat, QRIS/tunai, PIN kasir, tutup shift otomatis." },
  { x: 74, y: 30, t: "TV Antrean", p: "Pelanggan bolak-balik menanyakan pesanan.", s: "Layar antrean dengan nama & suara panggilan otomatis." },
  { x: 58, y: 55, t: "Pesan via QR & App", p: "Pelayan kewalahan saat ramai.", s: "Tamu scan QR meja atau pakai aplikasi, pesanan langsung ke kasir & dapur, notifikasi siap." },
  { x: 82, y: 78, t: "Rider Keliling", p: "Stok & setoran rider sulit diawasi.", s: "Aplikasi rider: jual, stok, setoran kas, laba per unit." },
  { x: 88, y: 38, t: "Back Office Owner", p: "Laporan telat, laba tidak jelas.", s: "Laba rugi per cabang/unit, HPP, CRM & loyalty — semua real-time." },
];

export function CafeSimulation({ large = false }: { large?: boolean }) {
  const [a, setA] = useState(0);
  const cur = SIM_SPOTS[a];
  return (
    <div className="relative w-full">
      <img src={cafe} alt="Simulasi kafe dengan solusi FlowF&B" width={1920} height={1088} loading="lazy" className="w-full h-auto rounded-[32px]" />
      {SIM_SPOTS.map((p, i) => (
        <button key={p.t} onMouseEnter={() => setA(i)} onFocus={() => setA(i)} onClick={() => setA(i)}
          aria-label={p.t} style={{ left: `${p.x}%`, top: `${p.y}%` }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-extrabold shadow-lg ring-4 ring-background/80 transition-transform ${i === a ? "scale-125 animate-pulse" : "hover:scale-110"} ${large ? "h-14 w-14 text-2xl" : "h-9 w-9 text-sm"}`}>
          {i + 1}
        </button>
      ))}
      <div className={`absolute ${large ? "left-8 bottom-8 w-[640px] p-8" : "left-3 bottom-3 right-3 md:right-auto md:w-[380px] p-5"} rounded-[28px] bg-background/80 backdrop-blur-xl border border-background shadow-2xl`}>
        <div className={`font-extrabold text-primary ${large ? "text-[22px]" : "text-xs"} tracking-widest uppercase`}>Langkah {a + 1} · {cur.t}</div>
        <div className={`mt-2 text-muted-foreground ${large ? "text-[26px]" : "text-sm"}`}><b className="text-foreground">Masalah:</b> {cur.p}</div>
        <div className={`mt-1 ${large ? "text-[28px]" : "text-sm"}`}><b className="text-primary">Solusi FlowF&B:</b> {cur.s}</div>
      </div>
    </div>
  );
}
