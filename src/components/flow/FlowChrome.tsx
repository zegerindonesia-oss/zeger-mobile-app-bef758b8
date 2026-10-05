import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { FlowLogo } from './FlowLogo';
import { PRODUCTS, SOLUTIONS, FlowPage } from '@/lib/flow-content';

const Mega = ({ items, base }: { items: FlowPage[]; base: string }) => (
  <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
    transition={{ duration: 0.18 }}
    className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[680px]">
    <div className="flow-glass rounded-3xl p-3 grid grid-cols-2 gap-1">
      {items.map(({ slug, icon: I, title, short }) => (
        <Link key={slug} to={`${base}/${slug}`} className="flex gap-3 rounded-2xl p-3 hover:bg-background transition-colors group">
          <div className="h-10 w-10 shrink-0 rounded-xl flow-soft grid place-items-center group-hover:scale-110 transition-transform"><I className="h-5 w-5 flow-red" /></div>
          <div><div className="text-sm font-bold flow-ink">{title}</div><div className="text-xs flow-muted">{short}</div></div>
        </Link>
      ))}
    </div>
  </motion.div>
);

export const FlowNav = () => {
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const menus = [
    { k: 'produk', label: 'Produk', items: PRODUCTS, base: '/produk' },
    { k: 'solusi', label: 'Solusi', items: SOLUTIONS, base: '/solusi' },
  ];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-border/60' : ''}`}>
      <div className="max-w-7xl mx-auto px-5 h-[72px] flex items-center justify-between">
        <Link to="/landing"><FlowLogo size="sm" /></Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold flow-ink">
          {menus.map((m) => (
            <div key={m.k} className="relative" onMouseEnter={() => setOpen(m.k)} onMouseLeave={() => setOpen(null)}>
              <button className="px-4 py-2 rounded-full hover:bg-muted flex items-center gap-1">{m.label}<ChevronDown className={`h-4 w-4 transition-transform ${open === m.k ? 'rotate-180' : ''}`} /></button>
              <AnimatePresence>{open === m.k && <Mega items={m.items} base={m.base} />}</AnimatePresence>
            </div>
          ))}
          <Link to="/harga" className="px-4 py-2 rounded-full hover:bg-muted">Harga</Link>
          <Link to="/customer" className="px-4 py-2 rounded-full hover:bg-muted">Customer</Link>
          <Link to="/tentang" className="px-4 py-2 rounded-full hover:bg-muted">Tentang</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden sm:block text-sm font-semibold flow-ink px-3">Masuk</Link>
          <Link to="/onboarding" className="flow-btn rounded-full px-5 py-2.5 text-sm font-bold flex items-center gap-1.5">Coba Gratis <ArrowRight className="h-4 w-4" /></Link>
          <button className="lg:hidden p-2" onClick={() => setMobile(!mobile)} aria-label="Menu">{mobile ? <X /> : <Menu />}</button>
        </div>
      </div>
      {mobile && (
        <div className="lg:hidden bg-background border-t border-border max-h-[80vh] overflow-y-auto p-5 space-y-4">
          {menus.map((m) => (
            <div key={m.k}><div className="text-xs font-bold flow-red tracking-widest mb-2">{m.label.toUpperCase()}</div>
              {m.items.map((i) => <Link key={i.slug} to={`${m.base}/${i.slug}`} onClick={() => setMobile(false)} className="block py-1.5 text-sm flow-ink">{i.title}</Link>)}
            </div>
          ))}
          {['harga', 'customer', 'tentang', 'auth'].map((p) => <Link key={p} to={`/${p}`} className="block py-1.5 text-sm font-semibold flow-ink capitalize">{p === 'auth' ? 'Masuk' : p}</Link>)}
        </div>
      )}
    </header>
  );
};

export const FlowFooter = () => (
  <footer className="border-t border-border bg-background">
    <div className="max-w-7xl mx-auto px-5 py-14 grid md:grid-cols-5 gap-8">
      <div className="md:col-span-2"><FlowLogo size="sm" /><p className="text-sm flow-muted mt-4 max-w-xs">The Operating System for F&B. A brand by Flowstack · Indonesia.</p></div>
      <div><div className="font-bold flow-ink mb-3 text-sm">Produk</div>{PRODUCTS.slice(0, 5).map((p) => <Link key={p.slug} to={`/produk/${p.slug}`} className="block text-sm flow-muted py-1 hover:text-primary">{p.title}</Link>)}</div>
      <div><div className="font-bold flow-ink mb-3 text-sm">Solusi</div>{SOLUTIONS.map((p) => <Link key={p.slug} to={`/solusi/${p.slug}`} className="block text-sm flow-muted py-1 hover:text-primary">{p.title}</Link>)}</div>
      <div><div className="font-bold flow-ink mb-3 text-sm">Perusahaan</div>{[['Harga', '/harga'], ['Customer', '/customer'], ['Tentang', '/tentang'], ['Masuk', '/auth'], ['Daftar', '/onboarding']].map(([l, h]) => <Link key={h} to={h} className="block text-sm flow-muted py-1 hover:text-primary">{l}</Link>)}</div>
    </div>
    <div className="border-t border-border py-5 text-center text-xs flow-muted">© {new Date().getFullYear()} FlowF&B by Flowstack. All rights reserved.</div>
  </footer>
);

export const FlowShell = ({ children }: { children: ReactNode }) => (
  <div className="flow-site min-h-screen"><FlowNav /><main>{children}</main><FlowFooter /></div>
);

export const Reveal = ({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
    transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>{children}</motion.div>
);
