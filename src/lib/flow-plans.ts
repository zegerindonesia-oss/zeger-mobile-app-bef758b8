/** FlowF&B SaaS plan catalogue — single source for pricing page, signup, onboarding and Superadmin presets. */
export type PlanId = 'free' | 'sme' | 'mid_market' | 'enterprise';

export interface FlowPlan {
  id: PlanId;
  name: string;
  who: string;
  price: number; // IDR per outlet per month, 0 = free
  compare: string; // competitor reference price
  hot?: boolean;
  limits: { trx: string; outlets: string; devices: string; users: string; history: string };
  modules: string[];
  features: string[];
}

export const MODULE_LABELS: Record<string, string> = {
  pos: 'POS Kasir & Cetak Struk',
  table: 'Manajemen Meja & Split Bill',
  kds: 'Kitchen Display (KDS)',
  queue: 'Layar Antrean TV',
  bom: 'Bahan Baku & Resep HPP',
  voice: 'Voice AI Kasir',
  loyalty: 'CRM & Loyalty Poin',
  invoice: 'Invoice & Pembelian',
  finance: 'Laporan Keuangan (P&L, Neraca)',
  rider: 'Mobile Selling & Rider',
  customer_app: 'Aplikasi Customer White-Label',
};

export const PLANS: FlowPlan[] = [
  {
    id: 'free', name: 'Flow Free', who: 'Micro, booth & street food', price: 0, compare: 'Gratis selamanya',
    limits: { trx: '300 transaksi/bln', outlets: '1 outlet', devices: '1 perangkat', users: '1 akun', history: '7 hari' },
    modules: ['pos'],
    features: ['POS kasir lengkap', 'Menu, kategori & varian tanpa batas', 'Tunai, transfer & QRIS', 'Cetak struk thermal', 'Ringkasan penjualan harian'],
  },
  {
    id: 'sme', name: 'Flow SME', who: 'Kedai, café & bakery mandiri', price: 99000, compare: 'Kompetitor Rp249–299rb',
    limits: { trx: 'Tanpa batas', outlets: '1 outlet', devices: '2 perangkat', users: '5 akun', history: '1 tahun' },
    modules: ['pos', 'bom'],
    features: ['Semua fitur Flow Free', 'Stok bahan baku & resep HPP', 'Shift kasir & laporan X/Z', 'Beban operasional harian', 'Split payment', 'Ekspor Excel & PDF'],
  },
  {
    id: 'mid_market', name: 'Flow Mid-Market', who: 'Restoran dine-in, café ramai & bar', price: 249000, compare: 'Kompetitor Rp499–799rb', hot: true,
    limits: { trx: 'Tanpa batas', outlets: 'Hingga 3 outlet', devices: '5 perangkat/outlet', users: 'Akses berjenjang', history: 'Selamanya' },
    modules: ['pos', 'table', 'kds', 'queue', 'bom', 'voice', 'loyalty', 'invoice', 'finance'],
    features: ['Semua fitur Flow SME', 'Denah meja, open bill & split bill', 'KDS multi-stasiun bar & dapur', 'Layar antrean TV + panggilan suara', 'Potong stok resep otomatis', 'Voice AI kasir', 'Member QR, poin & reward', 'Purchase order & invoice supplier', 'Laba rugi, arus kas & neraca otomatis'],
  },
  {
    id: 'enterprise', name: 'Flow Enterprise', who: 'Franchise, chain & armada keliling', price: 599000, compare: 'Kompetitor Rp1,5jt+',
    limits: { trx: 'Tanpa batas', outlets: 'Tanpa batas + branch hub', devices: 'Tanpa batas', users: 'Tanpa batas', history: 'Selamanya' },
    modules: ['pos', 'table', 'kds', 'queue', 'bom', 'voice', 'loyalty', 'invoice', 'finance', 'rider', 'customer_app'],
    features: ['Semua fitur Flow Mid-Market', 'Mobile selling rider + GPS & setoran anti-fraud', 'Aplikasi customer dengan brand sendiri', 'Branch hub & transfer stok antar gudang', 'Laporan konsolidasi grup', 'Account manager & support prioritas'],
  },
];

export const LEGACY_PLAN: Record<string, PlanId> = { starter: 'sme', pro: 'mid_market' };
export const getPlan = (id?: string | null) => PLANS.find((p) => p.id === (LEGACY_PLAN[id || ''] || id)) || PLANS[2];
export const formatPrice = (n: number) => (n === 0 ? 'Rp0' : `Rp${(n / 1000).toLocaleString('id-ID')}rb`);
