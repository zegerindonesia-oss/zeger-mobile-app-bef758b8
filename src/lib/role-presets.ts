// Default module access per role (F&B standard). Ids match ACCESS_MODULES / user_module_permissions.module_name.
export const MODULE_ACCESS_OPTIONS = [
  { id: 'pos', label: 'Terminal Kasir POS', desc: 'Jualan, buka/tutup kasir, kas masuk/keluar' },
  { id: 'reports', label: 'Laporan', desc: 'Laporan penjualan & shift' },
  { id: 'inventory', label: 'Stok & Opname', desc: 'Mutasi stok, opname, waste' },
  { id: 'bom', label: 'Bahan Baku, Resep & BOM', desc: 'Resep & bahan baku' },
  { id: 'procurement', label: 'PO & Invoice Pembelian', desc: 'Purchase order, terima barang, supplier' },
  { id: 'finance', label: 'Keuangan & Cash Flow', desc: 'Kas, biaya, akuntansi' },
  { id: 'menu', label: 'Manajemen Menu & Harga', desc: 'Produk, harga, promo' },
  { id: 'rider', label: 'Rider & Distribusi', desc: 'Kirim stok & setoran rider' },
] as const;

export type ModuleAccessId = (typeof MODULE_ACCESS_OPTIONS)[number]['id'];

const ALL: ModuleAccessId[] = MODULE_ACCESS_OPTIONS.map((m) => m.id);

export const ROLE_MODULE_DEFAULTS: Record<string, { summary: string; modules: ModuleAccessId[] }> = {
  ho_admin: { summary: 'Akses penuh semua modul', modules: ALL },
  ho_owner: { summary: 'Akses penuh semua modul', modules: ALL },
  ho_staff: { summary: 'Purchasing: PO, supplier, bahan baku & stok', modules: ['procurement', 'bom', 'inventory', 'reports'] },
  finance: { summary: 'Keuangan, akuntansi, verifikasi invoice & laporan', modules: ['finance', 'procurement', 'reports'] },
  branch_manager: { summary: 'Operasional cabang: POS, stok, menu, laporan, rider', modules: ['pos', 'reports', 'inventory', 'bom', 'menu', 'rider', 'procurement'] },
  sb_branch_manager: { summary: 'Operasional outlet: POS, stok, laporan', modules: ['pos', 'reports', 'inventory', 'rider'] },
  bh_staff: { summary: 'Staff gudang/barista: stok, opname, resep', modules: ['inventory', 'bom'] },
  bh_kasir: { summary: 'Kasir: POS, buka/tutup kasir, laporan shift sendiri', modules: ['pos', 'reports'] },
  sb_kasir: { summary: 'Kasir: POS, buka/tutup kasir, laporan shift sendiri', modules: ['pos', 'reports'] },
  bh_report: { summary: 'Laporan saja (read-only)', modules: ['reports'] },
  sb_report: { summary: 'Laporan saja (read-only)', modules: ['reports'] },
  bh_rider: { summary: 'Aplikasi Rider: pengantaran, stok bawaan, setoran', modules: ['rider'] },
  sb_rider: { summary: 'Aplikasi Rider: pengantaran, stok bawaan, setoran', modules: ['rider'] },
  rider: { summary: 'Aplikasi Rider: pengantaran, stok bawaan, setoran', modules: ['rider'] },
};

export function defaultModulesForRole(role: string): ModuleAccessId[] {
  return ROLE_MODULE_DEFAULTS[role]?.modules ?? [];
}
