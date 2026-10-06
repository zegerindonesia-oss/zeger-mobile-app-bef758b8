import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Coffee, Heart, Target, Gem, Users } from 'lucide-react';
import { FlowShell, Reveal } from '@/components/flow/FlowChrome';
import { MacBook, IPhone } from '@/components/flow/Devices';
import { DashboardScreen, CustomerAppScreen } from '@/components/flow/Screens';
import { PRODUCTS, SOLUTIONS } from '@/lib/flow-content';
import { PLANS, MODULE_LABELS, formatPrice, type FlowPlan } from '@/lib/flow-plans';
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

const LIMIT_ROWS: [keyof FlowPlan['limits'], string][] = [['trx', 'Transaksi'], ['outlets', 'Outlet'], ['devices', 'Perangkat kasir'], ['users', 'Akun staf'], ['history', 'Riwayat data']];
const COMPETITORS = [
  ['KDS dapur multi-stasiun', 'Add-on berbayar', 'Termasuk (Mid-Market)'],
  ['Layar antrean TV + suara', 'Tidak ada / pihak ketiga', 'Termasuk (Mid-Market)'],
  ['Resep HPP potong stok otomatis', 'Paket ERP terpisah', 'Mulai Flow SME'],
  ['Voice AI kasir', 'Tidak ada', 'Termasuk (Mid-Market)'],
  ['Mobile selling rider + GPS', 'Tidak ada', 'Termasuk (Enterprise)'],
  ['Aplikasi customer brand sendiri', 'Custom, biaya tinggi', 'Termasuk (Enterprise)'],
  ['Paket gratis', 'Terbatas / promo', 'Gratis selamanya'],
];

export const FlowPricing = () => {
  useEffect(() => { window.scrollTo(0, 0); document.title = 'Harga | FlowF&B'; }, []);
  return (
    <FlowShell>
      <PageHero eyebrow="HARGA" title="Mulai gratis. Naik kelas saat bisnis Anda tumbuh." desc="Fitur lebih lengkap, harga hingga 60% lebih hemat dari platform F&B lain. Semua pendaftar dapat trial 7 hari full fitur, lalu otomatis lanjut di paket Free bila belum berlangganan." />
      <section className="max-w-7xl mx-auto px-5 pb-16 grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        {PLANS.map((p, k) => (
          <Reveal key={p.id} delay={k * 0.08}>
            <motion.div whileHover={{ y: -8 }} className={`rounded-[28px] p-7 h-full flex flex-col ${p.hot ? 'flow-dark-lux' : 'flow-card'}`}>
              <div className="h-7">{p.hot && <span className="inline-block flow-bg-red rounded-full px-3 py-1 text-xs font-bold">Paling Populer</span>}</div>
              <div className="text-xl font-extrabold mt-2">{p.name}</div>
              <div className={`text-sm ${p.hot ? 'text-background/70' : 'flow-muted'}`}>{p.who}</div>
              <div className="mt-5 text-4xl font-extrabold">{formatPrice(p.price)}<span className="text-sm font-medium opacity-60">{p.price ? ' /outlet/bln' : ' selamanya'}</span></div>
              <div className={`text-xs mt-1 ${p.hot ? 'text-background/60' : 'flow-muted'}`}>{p.compare}</div>
              <div className={`mt-5 grid grid-cols-2 gap-2 text-xs rounded-2xl p-3 ${p.hot ? 'bg-background/10' : 'flow-soft'}`}>
                {LIMIT_ROWS.map(([key, label]) => <div key={key}><div className="opacity-60">{label}</div><div className="font-bold">{p.limits[key]}</div></div>)}
              </div>
              <ul className="mt-5 space-y-2 text-sm flex-1">{p.features.map((i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 flow-red shrink-0 mt-0.5" />{i}</li>)}</ul>
              <Link to={`/daftar?plan=${p.id}`} className={`mt-7 block text-center rounded-full py-3.5 font-bold ${p.hot ? 'flow-btn' : 'flow-btn-ghost'}`}>{p.price ? `Coba ${p.name} 7 hari` : 'Daftar Gratis'}</Link>
            </motion.div>
          </Reveal>
        ))}
      </section>

      <section className="max-w-7xl mx-auto px-5 pb-16">
        <h2 className="text-3xl font-extrabold flow-ink mb-6">Bandingkan semua modul</h2>
        <div className="flow-card rounded-3xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left p-4 flow-ink">Modul</th>
              {PLANS.map((p) => <th key={p.id} className={`p-4 text-center ${p.hot ? 'flow-red' : 'flow-ink'}`}>{p.name}<div className="text-xs font-medium flow-muted">{formatPrice(p.price)}</div></th>)}
            </tr></thead>
            <tbody>
              {LIMIT_ROWS.map(([key, label]) => (
                <tr key={key} className="border-b border-border"><td className="p-4 font-semibold flow-ink">{label}</td>{PLANS.map((p) => <td key={p.id} className="p-4 text-center flow-muted">{p.limits[key]}</td>)}</tr>
              ))}
              {Object.entries(MODULE_LABELS).map(([id, label]) => (
                <tr key={id} className="border-b border-border last:border-0"><td className="p-4 font-semibold flow-ink">{label}</td>
                  {PLANS.map((p) => <td key={p.id} className="p-4 text-center">{p.modules.includes(id) ? <Check className="h-5 w-5 flow-red mx-auto" /> : <span className="flow-muted">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs flow-muted mt-3">Butuh modul satuan? Modul apa pun bisa ditambahkan sebagai add-on tanpa harus naik paket.</p>
      </section>

      <section className="max-w-5xl mx-auto px-5 pb-24">
        <h2 className="text-3xl font-extrabold flow-ink mb-6">Kenapa FlowF&B lebih unggul</h2>
        <div className="flow-card rounded-3xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border"><th className="text-left p-4 flow-ink">Kebutuhan F&B</th><th className="p-4 flow-muted">Platform lain umumnya</th><th className="p-4 flow-red">FlowF&B</th></tr></thead>
            <tbody>{COMPETITORS.map(([a, b, c]) => <tr key={a} className="border-b border-border last:border-0"><td className="p-4 font-semibold flow-ink">{a}</td><td className="p-4 text-center flow-muted">{b}</td><td className="p-4 text-center font-bold flow-ink">{c}</td></tr>)}</tbody>
          </table>
        </div>
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
