
Lanjutan POS dari Phase 1 → Phase 2.

## Status Saat Ini
Phase 1 sudah selesai: kasir bisa login, buka shift, scan produk, cart, bayar (cash/QRIS/transfer/mixed), struk digital, tutup shift. Tabel `pos_*` sudah ada dan ter-sync ke dashboard.

## PHASE 2 — Promo, Voucher, Bundle, Split Bill & Sync Stok

**Tujuan**: POS bisa apply diskon/promo/voucher dengan benar, kasir bisa split bill, dan setiap transaksi POS otomatis kurangi stok + masuk ke tabel `transactions` existing supaya dashboard penjualan tetap akurat.

### Cakupan Phase 2

**1. Promo Engine (Open Promo — kasir bisa apply langsung)**
- Diskon % per item (klik item di cart → input % atau Rp)
- Diskon Rp per item
- Diskon % per bill (sudah ada Rp, tambah %)
- Free item (Buy X Get Y manual pilih item gratis)
- Tampilkan rincian diskon di summary cart

**2. Voucher & Promo Terkontrol (dari HQ)**
- Tabel baru: `pos_promotions` (id, name, type, scope, value, min_purchase, start_at, end_at, applicable_hours, applicable_branch_ids[], applicable_product_ids[], is_active)
- Tabel baru: `pos_vouchers` (id, code, promotion_id, customer_id nullable, is_used, used_at, used_by_transaction_id)
- Input kode voucher di cart → validasi real-time (cek expired, branch, min purchase, sudah dipakai)
- Happy Hour: auto-apply jika jam transaksi masuk window
- Halaman manajemen promo di HQ Dashboard (`/settings/promo-management`) — CRUD untuk admin/HO

**3. Bundle / Paket**
- Tabel baru: `pos_bundles` (id, name, price, components jsonb [{product_id, qty}], is_active, branch_ids[])
- Tampil sebagai card khusus di grid produk dengan badge "BUNDLE"
- Saat dipilih → expand jadi item-item komponen di cart (qty terikat) tapi dihitung 1 harga bundle

**4. Open Price & Custom Item**
- Tombol "+ Custom Item" di grid → modal input nama, harga, qty → masuk cart sebagai item non-master
- Untuk item internal/test

**5. Split Bill**
- Tombol "Split Bill" di cart (muncul kalau ada item)
- Mode: Split by Item (drag/checkbox item ke bill A/B/C), Split Equal (bagi rata jumlah orang), Split Custom (input nominal manual)
- Hasil: multiple `pos_transactions` dengan `parent_transaction_id` referensi
- Bayar masing-masing terpisah (metode bayar bisa beda per split)

**6. Sync ke Existing System (PENTING)**
- Saat transaksi POS `paid` → trigger DB atau function call:
  - Insert ke `transactions` existing (mark `source = 'pos_kasir'`)
  - Insert ke `transaction_items` existing
  - Update `inventory` kurangi stok per item (mengikuti pola `MobileSellerEnhanced`)
  - Insert ke `stock_movements` dengan type `sale_pos`
- Bahaya yang harus dijaga: TIDAK boleh sentuh logic rider/branch hub existing — POS hanya menulis ke tabel existing dengan source berbeda

**7. Pengaturan Pajak & Service Charge per Branch**
- Tambah kolom `pos_tax_percent` & `pos_service_charge_percent` di tabel `branches`
- Kasir auto-load setting ini saat buka shift
- Halaman setting di Branch Management (HQ only)

### Database Migration (akan minta approval)
```
- pos_promotions
- pos_vouchers  
- pos_bundles
- branches.pos_tax_percent (default 0)
- branches.pos_service_charge_percent (default 0)
- pos_transactions.parent_transaction_id (untuk split bill)
- RLS: HO/admin full access, kasir read-only untuk promo aktif di branchnya
```

### File Baru
- `src/components/pos/POSPromoDialog.tsx` — apply promo per item / per bill
- `src/components/pos/POSVoucherInput.tsx` — input + validasi kode voucher
- `src/components/pos/POSBundleCard.tsx` — render bundle di grid
- `src/components/pos/POSCustomItemDialog.tsx` — input open price item
- `src/components/pos/POSSplitBillDialog.tsx` — UI split bill 3 mode
- `src/pages/settings/PromoManagement.tsx` — CRUD promo HQ
- `src/pages/settings/BundleManagement.tsx` — CRUD bundle HQ
- `src/hooks/usePOSPromo.tsx` — logic apply/calc promo

### File yang Disentuh (minimal)
- `src/hooks/usePOSCart.tsx` — tambah field `applied_promos[]`, `voucher_code`, recalc total dengan promo
- `src/components/pos/POSCart.tsx` — tombol promo per item, voucher input, split bill button
- `src/pages/pos/POSMain.tsx` — handler trigger sync ke `transactions` existing setelah paid
- `src/App.tsx` — route promo management & bundle management
- TIDAK ada perubahan ke logic rider/dashboard/inventory/stock card existing

### Belum Dikerjakan (Phase berikutnya)
- Phase 3: Online order (GoFood/Grab/Shopee) panel + KDS
- Phase 4: Table management visual
- Phase 5: Void/refund + audit log
- Phase 6: CRM + loyalty point earn/redeem
- Phase 7: Offline mode
- Phase 8: Advanced report POS

### Asumsi
- Voucher dipakai 1x per kode (kecuali `is_reusable=true` future)
- Split bill: minimal 2 maksimal 6 split per transaksi
- Bundle: harga bundle override total komponen, stok tetap kurangi per komponen
- Sync ke `transactions` existing pakai trigger DB (lebih aman dari race condition daripada client-side)

Setelah approve, saya jalankan migration dulu, lalu build UI Phase 2 end-to-end.
