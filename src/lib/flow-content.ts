import {
  Coffee, UtensilsCrossed, Croissant, Store, CloudCog, Bike, ShoppingCart, Monitor, Tv, Package,
  Gift, Smartphone, Mic, Receipt, Wallet, Truck, type LucideIcon,
} from 'lucide-react';

export interface FlowPage {
  slug: string; icon: LucideIcon; title: string; short: string; headline: string; desc: string;
  bullets: string[]; stats: [string, string][];
}

export const SOLUTIONS: FlowPage[] = [
  { slug: 'coffee-shop', icon: Coffee, title: 'Coffee Shop & Café', short: 'Antrean cepat, varian minuman, loyalty member.',
    headline: 'Dibuat untuk ritme coffee shop yang padat.', desc: 'Varian gula, es, susu, dan add-on tersimpan otomatis ke struk, stiker cup, dan layar barista.',
    bullets: ['Modifier minuman 1 ketukan', 'Stiker cup otomatis', 'KDS stasiun barista', 'Poin member di semua channel'], stats: [['< 8 dtk', 'per transaksi'], ['100%', 'HPP real-time'], ['3x', 'repeat order member']] },
  { slug: 'restoran', icon: UtensilsCrossed, title: 'Restoran Dine-In', short: 'Denah meja, open bill, split bill, dapur.',
    headline: 'Dari meja ke dapur tanpa kertas.', desc: 'Kelola denah meja, open bill, pesanan tambahan, dan split bill — dapur menerima tiket secara real-time.',
    bullets: ['Floor plan & status meja', 'Pindah & gabung meja', 'Split bill per item', 'Tiket dapur per printer'], stats: [['-40%', 'waktu tunggu'], ['0', 'pesanan hilang'], ['24/7', 'monitoring']] },
  { slug: 'bakery', icon: Croissant, title: 'Bakery & Pastry', short: 'Produksi, resep, dan stok harian.',
    headline: 'Setiap gram tepung tercatat.', desc: 'Resep BOM memotong bahan baku otomatis, opname harian, dan laporan waste untuk menekan kerugian.',
    bullets: ['Resep & HPP otomatis', 'Stok bahan baku', 'Laporan waste', 'Pre-order pelanggan'], stats: [['-25%', 'waste'], ['1 klik', 'opname'], ['Real-time', 'stok']] },
  { slug: 'franchise', icon: Store, title: 'Franchise & Chain', short: 'Multi outlet, hub, kontrol pusat.',
    headline: 'Satu pusat kendali untuk ratusan outlet.', desc: 'Harga, menu, promo, dan hak akses diatur dari kantor pusat; setiap outlet melapor otomatis.',
    bullets: ['Hub & outlet bertingkat', 'Transfer stok antar cabang', 'Hak akses per jabatan', 'Konsolidasi laporan'], stats: [['∞', 'outlet'], ['5 level', 'hak akses'], ['1', 'dashboard']] },
  { slug: 'cloud-kitchen', icon: CloudCog, title: 'Cloud Kitchen', short: 'GoFood, GrabFood, ShopeeFood terpusat.',
    headline: 'Semua aplikasi ojol, satu layar.', desc: 'Pesanan online masuk ke panel yang sama dengan kasir, langsung ke dapur, stok ikut terpotong.',
    bullets: ['Online order hub', 'KDS multi-stasiun', 'SLA timer', 'Analitik per channel'], stats: [['4+', 'channel'], ['< 1 dtk', 'sinkron'], ['100%', 'tercatat']] },
  { slug: 'mobile-selling', icon: Bike, title: 'Mobile Selling & Rider', short: 'Gerobak, motor, mobil keliling.',
    headline: 'Jualan keliling serapi outlet.', desc: 'Rider menerima stok, berjualan, check-in lokasi, dan setor tunai — semua terpantau dari kantor.',
    bullets: ['Aplikasi rider', 'Transfer & retur stok', 'Checkpoint GPS', 'Setoran & selisih stok'], stats: [['Live', 'lokasi rider'], ['0', 'selisih tak tercatat'], ['Harian', 'tutup shift']] },
];

