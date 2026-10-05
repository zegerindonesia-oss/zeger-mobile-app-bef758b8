import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Play, Cpu, Settings2, BarChart3, ShieldCheck, ShoppingCart, Package, ChefHat, Store,
  Wallet, Users, Smartphone, Sparkles, Mic, Check, Bike, Monitor, Tv, Gift, Receipt, Truck,
} from 'lucide-react';
import { FlowLogo, FlowMark } from '@/components/flow/FlowLogo';
import latte from '@/assets/menu/Classic_Latte.webp.asset.json';
import aren from '@/assets/menu/Aren_Latte.webp.asset.json';
import americano from '@/assets/menu/Americano.webp.asset.json';
import matcha from '@/assets/menu/Matcha_Latte.webp.asset.json';

const pillars = [
  { icon: ShoppingCart, t: 'POS & Kasir Modern' }, { icon: Package, t: 'Inventori & Supply Chain' },
  { icon: ChefHat, t: 'Menu & Resep HPP Otomatis' }, { icon: Store, t: 'Multi Outlet & Franchise' },
  { icon: Wallet, t: 'Keuangan & Akuntansi' }, { icon: Users, t: 'Pelanggan & Loyalty' },
  { icon: Smartphone, t: 'Aplikasi Customer' }, { icon: Sparkles, t: 'AI Analitik & Prediksi' },
  { icon: Mic, t: 'AI Voice Input Transaksi' },
];

const modules = [
  { icon: Receipt, t: 'Back Office ERP', d: 'Invoice, pembelian, keuangan, laba rugi, dan multi user bertingkat.' },
  { icon: ShoppingCart, t: 'POS Kasir Outlet', d: 'Transaksi cepat, split bill, meja, promo, cetak thermal, laporan X/Z.' },
  { icon: Monitor, t: 'Kitchen Display', d: 'Layar dapur per stasiun Barista & Dapur dengan timer SLA dan recall.' },
  { icon: Tv, t: 'Layar Antrean TV', d: 'Panggilan nomor pesanan otomatis dengan suara bahasa Indonesia.' },
  { icon: Package, t: 'Bahan Baku & Resep', d: 'BOM per menu, HPP real-time, stok bahan terpotong otomatis.' },
  { icon: Bike, t: 'Mobile Selling Rider', d: 'Penjualan keliling, transfer stok, checkpoint GPS, setoran tunai.' },
  { icon: Gift, t: 'CRM & Loyalty', d: 'Poin di semua channel, QR member, voucher, subscription, referral.' },
  { icon: Truck, t: 'Online Order Hub', d: 'GoFood, GrabFood, ShopeeFood, dan aplikasi milik brand Anda.' },
];

const plans = [
  { name: 'Starter', who: 'UMKM, Booth, Street Food', price: '299rb', items: ['POS Kasir 1 outlet', 'Produk & stok dasar', 'Laporan penjualan', 'Cetak struk thermal'] },
  { name: 'Pro', who: 'Café & Restoran', price: '799rb', hot: true, items: ['Semua fitur Starter', 'Meja, KDS & Layar Antrean', 'Bahan baku & resep HPP', 'Loyalty & CRM', 'Voice AI kasir'] },
  { name: 'Enterprise', who: 'Franchise, Chain, Hotel', price: 'Custom', items: ['Semua fitur Pro', 'Multi outlet & hub', 'Mobile selling rider', 'Aplikasi customer white-label', 'Dedicated success manager'] },
];

