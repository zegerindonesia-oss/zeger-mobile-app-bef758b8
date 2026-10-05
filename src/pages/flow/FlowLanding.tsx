import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import {
  ArrowRight, Play, ShoppingCart, ChefHat, Package, Gift, Bike, MapPin, Check, X, Mic, Sparkles,
  TrendingUp, AlertTriangle, ChevronLeft, ChevronRight, Store, Truck, Smartphone,
} from 'lucide-react';
import { FlowShell, Reveal } from '@/components/flow/FlowChrome';
import { MacBook, IPhone, IPad } from '@/components/flow/Devices';
import { DashboardScreen, CustomerAppScreen, POSScreen } from '@/components/flow/Screens';
import { PRODUCTS, SOLUTIONS } from '@/lib/flow-content';
import heroWoman from '@/assets/flow/hero-businesswoman.png';
import featPos from '@/assets/flow/feat-pos-kasir.jpg';
import featKds from '@/assets/flow/feat-kitchen-display.jpg';
import featQueue from '@/assets/flow/feat-layar-antrean.jpg';
import featBom from '@/assets/flow/feat-bahan-resep.jpg';
import featLoyalty from '@/assets/flow/feat-loyalty-crm.jpg';
import featApp from '@/assets/flow/feat-aplikasi-customer.jpg';
import featVoice from '@/assets/flow/feat-voice-ai.jpg';
import featBack from '@/assets/flow/feat-back-office.jpg';
import featInvoice from '@/assets/flow/feat-invoice.jpg';
import featFinance from '@/assets/flow/feat-laporan-keuangan.jpg';
import featMobile from '@/assets/flow/feat-mobile-selling.jpg';

const badges = [
  { icon: ShoppingCart, t: 'POS Kasir', pos: 'top-[8%] -left-[4%]', d: 0 },
  { icon: ChefHat, t: 'KDS Dapur', pos: 'top-[2%] right-[6%]', d: 0.6 },
  { icon: Package, t: 'Resep & HPP', pos: 'top-[38%] -right-[6%]', d: 1.2 },
  { icon: Gift, t: 'Loyalty Poin', pos: 'bottom-[24%] -left-[8%]', d: 1.8 },
  { icon: Bike, t: 'Rider GPS', pos: 'bottom-[8%] right-[2%]', d: 2.4 },
];

const ticker = ['POS Touch', 'Split Bill', 'Multi-Station KDS', 'Antrean Suara', 'Resep BOM', 'HPP Real-time', 'QR Member', 'Voice AI', 'GoFood · Grab · Shopee', 'Laporan X/Z', 'Transfer Stok', 'Checkpoint Rider', 'Subscription', 'Multi Outlet'];

