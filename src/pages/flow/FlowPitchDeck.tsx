import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react";
import { PLANS, formatPrice } from "@/lib/flow-plans";

/* ---------- Slide frame ---------- */
const Frame = ({ children, n }: { children: ReactNode; n: number }) => (
  <div className="pitch-slide">
    <div className="pitch-blob pitch-blob-a" />
    <div className="pitch-blob pitch-blob-b" />
    <div className="relative z-10 h-full w-full px-[120px] pt-[90px] pb-[80px] flex flex-col">{children}</div>
    <div className="absolute bottom-10 left-[120px] right-[120px] z-10 flex justify-between pitch-chrome text-muted-foreground">
      <span className="font-bold">FlowF&amp;B · The Complete F&amp;B Operating System</span>
      <span>{String(n).padStart(2, "0")}</span>
    </div>
  </div>
);
const Kicker = ({ children }: { children: ReactNode }) => (
  <span className="pitch-pill pitch-kicker text-primary self-start">{children}</span>
);
const Glass = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`pitch-glass rounded-[40px] p-10 ${className}`}>{children}</div>
);
const Card = ({ t, d }: { t: string; d: string }) => (
  <Glass className="flex flex-col gap-4">
    <div className="h-3 w-16 rounded-full bg-primary" />
    <h3 className="pitch-body-lg font-extrabold">{t}</h3>
    <p className="pitch-caption text-muted-foreground">{d}</p>
  </Glass>
);