const FlowLanding = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'FlowF&B — The Operating System for F&B'; }, []);

  return (
    <div className="flow-site min-h-screen">
      {/* NAV */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60">
        <div className="max-w-7xl mx-auto px-5 h-[72px] flex items-center justify-between">
          <Link to="/"><FlowLogo size="sm" /></Link>
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold flow-ink">
            <a href="#produk">Produk</a><a href="#solusi">Solusi</a><a href="#harga">Harga</a><a href="#customer">Customer</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm font-semibold flow-ink px-3">Masuk</Link>
            <Link to="/onboarding" className="flow-btn rounded-xl px-4 py-2.5 text-sm font-bold flex items-center gap-1.5">Coba Gratis <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden flow-hero-glow">
        <div className="max-w-7xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <div>
            <span className="inline-block rounded-full border border-primary/40 flow-red px-4 py-1 text-sm font-semibold">The Operating System for F&B</span>
            <h1 className="mt-6 text-5xl md:text-6xl font-extrabold leading-[1.02] tracking-tight flow-ink">
              Kelola Seluruh Bisnis F&B dalam <span className="flow-red">Satu Platform.</span>
            </h1>
            <p className="mt-6 text-lg flow-muted max-w-xl">
              FlowF&B adalah ERP lengkap untuk bisnis F&B modern. Dari POS, inventori, resep, multi outlet, keuangan,
              mobile selling, hingga aplikasi customer — semua terintegrasi dengan AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate('/onboarding')} className="flow-btn rounded-2xl px-7 py-4 font-bold flex items-center gap-2">Coba Gratis Sekarang <ArrowRight className="h-5 w-5" /></button>
              <button onClick={() => navigate('/auth')} className="flow-btn-ghost rounded-2xl px-7 py-4 font-bold flex items-center gap-2">Lihat Demo <Play className="h-5 w-5" /></button>
            </div>
            <div className="mt-10 grid grid-cols-4 gap-4 max-w-lg">
              {[{ i: Cpu, t: 'AI-Powered Operations' }, { i: Settings2, t: 'All-in-One F&B ERP' }, { i: BarChart3, t: 'Scalable for Growth' }, { i: ShieldCheck, t: 'Aman & Terpercaya' }].map(({ i: I, t }) => (
                <div key={t} className="text-center">
                  <div className="mx-auto h-12 w-12 rounded-full flow-soft grid place-items-center"><I className="h-5 w-5 flow-red" /></div>
                  <div className="mt-2 text-xs font-medium flow-ink">{t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockups */}
          <div className="relative">
            <div className="flow-card rounded-[28px] p-3 bg-foreground/90">
              <div className="rounded-2xl bg-background overflow-hidden grid grid-cols-[120px_1fr] min-h-[340px]">
                <div className="border-r border-border p-3 space-y-1.5 text-[10px] flow-ink">
                  <FlowLogo size="sm" showTagline={false} />
                  {['Dashboard', 'POS', 'Pesanan', 'Menu & Resep', 'Inventori', 'Pembelian', 'Outlet', 'Pelanggan', 'Keuangan', 'Laporan'].map((m, i) => (
                    <div key={m} className={`rounded-lg px-2 py-1.5 ${i === 0 ? 'flow-bg-red font-bold' : ''}`}>{m}</div>
                  ))}
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-xs font-bold flow-ink">Selamat Pagi,<br />Outlet Kemiri</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['Omset Hari Ini', 'Rp 12.450.000', '+12,3%'], ['Total Pesanan', '328', '+8,2%'], ['Rata-rata', 'Rp 37.900', '+6,1%']].map(([a, b, c]) => (
                      <div key={a} className="rounded-xl border border-border p-2">
                        <div className="text-[9px] flow-muted">{a}</div>
                        <div className="text-xs font-extrabold flow-ink">{b}</div>
                        <div className="text-[9px] text-success font-semibold">{c}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border p-2">
                    <div className="text-[10px] font-bold flow-ink mb-1">Penjualan Hari Ini</div>
                    <svg viewBox="0 0 300 80" className="w-full h-20">
                      <defs><linearGradient id="fa" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="hsl(354 77% 50%)" stopOpacity=".3" /><stop offset="1" stopColor="hsl(354 77% 50%)" stopOpacity="0" /></linearGradient></defs>
                      <path d="M0 70 L30 55 L60 60 L90 45 L120 50 L150 30 L180 40 L210 15 L240 35 L270 25 L300 10 L300 80 L0 80Z" fill="url(#fa)" />
                      <path d="M0 70 L30 55 L60 60 L90 45 L120 50 L150 30 L180 40 L210 15 L240 35 L270 25 L300 10" fill="none" stroke="hsl(354 77% 50%)" strokeWidth="2.5" />
                    </svg>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[[latte, 'Classic Latte'], [aren, 'Aren Latte'], [americano, 'Americano'], [matcha, 'Matcha']].map(([img, n]: any) => (
                      <div key={n} className="text-center">
                        <img src={img.url} alt={n} className="h-12 w-full object-cover rounded-lg" loading="lazy" />
                        <div className="text-[9px] font-semibold flow-ink mt-1 truncate">{n}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -right-2 -bottom-10 w-44 rounded-[30px] p-1.5 bg-foreground shadow-2xl hidden md:block">
              <div className="rounded-[24px] overflow-hidden bg-background">
                <div className="flow-bg-red p-3">
                  <div className="text-[10px] font-bold">FlowF&B</div>
                  <div className="text-sm font-extrabold leading-tight mt-2">Good Coffee<br />Better Business.</div>
                </div>
                <div className="p-2.5">
                  <div className="text-[10px] font-bold flow-ink">Menu Favorit</div>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    {[[latte, 'Rp 15.000'], [aren, 'Rp 16.000']].map(([img, p]: any) => (
                      <div key={p}><img src={img.url} alt="" className="h-14 w-full object-cover rounded-lg" /><div className="text-[9px] font-bold flow-ink mt-0.5">{p}</div></div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-lg flow-soft p-2 text-[9px] font-bold flow-red">120 Poin Loyalty</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section id="produk" className="max-w-7xl mx-auto px-5 -mt-4 relative z-10">
        <div className="flow-card rounded-3xl grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 divide-x divide-border/70">
          {pillars.map(({ icon: I, t }) => (
            <div key={t} className="p-5 text-center">
              <div className="mx-auto h-12 w-12 rounded-full flow-soft grid place-items-center"><I className="h-5 w-5 flow-red" /></div>
              <div className="mt-2 text-xs font-medium flow-ink leading-snug">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* MODULES */}
      <section id="solusi" className="max-w-7xl mx-auto px-5 py-24">
        <div className="text-xs font-bold tracking-[0.25em] flow-red">| FITUR UNGGULAN</div>
        <h2 className="mt-3 text-4xl font-extrabold flow-ink max-w-2xl">Semua yang Dibutuhkan Bisnis F&B, dalam <span className="flow-red">Satu Ekosistem.</span></h2>
        <p className="mt-4 flow-muted max-w-2xl">Dari hulu ke hilir: back office, outlet, dapur, rider keliling, hingga aplikasi pelanggan — satu data, satu alur.</p>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map(({ icon: I, t, d }) => (
            <div key={t} className="flow-card rounded-3xl p-6 hover:-translate-y-1 transition-transform">
              <div className="h-12 w-12 rounded-2xl flow-bg-red grid place-items-center"><I className="h-6 w-6" /></div>
              <div className="mt-5 font-extrabold text-lg flow-ink">{t}</div>
              <p className="mt-2 text-sm flow-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VOICE AI */}
      <section className="max-w-7xl mx-auto px-5">
        <div className="flow-dark rounded-[32px] p-10 md:p-14 grid md:grid-cols-2 gap-10 items-center overflow-hidden relative">
          <div>
            <div className="text-xs font-bold tracking-[0.25em] flow-red">AI VOICE ORDER</div>
            <h3 className="mt-3 text-3xl md:text-4xl font-extrabold">Kasir cukup bicara, pesanan langsung masuk.</h3>
            <p className="mt-4 text-background/70">"Kopi aren satu, less sugar, sama americano dua." FlowF&B memahami bahasa sehari-hari dan mengisi keranjang otomatis — varian, gula, es, sampai add-on.</p>
          </div>
          <div className="rounded-3xl bg-background/10 border border-background/15 p-6 space-y-3">
            <div className="flex items-center gap-3"><div className="h-14 w-14 rounded-full flow-bg-red grid place-items-center"><Mic className="h-6 w-6" /></div><div className="text-sm">Tambah 2 americano dan 1 aren latte</div></div>
            <div className="rounded-2xl bg-background/10 p-3 text-sm flex items-center gap-2"><Check className="h-4 w-4 text-success" /> 3 item ditambahkan ke keranjang</div>
          </div>
        </div>
      </section>

      {/* CUSTOMER */}
      <section id="customer" className="max-w-7xl mx-auto px-5 py-24 grid md:grid-cols-[1fr_1.2fr] gap-10 items-center">
        <div>
          <div className="text-xs font-bold tracking-[0.25em] flow-red">DIPERCAYA OLEH</div>
          <h3 className="mt-3 text-3xl font-extrabold flow-ink">Zeger Coffee menjalankan seluruh operasionalnya di FlowF&B.</h3>
          <p className="mt-4 flow-muted">Branch hub, outlet, armada "On The Wheels", sampai aplikasi member — semua satu sistem.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[['20+', 'Rider aktif'], ['4', 'Aplikasi terhubung'], ['1', 'Data terpusat']].map(([a, b]) => (
            <div key={b} className="flow-card rounded-3xl p-6 text-center"><div className="text-4xl font-extrabold flow-red">{a}</div><div className="text-sm flow-muted mt-1">{b}</div></div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="harga" className="flow-gray py-24">
        <div className="max-w-7xl mx-auto px-5">
          <h2 className="text-4xl font-extrabold text-center flow-ink">Paket untuk setiap skala bisnis</h2>
          <p className="text-center flow-muted mt-3">Aktifkan modul sesuai kebutuhan. Upgrade kapan saja.</p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.name} className={`rounded-3xl p-8 ${p.hot ? 'flow-dark scale-[1.03]' : 'flow-card'}`}>
                {p.hot && <span className="inline-block flow-bg-red rounded-full px-3 py-1 text-xs font-bold mb-3">Paling Populer</span>}
                <div className="text-xl font-extrabold">{p.name}</div>
                <div className={`text-sm ${p.hot ? 'text-background/70' : 'flow-muted'}`}>{p.who}</div>
                <div className="mt-5 text-4xl font-extrabold">{p.price !== 'Custom' && <span className="text-lg align-top">Rp</span>}{p.price}<span className={`text-sm font-medium ${p.hot ? 'text-background/60' : 'flow-muted'}`}>{p.price !== 'Custom' && ' /outlet/bln'}</span></div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.items.map((i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 flow-red shrink-0 mt-0.5" />{i}</li>)}
                </ul>
                <button onClick={() => navigate(`/onboarding?plan=${p.name.toLowerCase()}`)} className={`mt-8 w-full rounded-2xl py-3.5 font-bold ${p.hot ? 'flow-btn' : 'flow-btn-ghost'}`}>Mulai {p.name}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 py-24">
        <div className="flow-bg-red rounded-[32px] p-12 md:p-16 text-center relative overflow-hidden">
          <FlowMark className="absolute -right-10 -top-10 h-64 w-64 opacity-20" />
          <h2 className="text-4xl md:text-5xl font-extrabold">Powering Every Bite of Growth.</h2>
          <p className="mt-4 opacity-90 max-w-xl mx-auto">Daftarkan bisnis Anda, isi profil dan menu, dan POS siap dipakai hari ini juga.</p>
          <button onClick={() => navigate('/onboarding')} className="mt-8 bg-background flow-red rounded-2xl px-8 py-4 font-extrabold inline-flex items-center gap-2 shadow-xl">Mulai Onboarding <ArrowRight className="h-5 w-5" /></button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-5 py-10 flex flex-col md:flex-row justify-between gap-6">
          <div><FlowLogo size="sm" /><p className="text-sm flow-muted mt-3">A brand by Flowstack · Jakarta, Indonesia</p></div>
          <div className="text-sm flow-muted">© {new Date().getFullYear()} FlowF&B. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default FlowLanding;