const Hero = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yImg = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const yText = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 120, damping: 20 });
  return (
    <section ref={ref} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      className="relative overflow-hidden flow-hero-glow pt-28 pb-16">
      <motion.div style={{ y: yBlob }} className="absolute -right-40 -top-20 h-[640px] w-[640px] rounded-full flow-bg-red opacity-[0.08] blur-3xl" />
      <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-10 items-center">
        <motion.div style={{ y: yText }}>
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full flow-soft px-4 py-1.5 text-sm font-semibold flow-red"><Sparkles className="h-4 w-4" />AI-Integrated F&B Operating System</motion.span>
          <h1 className="mt-6 text-5xl md:text-7xl font-extrabold leading-[0.98] tracking-tight flow-ink">
            {['Kelola Seluruh', 'Bisnis F&B dalam', 'Satu Platform.'].map((l, i) => (
              <motion.span key={l} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={`block ${i === 2 ? 'flow-red' : ''}`}>{l}</motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-lg flow-muted max-w-xl">
            Kasir, dapur, stok, resep, rider keliling, keuangan, sampai aplikasi pelanggan — satu ekosistem dari hulu ke hilir, terintegrasi AI.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mt-8 flex flex-wrap gap-3">
            <Link to="/daftar" className="flow-btn rounded-full px-7 py-4 font-bold flex items-center gap-2">Coba Gratis 14 Hari <ArrowRight className="h-5 w-5" /></Link>
            <Link to="/auth" className="flow-btn-ghost rounded-full px-7 py-4 font-bold flex items-center gap-2"><Play className="h-4 w-4" />Lihat Demo</Link>
          </motion.div>
          <div className="mt-6 flex flex-wrap gap-5 text-xs flow-muted">{['Tanpa kartu kredit', 'Setup 3 menit', 'Support WhatsApp'].map((t) => <span key={t} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" />{t}</span>)}</div>
        </motion.div>

        <motion.div style={{ y: yImg, rotateX: rx, rotateY: ry, transformPerspective: 1200 }} className="relative mx-auto w-full max-w-[540px] aspect-square">
          <div className="absolute inset-[8%] rounded-full flow-hero-orb" />
          <img src={heroWoman} alt="Pengusaha wanita profesional mengelola bisnis F&B lewat tablet" width={848} height={1264} className="absolute inset-x-[6%] bottom-0 h-[96%] w-[88%] object-contain object-bottom drop-shadow-2xl" />
          {badges.map(({ icon: I, t, pos, d }) => (
            <motion.div key={t} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 + d * 0.2, type: 'spring' }}
              className={`absolute ${pos} flow-glass rounded-2xl px-3 py-2.5 flex items-center gap-2 flow-float`} style={{ animationDelay: `${d}s`, transform: 'translateZ(60px)' }}>
              <div className="h-8 w-8 rounded-xl flow-bg-red grid place-items-center"><I className="h-4 w-4" /></div>
              <span className="text-xs font-bold flow-ink whitespace-nowrap">{t}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <Reveal className="max-w-4xl mx-auto px-5 mt-16">
        <div className="flow-glass rounded-3xl grid grid-cols-2 md:grid-cols-4 divide-x divide-border/60">
          {[['4 channel', 'Outlet, Rider, Online, App'], ['30+', 'Modul F&B'], ['100%', 'HPP real-time'], ['90%', 'Hemat waktu admin']].map(([a, b]) => (
            <div key={a} className="p-5 text-center"><div className="text-3xl font-extrabold flow-red">{a}</div><div className="text-xs flow-muted mt-1">{b}</div></div>
          ))}
        </div>
      </Reveal>
    </section>
  );
};

const Marquee = () => (
  <div className="border-y border-border bg-background py-4 overflow-hidden">
    <div className="flow-marquee gap-10">
      {[...ticker, ...ticker].map((t, i) => <span key={i} className="flex items-center gap-2 text-sm font-semibold flow-ink whitespace-nowrap px-5"><span className="h-1.5 w-1.5 rounded-full flow-bg-red" />{t}</span>)}
    </div>
  </div>
);

const Channels = () => (
  <section className="max-w-7xl mx-auto px-5 py-24">
    <Reveal className="text-center">
      <div className="text-xs font-bold tracking-[0.3em] flow-red">EMPAT CHANNEL, SATU SISTEM</div>
      <h2 className="mt-3 text-4xl md:text-5xl font-extrabold flow-ink">Jual di mana saja. <span className="flow-red">Data tetap satu.</span></h2>
    </Reveal>
    <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[{ i: Store, t: 'Outlet & Kasir', d: 'POS, meja, KDS, antrean TV.' }, { i: Bike, t: 'On The Wheels', d: 'Rider keliling, stok & setoran.' }, { i: Truck, t: 'Online Order', d: 'GoFood, GrabFood, ShopeeFood.' }, { i: Smartphone, t: 'Aplikasi Customer', d: 'Pesan, poin, promo, langganan.' }].map(({ i: I, t, d }, k) => (
        <Reveal key={t} delay={k * 0.08}>
          <motion.div whileHover={{ y: -8, rotateX: 6, rotateY: -6 }} style={{ transformPerspective: 900 }} className="flow-card rounded-3xl p-7 h-full">
            <div className="h-14 w-14 rounded-2xl flow-bg-red grid place-items-center"><I className="h-6 w-6" /></div>
            <div className="mt-6 text-xl font-extrabold flow-ink">{t}</div><p className="mt-2 text-sm flow-muted">{d}</p>
          </motion.div>
        </Reveal>
      ))}
    </div>
  </section>
);

const DeviceShowcase = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.82, 1]);
  const phoneY = useTransform(scrollYProgress, [0, 1], [180, 0]);
  const padX = useTransform(scrollYProgress, [0, 1], [-160, 0]);
  return (
    <section ref={ref} className="relative py-24 overflow-hidden flow-gray">
      <Reveal className="text-center max-w-3xl mx-auto px-5">
        <div className="text-xs font-bold tracking-[0.3em] flow-red">SATU EKOSISTEM</div>
        <h2 className="mt-3 text-4xl md:text-5xl font-extrabold flow-ink">Back office, kasir, dan aplikasi pelanggan — <span className="flow-red">selalu sinkron.</span></h2>
      </Reveal>
      <div className="relative max-w-6xl mx-auto px-5 mt-16" style={{ perspective: 1600 }}>
        <motion.div style={{ rotateX, scale }} className="origin-bottom">
          <MacBook className="mx-auto w-[86%]"><DashboardScreen /></MacBook>
        </motion.div>
        <motion.div style={{ x: padX }} className="absolute left-0 bottom-0 w-[32%] hidden md:block"><IPad><POSScreen /></IPad></motion.div>
        <motion.div style={{ y: phoneY }} className="absolute right-[2%] -bottom-6 w-[19%] min-w-[150px]"><IPhone><CustomerAppScreen /></IPhone></motion.div>
      </div>
    </section>
  );
};

const KitchenPreview = ({ queue = false }: { queue?: boolean }) => (
  <div className="h-full w-full bg-foreground p-4 text-background">
    <div className="flex items-center justify-between border-b border-background/15 pb-3">
      <div className="font-extrabold">{queue ? 'Antrean Pesanan' : 'Kitchen Display'}</div>
      <div className="rounded-full bg-success/20 px-3 py-1 text-[10px] text-success">Live</div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-3">
      {['#A-128', '#A-129', '#A-130'].map((order, index) => (
        <div key={order} className="rounded-xl border border-background/15 bg-background/10 p-3">
          <div className="flex items-center justify-between"><b>{order}</b><span className={index === 2 ? 'text-warning' : 'text-success'}>{index + 3}:2{index}</span></div>
          <div className="mt-3 space-y-2 text-[10px] text-background/75">
            <div>2× Aren Latte</div><div>1× Americano</div><div>Less sugar · no ice</div>
          </div>
          <div className="mt-4 rounded-lg bg-primary py-2 text-center text-[10px] font-bold">{queue ? 'Siap Diambil' : 'Selesaikan'}</div>
        </div>
      ))}
    </div>
  </div>
);

const FEATURE_IMAGES: Record<string, string> = {
  'pos-kasir': featPos, 'kitchen-display': featKds, 'layar-antrean': featQueue, 'bahan-resep': featBom,
  'loyalty-crm': featLoyalty, 'aplikasi-customer': featApp, 'voice-ai': featVoice, 'back-office': featBack,
  invoice: featInvoice, 'laporan-keuangan': featFinance, 'mobile-selling': featMobile,
};

const ProductPreview = ({ slug, title }: { slug: string; title?: string }) => {
  const img = FEATURE_IMAGES[slug];
  if (img) return <img src={img} alt={title || slug} loading="lazy" width={1024} height={1024} className="h-full w-full object-cover" />;
  return <DashboardScreen />;
};

const Coverflow = () => {
  const [i, setI] = useState(0);
  const n = PRODUCTS.length;
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % n), 4500); return () => clearInterval(t); }, [n]);
  return (
    <section className="py-24 overflow-hidden">
      <Reveal className="max-w-7xl mx-auto px-5">
        <div className="text-xs font-bold tracking-[0.3em] flow-red">SEMUA MODUL</div>
        <h2 className="mt-3 text-4xl md:text-5xl font-extrabold flow-ink max-w-2xl">Dari pesanan pertama sampai <span className="flow-red">laporan laba rugi.</span></h2>
      </Reveal>
      <div className="relative h-[460px] mt-14" style={{ perspective: 1400 }}>
        {PRODUCTS.map((p, k) => {
          let off = k - i; if (off > n / 2) off -= n; if (off < -n / 2) off += n;
          const abs = Math.abs(off);
          const I = p.icon;
          return (
            <motion.div key={p.slug} onClick={() => setI(k)} animate={{ x: `${off * 62}%`, rotateY: off * -28, scale: 1 - abs * 0.12, opacity: abs > 2 ? 0 : 1 - abs * 0.3, zIndex: 10 - abs }}
              transition={{ type: 'spring', stiffness: 90, damping: 20 }}
              className="absolute left-1/2 top-0 -ml-[min(44vw,330px)] w-[min(88vw,660px)] cursor-pointer" style={{ transformStyle: 'preserve-3d' }}>
              <div className="flow-card rounded-[28px] overflow-hidden grid md:grid-cols-2 h-[420px]">
                <div className="relative overflow-hidden">
                  <div className="absolute left-6 top-6 z-10 flex items-center gap-3 rounded-2xl bg-background/85 px-3 py-2 backdrop-blur-xl shadow-lg">
                    <I className="h-5 w-5 flow-red" /><span className="text-sm font-extrabold flow-ink">{p.title}</span>
                  </div>
                  <motion.div whileHover={{ scale: 1.04 }} transition={{ duration: 0.5 }} className="absolute inset-0 overflow-hidden">
                    <ProductPreview slug={p.slug} title={p.title} />
                  </motion.div>
                </div>
                <div className="p-7 flex flex-col">
                  <div className="h-11 w-11 rounded-xl flow-soft grid place-items-center"><I className="h-5 w-5 flow-red" /></div>
                  <div className="mt-4 text-xl font-extrabold flow-ink">{p.headline}</div>
                  <p className="mt-2 text-sm flow-muted">{p.desc}</p>
                  <ul className="mt-4 space-y-1.5 text-sm flow-ink">{p.bullets.slice(0, 3).map((b) => <li key={b} className="flex gap-2"><Check className="h-4 w-4 flow-red mt-0.5" />{b}</li>)}</ul>
                  <Link to={`/produk/${p.slug}`} className="mt-auto text-sm font-bold flow-red flex items-center gap-1">Pelajari <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-6">
        <button onClick={() => setI((i - 1 + n) % n)} className="flow-btn-ghost h-11 w-11 rounded-full grid place-items-center" aria-label="Sebelumnya"><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex gap-1.5">{PRODUCTS.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-8 flow-bg-red' : 'w-1.5 bg-border'}`} />)}</div>
        <button onClick={() => setI((i + 1) % n)} className="flow-btn-ghost h-11 w-11 rounded-full grid place-items-center" aria-label="Berikutnya"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
};

const TABS = [
  { k: 'Front of House', items: [['POS Kasir Touch', 'Transaksi < 8 detik'], ['Manajemen Meja', 'Denah & open bill'], ['Split Bill', 'Per item / nominal'], ['Layar Antrean TV', 'Panggilan suara'], ['Promo & Voucher', 'Engine otomatis'], ['Cetak Thermal', 'Struk, dapur, stiker']] },
  { k: 'Kitchen & Bar', items: [['KDS Multi-Stasiun', 'Barista & dapur'], ['SLA Timer', 'Kuning & merah'], ['Recall Tiket', '1 ketukan'], ['Routing Printer', 'Per kategori'], ['Modifier', 'Gula, es, susu'], ['Auto-bump', 'Centang per item']] },
  { k: 'Back Office', items: [['Bahan Baku', 'Stok & opname'], ['Resep BOM', 'HPP per gram'], ['Pembelian', 'Invoice supplier'], ['Laba Rugi', 'Otomatis'], ['Beban Operasional', 'Per outlet'], ['User Bertingkat', '5 level akses']] },
  { k: 'Customer & Wheels', items: [['Aplikasi Customer', 'White-label'], ['Loyalty QR', 'Semua channel'], ['Subscription', 'Paket langganan'], ['Rider App', 'Jual keliling'], ['Checkpoint GPS', 'Lokasi rider'], ['Setoran Tunai', 'Selisih stok']] },
];

const Tabs = () => {
  const [t, setT] = useState(0);
  return (
    <section className="max-w-7xl mx-auto px-5 pb-24">
      <div className="flex flex-wrap gap-2 justify-center">{TABS.map((x, k) => <button key={x.k} onClick={() => setT(k)} className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${k === t ? 'flow-btn' : 'flow-btn-ghost'}`}>{x.k}</button>)}</div>
      <motion.div key={t} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TABS[t].items.map(([a, b], k) => (
          <motion.div key={a} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }} whileHover={{ y: -4 }} className="flow-card rounded-2xl p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl flow-soft grid place-items-center"><Check className="h-5 w-5 flow-red" /></div>
            <div><div className="font-bold flow-ink">{a}</div><div className="text-sm flow-muted">{b}</div></div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

const AISection = () => (
  <section className="flow-dark-lux py-24 overflow-hidden">
    <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-14 items-center">
      <Reveal>
        <div className="text-xs font-bold tracking-[0.3em] flow-red">AI UNTUK F&B</div>
        <h2 className="mt-3 text-4xl md:text-5xl font-extrabold">Asisten AI yang <span className="flow-red">paham dapur Anda.</span></h2>
        <p className="mt-5 text-background/70 max-w-lg">Kasir cukup bicara, AI mengisi keranjang. AI membaca data penjualan untuk memprediksi stok habis, menyarankan promo, dan mendeteksi kebocoran.</p>
        <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">{['Voice order bahasa Indonesia', 'Prediksi bahan habis', 'Rekomendasi promo menu', 'Deteksi selisih stok rider'].map((x) => <div key={x} className="flex items-center gap-2"><Check className="h-4 w-4 flow-red" />{x}</div>)}</div>
      </Reveal>
      <Reveal delay={0.15}>
        <motion.div whileHover={{ rotateY: -6, rotateX: 4 }} style={{ transformPerspective: 1000 }} className="rounded-[28px] bg-background/5 border border-background/10 backdrop-blur-xl p-6 space-y-4">
          <div className="flex items-center gap-3"><div className="relative h-14 w-14 rounded-full flow-bg-red grid place-items-center"><span className="absolute inset-0 rounded-full flow-bg-red animate-ping opacity-30" /><Mic className="h-6 w-6 relative" /></div><div className="text-sm">"Kopi aren satu less sugar, americano dua"</div></div>
          <div className="rounded-2xl bg-background/10 p-4 text-sm space-y-1.5"><div className="flex justify-between"><span>1× Aren Latte · Less sugar</span><span>16.000</span></div><div className="flex justify-between"><span>2× Americano</span><span>24.000</span></div><div className="flex items-center gap-2 pt-2 text-success"><Check className="h-4 w-4" />Ditambahkan ke keranjang</div></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background/10 p-4"><TrendingUp className="h-5 w-5 text-success" /><div className="mt-2 text-xs text-background/60">Prediksi besok</div><div className="font-extrabold">+18% Aren Latte</div></div>
            <div className="rounded-2xl bg-background/10 p-4"><AlertTriangle className="h-5 w-5 text-warning" /><div className="mt-2 text-xs text-background/60">Stok menipis</div><div className="font-extrabold">Susu fresh 5 L</div></div>
          </div>
        </motion.div>
      </Reveal>
    </div>
  </section>
);

const AppBanner = () => (
  <section className="max-w-7xl mx-auto px-5 py-24">
    <div className="flow-bg-red rounded-[36px] p-10 md:p-16 grid md:grid-cols-2 gap-10 items-center relative overflow-hidden">
      <Reveal>
        <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">Aplikasi pelanggan dengan brand Anda sendiri.</h2>
        <p className="mt-4 opacity-90 max-w-md">Seperti aplikasi kopi ternama: pesan, lacak rider terdekat, kumpulkan poin, tukar reward — semuanya diatur dari back office.</p>
        <Link to="/produk/aplikasi-customer" className="mt-8 inline-flex items-center gap-2 bg-background flow-red rounded-full px-6 py-3.5 font-bold shadow-xl">Lihat Aplikasi <ArrowRight className="h-4 w-4" /></Link>
      </Reveal>
      <div className="relative h-[460px]" style={{ perspective: 1200 }}>
        <motion.div initial={{ rotateY: -25, y: 60, opacity: 0 }} whileInView={{ rotateY: -12, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1 }} className="absolute left-[18%] top-0 w-[48%]"><IPhone><CustomerAppScreen /></IPhone></motion.div>
        <motion.div initial={{ y: 120, opacity: 0 }} whileInView={{ y: 40, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.2 }} className="absolute right-[6%] top-0 flow-glass rounded-2xl p-3 flex items-center gap-2"><MapPin className="h-5 w-5 flow-red" /><span className="text-xs font-bold flow-ink">Rider 350 m dari Anda</span></motion.div>
        <motion.div initial={{ y: 120, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.35 }} className="absolute left-0 bottom-16 flow-glass rounded-2xl p-3 flex items-center gap-2"><Gift className="h-5 w-5 flow-red" /><span className="text-xs font-bold flow-ink">+16 poin didapat</span></motion.div>
      </div>
    </div>
  </section>
);

const Industries = () => (
  <section className="max-w-7xl mx-auto px-5 pb-24">
    <Reveal className="text-center"><div className="text-xs font-bold tracking-[0.3em] flow-red">SOLUSI INDUSTRI</div><h2 className="mt-3 text-4xl md:text-5xl font-extrabold flow-ink">Cocok untuk F&B <span className="flow-red">apa pun.</span></h2></Reveal>
    <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SOLUTIONS.map(({ slug, icon: I, title, short }, k) => (
        <Reveal key={slug} delay={k * 0.05}><Link to={`/solusi/${slug}`} className="flow-card rounded-2xl p-6 flex gap-4 hover:-translate-y-1 transition-transform group">
          <div className="h-12 w-12 shrink-0 rounded-xl flow-bg-red grid place-items-center group-hover:scale-110 transition-transform"><I className="h-5 w-5" /></div>
          <div><div className="font-extrabold flow-ink">{title}</div><div className="text-sm flow-muted">{short}</div></div>
        </Link></Reveal>
      ))}
    </div>
  </section>
);

const Compare = () => (
  <section className="max-w-4xl mx-auto px-5 pb-24">
    <Reveal className="text-center"><h2 className="text-4xl md:text-5xl font-extrabold flow-ink">Kenapa <span className="flow-red">FlowF&B?</span></h2><p className="mt-3 flow-muted">Dibanding POS biasa.</p></Reveal>
    <Reveal className="mt-10 flow-card rounded-3xl overflow-hidden">
      <div className="grid grid-cols-[1fr_110px_110px] px-6 py-4 text-sm font-bold flow-gray"><span className="flow-ink">Fitur</span><span className="text-center flow-red">FlowF&B</span><span className="text-center flow-muted">POS biasa</span></div>
      {['POS, KDS, antrean TV dalam satu sistem', 'Resep BOM & HPP otomatis', 'Mobile selling rider + GPS', 'Loyalty di semua channel', 'Aplikasi customer white-label', 'Voice AI kasir', 'Multi outlet & hub bertingkat', 'Laba rugi & neraca otomatis'].map((r, k) => (
        <div key={r} className="grid grid-cols-[1fr_110px_110px] px-6 py-3.5 border-t border-border text-sm"><span className="flow-ink">{r}</span><Check className="h-5 w-5 mx-auto text-success" />{k < 1 ? <Check className="h-5 w-5 mx-auto flow-muted opacity-40" /> : <X className="h-5 w-5 mx-auto flow-muted opacity-40" />}</div>
      ))}
    </Reveal>
  </section>
);

export const FinalCTA = () => (
  <section className="max-w-7xl mx-auto px-5 pb-24">
    <div className="flow-dark-lux rounded-[36px] p-12 md:p-20 text-center">
      <h2 className="text-4xl md:text-6xl font-extrabold">Powering Every Bite <span className="flow-red">of Growth.</span></h2>
      <p className="mt-4 text-background/70 max-w-xl mx-auto">Daftarkan bisnis Anda, isi profil dan menu — POS siap dipakai hari ini juga.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/daftar" className="flow-btn rounded-full px-8 py-4 font-bold inline-flex items-center gap-2">Mulai Gratis <ArrowRight className="h-5 w-5" /></Link>
        <Link to="/harga" className="rounded-full px-8 py-4 font-bold border border-background/25">Lihat Harga</Link>
      </div>
    </div>
  </section>
);

const FlowLanding = () => {
  useEffect(() => { document.title = 'FlowF&B — The Operating System for F&B'; window.scrollTo(0, 0); }, []);
  return (
    <FlowShell>
      <Hero /><Marquee /><Channels /><DeviceShowcase /><Coverflow /><Tabs /><AISection /><AppBanner /><Industries /><Compare /><FinalCTA />
    </FlowShell>
  );
};

export default FlowLanding;