/* ---------- Slides ---------- */
const slides: { title: string; render: (n: number) => ReactNode }[] = [
  { title: "Cover", render: (n) => (
    <Frame n={n}>
      <div className="flex-1 flex flex-col justify-center gap-10 max-w-[1300px]">
        <Kicker>Proposal Kemitraan · FlowF&amp;B</Kicker>
        <h1 className="pitch-title-lg font-black">Satu sistem untuk seluruh bisnis F&amp;B Anda.</h1>
        <p className="pitch-body-lg text-muted-foreground max-w-[1100px]">Kasir, dapur, layar antrean, aplikasi pelanggan, armada keliling, stok, hingga laba rugi — terhubung otomatis dalam satu ekosistem.</p>
        <div className="flex gap-4">{["POS", "KDS", "TV Antrean", "Customer App", "Rider", "HPP & Stok", "Laba Rugi"].map((x) => <span key={x} className="pitch-pill pitch-chrome font-bold">{x}</span>)}</div>
      </div>
    </Frame>) },
  { title: "Masalah", render: (n) => (
    <Frame n={n}>
      <Kicker>Masalah di lapangan</Kicker>
      <h2 className="pitch-title font-black mt-8">Bisnis F&amp;B berjalan di banyak aplikasi yang tidak saling bicara.</h2>
      <div className="grid grid-cols-2 gap-8 mt-14 flex-1">
        <Card t="Aplikasi terpisah, biaya berlipat" d="Kasir, KDS, layar antrean, dan akuntansi dibayar terpisah dan datanya diinput ulang." />
        <Card t="HPP & stok tidak terkontrol" d="Resep tidak memotong bahan baku otomatis; menu rugi tidak terlihat." />
        <Card t="Dapur salah & lambat" d="Kertas order hilang, catatan khusus terlewat, waktu tunggu tidak terukur." />
        <Card t="Cabang & armada sulit diawasi" d="Stok rider, setoran kas, dan laba per unit bercampur jadi satu." />
      </div>
    </Frame>) },
  { title: "Solusi", render: (n) => (
    <Frame n={n}>
      <Kicker>Solusi</Kicker>
      <h2 className="pitch-title font-black mt-8">Satu pesanan, mengalir ke semua titik.</h2>
      <div className="flex-1 flex items-center gap-8 mt-10">
        <div className="flex flex-col gap-6 w-[420px]">{["POS Kasir", "QR Meja", "Aplikasi Customer", "Rider Keliling"].map((x) => <Glass key={x} className="!p-7 pitch-body font-bold">{x}</Glass>)}</div>
        <div className="pitch-core rounded-full h-[340px] w-[340px] shrink-0 flex flex-col items-center justify-center text-primary-foreground text-center">
          <span className="pitch-subtitle font-black">FlowF&amp;B</span><span className="pitch-caption opacity-90">Cloud Engine</span>
        </div>
        <div className="flex flex-col gap-6 flex-1">{["Kitchen Display (KDS)", "Layar TV + Suara Panggilan", "Stok, Resep & Gudang", "Laba Rugi per Unit"].map((x) => <Glass key={x} className="!p-7 pitch-body font-bold">{x}</Glass>)}</div>
      </div>
    </Frame>) },
  { title: "Kasir & Meja", render: (n) => (
    <Frame n={n}>
      <Kicker>Front of House</Kicker>
      <h2 className="pitch-title font-black mt-8">Kasir cepat, tamu pesan sendiri.</h2>
      <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
        <Card t="POS touch-first" d="HP, tablet, atau PC. Tunai, QRIS, transfer, split bill, shift X/Z, struk Bluetooth." />
        <Card t="QR meja tanpa install" d="Tamu scan, pilih menu, pesanan langsung masuk kasir & dapur, meja otomatis terisi." />
        <Card t="Harga per mode" d="Dine-in, takeaway, ojol beda harga otomatis. PIN kasir per staf untuk jejak transaksi." />
      </div>
    </Frame>) },
  { title: "Dapur & Antrean", render: (n) => (
    <Frame n={n}>
      <Kicker>Kitchen &amp; Guest Experience</Kicker>
      <h2 className="pitch-title font-black mt-8">Dapur rapi, pelanggan dipanggil dengan ramah.</h2>
      <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
        <Card t="KDS mode kios" d="Tablet dapur cukup scan QR — tanpa akses kasir. Menu, catatan, timer, centang per item." />
        <Card t="Layar TV antrean" d="Tampilan glass modern, video promosi, estimasi tunggu. Sambung TV dengan kode 6 angka." />
        <Card t="Panggilan suara & notifikasi" d="“Antrian nomor 01, atas nama kak Cintia…” plus notifikasi ke HP pelanggan saat siap." />
      </div>
    </Frame>) },
  { title: "HPP & Stok", render: (n) => (
    <Frame n={n}>
      <Kicker>Back Office</Kicker>
      <h2 className="pitch-title font-black mt-8">Setiap gram bahan baku tercatat.</h2>
      <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
        <Card t="Resep & potong stok otomatis" d="Penjualan memotong bahan baku sesuai resep, lengkap dengan konversi satuan." />
        <Card t="Menu engineering" d="Menu dikelompokkan Stars, Plowhorses, Puzzles, Dogs dari HPP dan penjualan riil." />
        <Card t="Purchase order & gudang" d="PO supplier, terima barang, hutang jatuh tempo, transfer stok antar cabang." />
      </div>
    </Frame>) },
  { title: "Rider & Cabang", render: (n) => (
    <Frame n={n}>
      <Kicker>Armada &amp; Multi-Cabang</Kicker>
      <h2 className="pitch-title font-black mt-8">Gerobak keliling dikontrol seperti outlet.</h2>
      <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
        <Card t="Aplikasi rider" d="Jual keliling dengan stok terkunci anti-oversell, GPS, dan foto retur." />
        <Card t="Setoran anti-fraud" d="Penjualan tunai dikurangi biaya operasional = setoran, diverifikasi berlapis." />
        <Card t="Branch hub & central kitchen" d="Rider pesan stok ke CK, hub kirim & konfirmasi terima dalam satu alur." />
      </div>
    </Frame>) },
  { title: "Laba Rugi", render: (n) => (
    <Frame n={n}>
      <Kicker>Keuangan</Kicker>
      <h2 className="pitch-title font-black mt-8">Laba rugi final, per unit atau gabungan.</h2>
      <div className="grid grid-cols-[1.2fr_1fr] gap-10 mt-14 flex-1">
        <Glass className="flex flex-col gap-6 justify-center">
          {[["Pendapatan (POS + Rider + App)", ""], ["HPP resep + biaya QRIS", "−"], ["Laba kotor", "="], ["Beban operasional per unit", "−"], ["Laba bersih", "="]].map(([l, s]) => (
            <div key={l} className="flex items-center gap-6 pitch-body border-b border-border/60 pb-4 last:border-0"><span className="w-10 font-black text-primary">{s}</span><span className="font-bold">{l}</span></div>
          ))}
        </Glass>
        <div className="flex flex-col gap-8">
          <Card t="Filter fleksibel" d="Semua unit, satu cabang, satu rider, atau centang beberapa sekaligus." />
          <Card t="Ekspor PDF & kirim" d="Laporan siap kirim ke owner atau investor lewat WhatsApp dan email." />
        </div>
      </div>
    </Frame>) },
  { title: "Add-on Custom App", render: (n) => (
    <Frame n={n}>
      <Kicker>Add-on · Aplikasi Custom</Kicker>
      <h2 className="pitch-title font-black mt-8">Butuh aplikasi khusus? Kami bangun, langsung tersambung.</h2>
      <div className="grid grid-cols-4 gap-8 mt-14 flex-1">
        <Card t="Aplikasi brand Anda" d="Customer app dengan logo, warna, dan nama brand sendiri di Play Store & App Store." />
        <Card t="Modul sesuai alur" d="Catering, franchise, membership, booking, atau proses unik bisnis Anda." />
        <Card t="Satu ekosistem" d="Data otomatis masuk ke kasir, dapur, stok, dan laporan yang sama." />
        <Card t="Integrasi" d="Sambungkan ke sistem atau layanan pihak ketiga yang Anda gunakan." />
      </div>
      <p className="pitch-body text-muted-foreground mt-10">Harga add-on disesuaikan cakupan — konsultasi gratis.</p>
    </Frame>) },
  { title: "Perbandingan", render: (n) => {
    const rows: [string, string, string, string][] = [
      ["KDS tablet via scan QR", "✓", "Add-on", "✓"],
      ["TV antrean + panggilan suara nama", "✓", "—", "Add-on"],
      ["QR meja tanpa install", "✓", "Terbatas", "✓"],
      ["Aplikasi rider / armada keliling", "✓", "—", "—"],
      ["Resep, HPP & menu engineering", "✓", "Dasar", "✓"],
      ["Laba rugi per cabang & rider", "✓", "Software lain", "✓"],
      ["Aplikasi customer brand sendiri", "✓", "—", "Mahal"],
    ];
    return (
      <Frame n={n}>
        <Kicker>Perbandingan</Kicker>
        <h2 className="pitch-title font-black mt-8">Paling lengkap di kelas harganya.</h2>
        <Glass className="mt-12 !p-0 overflow-hidden">
          <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr] pitch-caption font-extrabold bg-primary text-primary-foreground px-10 py-6">
            <span>Kemampuan</span><span className="text-center">FlowF&amp;B</span><span className="text-center">POS umum</span><span className="text-center">ERP enterprise</span>
          </div>
          {rows.map((r) => (
            <div key={r[0]} className="grid grid-cols-[2.2fr_1fr_1fr_1fr] pitch-caption px-10 py-5 border-t border-border/60">
              <span className="font-bold">{r[0]}</span>
              <span className="text-center font-black text-primary">{r[1]}</span>
              <span className="text-center text-muted-foreground">{r[2]}</span>
              <span className="text-center text-muted-foreground">{r[3]}</span>
            </div>
          ))}
        </Glass>
        <p className="pitch-chrome text-muted-foreground mt-6">Gambaran umum kategori produk di pasar; detail tiap vendor dapat berbeda.</p>
      </Frame>
    );
  } },
  { title: "Harga", render: (n) => (
    <Frame n={n}>
      <Kicker>Paket Harga</Kicker>
      <h2 className="pitch-title font-black mt-8">Mulai gratis, tumbuh sesuai bisnis.</h2>
      <div className="grid grid-cols-4 gap-6 mt-12">
        {PLANS.map((p) => (
          <div key={p.id} className={`pitch-glass rounded-[36px] p-8 flex flex-col gap-4 ${p.hot ? "ring-4 ring-primary" : ""}`}>
            <span className="pitch-caption font-extrabold">{p.name}</span>
            <span className="pitch-subtitle font-black text-primary">{formatPrice(p.price)}<span className="pitch-chrome text-muted-foreground font-bold">/bln</span></span>
            <span className="pitch-chrome text-muted-foreground">{p.who}</span>
            <ul className="flex flex-col gap-2 mt-2">{p.features.slice(0, 5).map((f) => <li key={f} className="pitch-chrome">• {f}</li>)}</ul>
          </div>
        ))}
      </div>
    </Frame>) },
  { title: "Go-Live", render: (n) => (
    <Frame n={n}>
      <Kicker>Onboarding</Kicker>
      <h2 className="pitch-title font-black mt-8">Siap jalan dalam satu hari.</h2>
      <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
        <Card t="1 · Daftar & isi menu" d="Buat akun bisnis, upload menu dan resep dari template Excel." />
        <Card t="2 · Pakai perangkat yang ada" d="HP, tablet, PC, printer Bluetooth, dan Android TV yang sudah Anda punya." />
        <Card t="3 · Latih tim & buka" d="Tampilan kasir sederhana, staf bisa langsung pakai di hari yang sama." />
      </div>
    </Frame>) },
  { title: "Penutup", render: (n) => (
    <Frame n={n}>
      <div className="flex-1 flex flex-col justify-center items-center text-center gap-10">
        <Kicker>Mari mulai</Kicker>
        <h2 className="pitch-title-lg font-black max-w-[1400px]">Fokus ke rasa dan pelanggan. Sistemnya biar FlowF&amp;B.</h2>
        <p className="pitch-body-lg text-muted-foreground">flowfnb.flowsstack.com · Coba gratis 7 hari</p>
      </div>
    </Frame>) },
];

