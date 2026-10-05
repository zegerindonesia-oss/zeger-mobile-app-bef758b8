import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Coffee, Heart, Target, Gem, Users } from 'lucide-react';
import { FlowShell, Reveal } from '@/components/flow/FlowChrome';
import { MacBook, IPhone } from '@/components/flow/Devices';
import { DashboardScreen, CustomerAppScreen } from '@/components/flow/Screens';
import { PRODUCTS, SOLUTIONS } from '@/lib/flow-content';
import { FinalCTA } from './FlowLanding';
import promo from '@/assets/flow/zeger-promo.png.asset.json';

const PageHero = ({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) => (
  <section className="flow-hero-glow pt-36 pb-16 text-center px-5">
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
      <div className="text-xs font-bold tracking-[0.3em] flow-red">{eyebrow}</div>
      <h1 className="mt-4 text-4xl md:text-6xl font-extrabold flow-ink max-w-4xl mx-auto leading-[1.05]">{title}</h1>
      <p className="mt-5 text-lg flow-muted max-w-2xl mx-auto">{desc}</p>
    </motion.div>
  </section>
);

export const FlowDetail = ({ kind }: { kind: 'produk' | 'solusi' }) => {
  const { slug } = useParams();
  const list = kind === 'produk' ? PRODUCTS : SOLUTIONS;
  const p = list.find((x) => x.slug === slug);
  useEffect(() => { window.scrollTo(0, 0); if (p) document.title = `${p.title} | FlowF&B`; }, [p]);
  if (!p) return <Navigate to="/landing" replace />;
  const I = p.icon;
  const others = list.filter((x) => x.slug !== p.slug).slice(0, 3);
  return (
    <FlowShell>
      <section className="flow-hero-glow pt-36 pb-20">
        <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 rounded-full flow-soft px-4 py-1.5 text-sm font-bold flow-red"><I className="h-4 w-4" />{p.title}</div>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold flow-ink leading-[1.05]">{p.headline}</h1>
            <p className="mt-5 text-lg flow-muted">{p.desc}</p>
            <div className="mt-8 flex gap-3"><Link to="/daftar" className="flow-btn rounded-full px-7 py-4 font-bold flex items-center gap-2">Coba Gratis <ArrowRight className="h-5 w-5" /></Link><Link to="/harga" className="flow-btn-ghost rounded-full px-7 py-4 font-bold">Lihat Harga</Link></div>
          </motion.div>
          <motion.div initial={{ opacity: 0, rotateY: -20, y: 40 }} animate={{ opacity: 1, rotateY: -6, y: 0 }} transition={{ duration: 1 }} style={{ transformPerspective: 1400 }} className="relative">
            <MacBook><DashboardScreen /></MacBook>
            <div className="absolute -right-2 -bottom-10 w-[28%]"><IPhone><CustomerAppScreen /></IPhone></div>
          </motion.div>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-5 py-16 grid grid-cols-3 gap-4">
        {p.stats.map(([a, b], k) => <Reveal key={b} delay={k * 0.1} className="flow-card rounded-3xl p-6 text-center"><div className="text-3xl md:text-4xl font-extrabold flow-red">{a}</div><div className="text-sm flow-muted mt-1">{b}</div></Reveal>)}
      </section>
      <section className="max-w-7xl mx-auto px-5 pb-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {p.bullets.map((b, k) => <Reveal key={b} delay={k * 0.08}><motion.div whileHover={{ y: -6, rotateX: 6 }} style={{ transformPerspective: 800 }} className="flow-card rounded-3xl p-6 h-full"><div className="h-11 w-11 rounded-xl flow-bg-red grid place-items-center"><Check className="h-5 w-5" /></div><div className="mt-5 font-extrabold flow-ink">{b}</div></motion.div></Reveal>)}
      </section>
      <section className="max-w-7xl mx-auto px-5 pb-24">
        <h3 className="text-2xl font-extrabold flow-ink mb-6">Lainnya</h3>
        <div className="grid md:grid-cols-3 gap-4">{others.map((o) => { const O = o.icon; return <Link key={o.slug} to={`/${kind}/${o.slug}`} className="flow-card rounded-2xl p-6 flex gap-4 hover:-translate-y-1 transition-transform"><O className="h-6 w-6 flow-red" /><div><div className="font-bold flow-ink">{o.title}</div><div className="text-sm flow-muted">{o.short}</div></div></Link>; })}</div>
      </section>
      <FinalCTA />
    </FlowShell>
  );
};

const plans = [
  { name: 'Starter', who: 'UMKM, Booth, Street Food', price: '299rb', items: ['POS Kasir 1 outlet', 'Produk & stok dasar', 'Laporan penjualan', 'Cetak struk thermal'] },
  { name: 'Pro', who: 'Café & Restoran', price: '799rb', hot: true, items: ['Semua fitur Starter', 'Meja, KDS & Layar Antrean', 'Bahan baku & resep HPP', 'Loyalty & CRM', 'Voice AI kasir'] },
  { name: 'Enterprise', who: 'Franchise, Chain, Hotel', price: 'Custom', items: ['Semua fitur Pro', 'Multi outlet & hub', 'Mobile selling rider', 'Aplikasi customer white-label', 'Dedicated success manager'] },
];

export const FlowPricing = () => {
  useEffect(() => { window.scrollTo(0, 0); document.title = 'Harga | FlowF&B'; }, []);
  return (
    <FlowShell>
      <PageHero eyebrow="HARGA" title="Paket untuk setiap skala bisnis F&B" desc="Aktifkan modul sesuai kebutuhan. Upgrade atau tambah outlet kapan saja." />
      <section className="max-w-6xl mx-auto px-5 pb-24 grid md:grid-cols-3 gap-6">
        {plans.map((p, k) => (
          <Reveal key={p.name} delay={k * 0.1}>
            <motion.div whileHover={{ y: -8 }} className={`rounded-[28px] p-8 h-full ${p.hot ? 'flow-dark-lux' : 'flow-card'}`}>
              {p.hot && <span className="inline-block flow-bg-red rounded-full px-3 py-1 text-xs font-bold mb-3">Paling Populer</span>}
              <div className="text-xl font-extrabold">{p.name}</div><div className={`text-sm ${p.hot ? 'text-background/70' : 'flow-muted'}`}>{p.who}</div>
              <div className="mt-5 text-4xl font-extrabold">{p.price !== 'Custom' && <span className="text-lg align-top">Rp</span>}{p.price}<span className="text-sm font-medium opacity-60">{p.price !== 'Custom' && ' /outlet/bln'}</span></div>
              <ul className="mt-6 space-y-2.5 text-sm">{p.items.map((i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 flow-red shrink-0 mt-0.5" />{i}</li>)}</ul>
              <Link to={`/daftar?plan=${p.name.toLowerCase()}`} className={`mt-8 block text-center rounded-full py-3.5 font-bold ${p.hot ? 'flow-btn' : 'flow-btn-ghost'}`}>Mulai {p.name}</Link>
            </motion.div>
          </Reveal>
        ))}
      </section>
      <FinalCTA />
    </FlowShell>
  );
};

export const FlowCustomers = () => {
  useEffect(() => { window.scrollTo(0, 0); document.title = 'Customer | FlowF&B'; }, []);
  return (
    <FlowShell>
      <PageHero eyebrow="CUSTOMER STORY" title="Zeger Coffee: outlet, gerobak, dan mobil keliling dalam satu sistem" desc="Pilot project FlowF&B — branch hub, outlet, armada On The Wheels, dan aplikasi member berjalan di satu platform." />
      <section className="max-w-7xl mx-auto px-5 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal><div className="rounded-[32px] overflow-hidden flow-card"><img src={promo.url} alt="Kampanye Zeger Coffee" className="w-full h-[560px] object-cover object-top" /></div></Reveal>
        <Reveal delay={0.15}>
          <Coffee className="h-10 w-10 flow-red" />
          <blockquote className="mt-4 text-2xl font-bold flow-ink leading-snug">"Dulu laporan rider dan outlet terpisah. Sekarang stok, setoran, dan poin member terlihat dalam satu layar."</blockquote>
          <div className="mt-4 flow-muted">Tim Zeger Coffee</div>
          <div className="mt-8 grid grid-cols-3 gap-3">{[['4', 'aplikasi terhubung'], ['3', 'channel penjualan'], ['1', 'data terpusat']].map(([a, b]) => <div key={b} className="flow-card rounded-2xl p-4 text-center"><div className="text-3xl font-extrabold flow-red">{a}</div><div className="text-xs flow-muted">{b}</div></div>)}</div>
        </Reveal>
      </section>
      <FinalCTA />
    </FlowShell>
  );
};

export const FlowAbout = () => {
  useEffect(() => { window.scrollTo(0, 0); document.title = 'Tentang | FlowF&B'; }, []);
  return (
    <FlowShell>
      <PageHero eyebrow="TENTANG FLOWF&B" title="Memberdayakan bisnis F&B tumbuh lebih besar dengan teknologi" desc="FlowF&B adalah brand dari Flowstack — membangun ERP F&B terdepan di Indonesia dan Asia." />
      <section className="max-w-6xl mx-auto px-5 pb-24 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ i: Heart, t: 'Purpose', d: 'Memberdayakan bisnis F&B untuk tumbuh lebih besar dengan teknologi.' }, { i: Target, t: 'Vision', d: 'Menjadi platform ERP F&B terdepan di Indonesia dan Asia.' }, { i: Gem, t: 'Mission', d: 'Solusi F&B end-to-end dengan AI yang mudah, terjangkau, dan scalable.' }, { i: Users, t: 'Values', d: 'Innovation, efficiency, growth, partnership, customer success.' }].map(({ i: I, t, d }, k) => (
          <Reveal key={t} delay={k * 0.08}><div className="flow-card rounded-3xl p-7 h-full"><I className="h-8 w-8 flow-red" /><div className="mt-5 text-xl font-extrabold flow-ink">{t}</div><p className="mt-2 text-sm flow-muted">{d}</p></div></Reveal>
        ))}
      </section>
      <FinalCTA />
    </FlowShell>
  );
};
