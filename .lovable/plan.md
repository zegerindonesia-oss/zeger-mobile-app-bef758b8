
## Login POS yang Sudah Ada

Saya menemukan 2 user kasir yang sudah pernah dibuat:

| Email | Nama | Role | Branch |
|---|---|---|---|
| `kasirkemiri@email.com` | Kasir Kemiri | `bh_kasir` (Hub) | Branch Hub Zeger Kemiri |
| `kasircontoh@email.com` | kasir contoh | `3_SB_Kasir` (Small Branch) | Zeger Coffee Malang |

Password tidak bisa saya lihat (hash). Kalau lupa, nanti bisa di-reset lewat menu User Management atau saya bantu buatkan ulang.

**Catatan penting**: Saat ini route `/pos` di `App.tsx` HANYA mengizinkan role `ho_admin`, `branch_manager`, `sb_branch_manager` — **kasir tidak bisa masuk POS**. Ini bug yang harus diperbaiki di Phase 1.

---

## Strategi Bertahap (Tanpa Mengubah Logic Existing)

POS dikembangkan di **route baru `/pos`** dengan komponen baru di folder `src/pages/pos/` dan `src/components/pos/`. File `src/pages/POS.tsx` lama dipertahankan (atau dijadikan fallback) — tidak menyentuh logic dashboard, inventory, stock card, rider, customer app, dll.

Tabel database baru menggunakan prefix `pos_*` agar tidak bentrok dengan `transactions`, `inventory`, `customers` yang sudah berjalan. Sinkronisasi ke stock card lewat insert ke `stock_movements` (read-only pattern, mengikuti logic yang sudah ada).

---

### PHASE 1 — Foundation & Akses Kasir (yang akan kita kerjakan sekarang)

**Tujuan**: Kasir bisa login, masuk halaman POS layout baru, lihat menu real-time dari DB master, tambah ke cart, bayar tunai/QRIS, struk auto-generate, transaksi ter-sync ke dashboard.

**Cakupan Phase 1**:
1. **Akses & Routing**
   - Tambah role `bh_kasir`, `sb_kasir`, `2_Hub_Kasir`, `3_SB_Kasir` ke `RoleBasedRoute` `/pos`
   - Auto-redirect kasir ke `/pos` setelah login (di `Auth.tsx`)
   - POS pakai `Layout` minimal (tanpa sidebar dashboard) supaya fokus kasir

2. **Database baru** (migration, tidak menyentuh tabel existing):
   - `pos_shifts` (open/close shift, modal awal, kas akhir, selisih)
   - `pos_transactions` (header transaksi POS dengan order_type, mixed payment, service_charge, tax)
   - `pos_transaction_items` (detail item + notes per item)
   - `pos_cash_movements` (cash in/out selama shift)
   - RLS: kasir hanya bisa CRUD untuk branch-nya sendiri; manager/HO bisa view semua

3. **POS Interface v1** — split screen layout:
   - **Kiri 60%**: Header (logo, nama branch, nama kasir, jam realtime, indikator online), tab kategori, grid produk dari `products` (foto, nama, harga, badge stok), search bar
   - **Kanan 40%**: Cart aktif (qty +/-, hapus, catatan per item), tipe order (Dine In / Take Away / GoFood / GrabFood / ShopeeFood / Zeger App / Internal), summary (subtotal, diskon, pajak opsional, total besar), tombol Bayar

4. **Pembayaran v1**:
   - Tunai (input nominal → kembalian otomatis)
   - QRIS (display saja dulu, mark sebagai paid)
   - Transfer (input bukti manual)
   - Mixed payment 2 metode

5. **Shift Management v1**:
   - Open Shift modal saat kasir pertama kali buka POS (pilih shift, input modal kas)
   - Header: tombol "Tutup Shift" → modal hitung kas fisik, tampilkan expected vs actual + selisih
   - Cash In/Cash Out sederhana

6. **Struk Digital**:
   - Modal preview struk setelah bayar
   - Tombol Print (window.print pakai CSS thermal 58mm/80mm)
   - Tombol kirim WhatsApp (wa.me link dengan teks struk)

7. **Sync ke Existing System**:
   - Setiap transaksi POS yang `paid` → insert juga ke `transactions` + `transaction_items` (tabel existing) supaya dashboard, finance, sales report tetap jalan tanpa perubahan
   - Stok berkurang via update `inventory` (mengikuti pola existing)

**Yang BELUM dikerjakan di Phase 1** (akan masuk Phase berikutnya):
- Phase 2: Promo engine lengkap, voucher, bundle, happy hour, split bill
- Phase 3: Online order integration (GoFood/Grab/Shopee notifikasi panel) + Kitchen Display System
- Phase 4: Table Management (layout meja drag-drop, merge, move)
- Phase 5: Void/Refund flow dengan PIN supervisor + audit log
- Phase 6: CRM lengkap (customer search, birthday promo) + Loyalty earn/redeem di POS
- Phase 7: Offline mode (IndexedDB + sync queue)
- Phase 8: Advanced reports di POS (peak hour, top item realtime)

---

### Technical Notes
- Stack tetap: React + Vite + Tailwind + shadcn + Supabase (tidak ada perubahan)
- File baru: `src/pages/pos/POSMain.tsx`, `src/components/pos/POSHeader.tsx`, `POSProductGrid.tsx`, `POSCart.tsx`, `POSPayment.tsx`, `POSShiftModal.tsx`, `POSReceipt.tsx`
- Hook baru: `src/hooks/usePOSShift.tsx`, `usePOSCart.tsx`
- Tidak ada file existing yang dihapus. `App.tsx` hanya ditambah role di `allowedRoles` route `/pos` dan `Auth.tsx` ditambah redirect kasir.

### Konfirmasi yang Saya Butuhkan Sebelum Eksekusi Phase 1
Setelah Anda approve plan ini, saya akan langsung kerjakan Phase 1 end-to-end. Untuk Phase 1 saya akan asumsikan:
- Pajak default **0%** (toggle off), bisa diaktifkan per branch nanti di Phase 2
- Service charge default **0%**
- Nomor meja Dine In = input text bebas (belum ada layout meja)
- Online order (GoFood/Grab/Shopee) di Phase 1 = **input manual** nomor order saja, integrasi API masuk Phase 3