/* ---------- Scaled stage ---------- */
function Stage({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(0.5);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => setS(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden">
      <div className="pitch-wrapper" style={{ transform: `scale(${s})` }}>{children}</div>
    </div>
  );
}

export default function FlowPitchDeck() {
  const [params, setParams] = useSearchParams();
  const print = params.has("print");
  const total = slides.length;
  const idx = Math.min(Math.max(parseInt(params.get("slide") || "1") - 1 || 0, 0), total - 1);
  const go = useCallback((i: number) => {
    const next = Math.min(Math.max(i, 0), total - 1);
    setParams({ slide: String(next + 1) }, { replace: true });
  }, [setParams, total]);

  useEffect(() => { document.title = print ? "FlowF&B Pitch Deck" : `${idx + 1}/${total} — ${slides[idx].title} · FlowF&B`; }, [idx, total, print]);
  useEffect(() => {
    if (print) { const t = setTimeout(() => window.print(), 900); return () => clearTimeout(t); }
    const k = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) { e.preventDefault(); go(idx + 1); }
      if (["ArrowLeft", "PageUp"].includes(e.key)) go(idx - 1);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [idx, go, print]);

  const touchX = useRef<number | null>(null);

  if (print) {
    return (
      <div className="pitch-print">
        {slides.map((sl, i) => <div key={i} className="pitch-print-page">{sl.render(i + 1)}</div>)}
      </div>
    );
  }

  return (
    <div className="pitch-app h-[100dvh] w-full flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 md:px-8 py-3">
        <Link to="/landing" className="pitch-pill text-sm font-bold flex items-center gap-2"><ArrowLeft className="h-4 w-4" />FlowF&amp;B</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => document.documentElement.requestFullscreen?.()} className="pitch-pill text-sm font-bold hidden md:flex items-center gap-2"><Maximize2 className="h-4 w-4" />Presentasi</button>
          <a href="/pitch?print" target="_blank" rel="noreferrer" className="flow-btn rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-2"><Download className="h-4 w-4" />Download PDF</a>
        </div>
      </header>
      <main className="flex-1 min-h-0 px-3 md:px-8"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touchX.current == null) return; const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 50) go(idx + (d < 0 ? 1 : -1)); touchX.current = null; }}>
        <Stage>{slides[idx].render(idx + 1)}</Stage>
      </main>
      <footer className="flex items-center justify-center gap-4 py-4">
        <button aria-label="Sebelumnya" onClick={() => go(idx - 1)} className="pitch-pill h-11 w-11 !p-0 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex gap-1.5">{slides.map((_, i) => <button key={i} aria-label={`Slide ${i + 1}`} onClick={() => go(i)} className={`h-2 rounded-full transition-all ${i === idx ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`} />)}</div>
        <button aria-label="Berikutnya" onClick={() => go(idx + 1)} className="pitch-pill h-11 w-11 !p-0 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
      </footer>
    </div>
  );
}
