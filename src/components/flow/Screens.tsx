import { FlowLogo } from './FlowLogo';
import latte from '@/assets/menu/Classic_Latte.webp.asset.json';
import aren from '@/assets/menu/Aren_Latte.webp.asset.json';
import americano from '@/assets/menu/Americano.webp.asset.json';
import matcha from '@/assets/menu/Matcha_Latte.webp.asset.json';
import mocha from '@/assets/menu/Caramel_Mocha.webp.asset.json';
import choco from '@/assets/menu/Chocomalt.webp.asset.json';

export const MENU = [
  { n: 'Classic Latte', p: '15.000', img: latte.url }, { n: 'Aren Latte', p: '16.000', img: aren.url },
  { n: 'Americano', p: '12.000', img: americano.url }, { n: 'Matcha Latte', p: '18.000', img: matcha.url },
  { n: 'Caramel Mocha', p: '18.000', img: mocha.url }, { n: 'Chocomalt', p: '15.000', img: choco.url },
];

export const DashboardScreen = () => (
  <div className="h-full grid grid-cols-[22%_1fr] text-[1.1cqw] flow-ink" style={{ containerType: 'inline-size' } as any}>
    <div className="border-r border-border p-[2cqw] space-y-[0.6cqw] bg-background">
      <div className="scale-75 origin-left"><FlowLogo size="sm" showTagline={false} /></div>
      {['Dashboard', 'POS', 'Pesanan', 'Menu & Resep', 'Inventori', 'Pembelian', 'Outlet', 'Pelanggan', 'Keuangan', 'Laporan', 'Pengaturan'].map((m, i) => (
        <div key={m} className={`rounded-[0.6cqw] px-[1cqw] py-[0.6cqw] text-[1.2cqw] ${i === 0 ? 'flow-bg-red font-bold' : 'flow-muted'}`}>{m}</div>
      ))}
    </div>
    <div className="p-[2cqw] space-y-[1.4cqw] bg-muted/40">
      <div className="text-[1.6cqw] font-bold">Selamat Pagi, Outlet Kemiri</div>
      <div className="grid grid-cols-4 gap-[1cqw]">
        {[['Omset Hari Ini', 'Rp 12.450.000', '+12,3%'], ['Total Pesanan', '328', '+8,2%'], ['Rata-rata', 'Rp 37.900', '+6,1%'], ['Outlet Aktif', '6', 'Aktif']].map(([a, b, c]) => (
          <div key={a} className="rounded-[1cqw] bg-background border border-border p-[1.2cqw]">
            <div className="text-[1cqw] flow-muted">{a}</div><div className="text-[1.6cqw] font-extrabold">{b}</div><div className="text-[1cqw] text-success font-semibold">{c}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1.6fr_1fr] gap-[1cqw]">
        <div className="rounded-[1cqw] bg-background border border-border p-[1.2cqw]">
          <div className="text-[1.2cqw] font-bold mb-[0.6cqw]">Penjualan Hari Ini</div>
          <svg viewBox="0 0 300 100" className="w-full">
            <defs><linearGradient id="dg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="hsl(354 77% 50%)" stopOpacity=".35" /><stop offset="1" stopColor="hsl(354 77% 50%)" stopOpacity="0" /></linearGradient></defs>
            <path d="M0 85 L25 70 L50 75 L75 58 L100 64 L125 45 L150 52 L175 30 L200 46 L225 22 L250 38 L275 18 L300 10 L300 100 L0 100Z" fill="url(#dg)" />
            <path d="M0 85 L25 70 L50 75 L75 58 L100 64 L125 45 L150 52 L175 30 L200 46 L225 22 L250 38 L275 18 L300 10" fill="none" stroke="hsl(354 77% 50%)" strokeWidth="2.5" />
          </svg>
        </div>
        <div className="rounded-[1cqw] bg-background border border-border p-[1.2cqw] space-y-[0.7cqw]">
          <div className="text-[1.2cqw] font-bold">Menu Terlaris</div>
          {MENU.slice(0, 4).map((m, i) => (
            <div key={m.n} className="flex items-center gap-[0.8cqw]"><img src={m.img} alt="" className="h-[2.6cqw] w-[2.6cqw] rounded-[0.5cqw] object-cover" /><div className="flex-1 text-[1.1cqw] font-semibold">{m.n}</div><div className="text-[1cqw] flow-muted">{124 - i * 14} cup</div></div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const CustomerAppScreen = () => (
  <div className="h-full flex flex-col bg-background">
    <div className="flow-bg-red px-4 pt-10 pb-5">
      <div className="text-xs font-extrabold tracking-wide">ZEGER COFFEE</div>
      <div className="text-xl font-extrabold leading-tight mt-3">Mood Booster<br />Untuk Harimu.</div>
      <div className="mt-3 rounded-full bg-background/95 text-[10px] flow-muted px-3 py-2">Cari menu favoritmu…</div>
    </div>
    <div className="p-3 flex-1 overflow-hidden">
      <div className="text-xs font-bold flow-ink mb-2">Menu Favorit</div>
      <div className="grid grid-cols-2 gap-2">
        {MENU.slice(0, 4).map((m) => (
          <div key={m.n} className="rounded-xl border border-border overflow-hidden"><img src={m.img} alt="" className="h-16 w-full object-cover" /><div className="p-1.5"><div className="text-[10px] font-bold flow-ink truncate">{m.n}</div><div className="text-[9px] flow-red font-bold">Rp {m.p}</div></div></div>
        ))}
      </div>
      <div className="mt-2 rounded-xl flow-soft p-2 flex justify-between items-center"><span className="text-[10px] font-bold flow-ink">Zeger Points</span><span className="text-sm font-extrabold flow-red">1.250</span></div>
    </div>
  </div>
);

export const POSScreen = () => (
  <div className="h-full grid grid-cols-[1fr_34%] bg-muted/40 text-[10px]">
    <div className="p-3 grid grid-cols-3 gap-2 content-start">
      {MENU.map((m) => (
        <div key={m.n} className="rounded-xl bg-background border border-border overflow-hidden shadow-sm"><img src={m.img} alt="" className="h-14 w-full object-cover" /><div className="p-1.5"><div className="font-bold flow-ink truncate">{m.n}</div><div className="flow-red font-bold">Rp {m.p}</div></div></div>
      ))}
    </div>
    <div className="bg-background border-l border-border p-3 flex flex-col">
      <div className="font-bold flow-ink">Pesanan #328</div>
      {MENU.slice(0, 3).map((m, i) => <div key={m.n} className="flex justify-between py-1.5 border-b border-border flow-ink"><span>{i + 1}x {m.n}</span></div>)}
      <div className="mt-auto flow-btn rounded-xl text-center py-2 font-bold">Bayar Rp 46.000</div>
    </div>
  </div>
);