export const PRODUCTS: FlowPage[] = [
  { slug: 'pos-kasir', icon: ShoppingCart, title: 'POS Kasir', short: 'Transaksi cepat, multi pembayaran.',
    headline: 'Kasir tercepat di Indonesia.', desc: 'Tunai, QRIS, transfer, split bill, voucher, member, dan cetak thermal — dalam satu layar kaca yang elegan.',
    bullets: ['Shift & laporan X/Z', 'Multi printer', 'Offline-ready', 'Voice AI order'], stats: [['F2', 'voice order'], ['58/80mm', 'thermal'], ['X/Z', 'report']] },
  { slug: 'kitchen-display', icon: Monitor, title: 'Kitchen Display', short: 'Barista & dapur per stasiun.',
    headline: 'Dapur yang tidak pernah lupa.', desc: 'Tiket per stasiun, timer SLA berwarna, centang per item, dan recall pesanan dalam satu ketukan.',
    bullets: ['Stasiun Barista/Dapur', 'SLA kuning & merah', 'Auto-bump siap', 'Recall 2 jam'], stats: [['5/10', 'menit SLA'], ['1 tap', 'recall'], ['Real-time', 'sinkron']] },
  { slug: 'layar-antrean', icon: Tv, title: 'Layar Antrean TV', short: 'Panggilan suara otomatis.',
    headline: 'Pelanggan tahu kapan pesanannya siap.', desc: 'Layar TV menampilkan pesanan disiapkan dan siap diambil, lengkap dengan panggilan suara.',
    bullets: ['Suara bahasa Indonesia', 'Full screen', 'Nomor & nama', 'Bel otomatis'], stats: [['0', 'teriak nama'], ['TV', 'apa saja'], ['Auto', 'refresh']] },
  { slug: 'bahan-resep', icon: Package, title: 'Bahan Baku & Resep', short: 'BOM, HPP, opname.',
    headline: 'HPP akurat sampai ke gram.', desc: 'Setiap menu terjual memotong bahan sesuai resep. Ketahui margin setiap produk secara langsung.',
    bullets: ['Master bahan baku', 'Resep per menu', 'Stok masuk & opname', 'Riwayat pergerakan'], stats: [['Gram', 'presisi'], ['Live', 'margin'], ['Auto', 'deduct']] },
  { slug: 'loyalty-crm', icon: Gift, title: 'CRM & Loyalty', short: 'Poin, voucher, subscription.',
    headline: 'Pelanggan setia, omset naik.', desc: 'Satu QR member untuk outlet, rider, dan aplikasi. Poin, tier, redeem, voucher, referral, dan langganan.',
    bullets: ['QR member', 'Redeem reward', 'Voucher & referral', 'Subscription plan'], stats: [['Semua', 'channel'], ['Offline', 'sync'], ['Tier', 'member']] },
  { slug: 'aplikasi-customer', icon: Smartphone, title: 'Aplikasi Customer', short: 'White-label untuk brand Anda.',
    headline: 'Aplikasi seperti brand besar — milik Anda.', desc: 'Menu, pesan, lacak rider terdekat, poin, promo, dan notifikasi — dengan brand Anda sendiri.',
    bullets: ['Menu & checkout', 'Peta rider', 'Promo banner', 'Pengaturan dari back office'], stats: [['Brand', 'Anda'], ['iOS', '& Android'], ['Live', 'tracking']] },
  { slug: 'voice-ai', icon: Mic, title: 'Voice AI Assistant', short: 'Kasir cukup bicara.',
    headline: 'Pesanan masuk hanya dengan suara.', desc: 'AI memahami bahasa sehari-hari: menu, jumlah, gula, es, add-on — keranjang terisi otomatis.',
    bullets: ['Bahasa Indonesia', 'Varian otomatis', 'Shortcut F2', 'Insight AI'], stats: [['3x', 'lebih cepat'], ['ID', 'native'], ['AI', 'parser']] },
  { slug: 'back-office', icon: Receipt, title: 'Back Office ERP', short: 'Invoice, pembelian, keuangan.',
    headline: 'Hulu ke hilir dalam satu ERP.', desc: 'Pembelian, invoice, beban operasional, laba rugi, arus kas, neraca, dan multi user bertingkat.',
    bullets: ['Laba rugi & neraca', 'Beban operasional', 'Pendapatan & kasbon', 'User bertingkat'], stats: [['P&L', 'otomatis'], ['Multi', 'cabang'], ['Audit', 'trail']] },
  { slug: 'invoice', icon: FileText, title: 'Invoice & Pembelian', short: 'PO, tagihan supplier, jatuh tempo.',
    headline: 'Tagihan rapi, tak ada yang terlewat.', desc: 'Purchase order, invoice supplier, penerimaan barang, dan pengingat jatuh tempo dalam satu alur.',
    bullets: ['Purchase order', 'Invoice supplier', 'Status lunas/belum', 'Stok masuk otomatis'], stats: [['PO', 'digital'], ['Auto', 'stok masuk'], ['Alert', 'jatuh tempo']] },
  { slug: 'laporan-keuangan', icon: BarChart3, title: 'Laporan Keuangan', short: 'Laba rugi, arus kas, neraca.',
    headline: 'Laporan keuangan tanpa spreadsheet.', desc: 'Laba rugi, arus kas, dan neraca terbentuk otomatis dari setiap transaksi dan beban outlet.',
    bullets: ['Laba rugi otomatis', 'Arus kas harian', 'Neraca', 'Per outlet & konsolidasi'], stats: [['P&L', 'real-time'], ['Multi', 'outlet'], ['Export', 'PDF/Excel']] },
  { slug: 'mobile-selling', icon: Bike, title: 'Mobile Selling', short: 'Gerobak, motor, rider keliling.',
    headline: 'Jualan keliling, kontrol penuh.', desc: 'Aplikasi rider untuk jual keliling: stok di motor, checkpoint GPS, setoran tunai, dan selisih stok anti-fraud.',
    bullets: ['POS di HP rider', 'Stok & retur per shift', 'Checkpoint GPS', 'Setoran & selisih stok'], stats: [['GPS', 'checkpoint'], ['Shift', 'tertutup'], ['0', 'selisih']] },
];

export const EXTRA_ICONS = { Wallet, Truck };
