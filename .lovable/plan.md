## PHASE 3 — Online Order Panel & KDS Dapur

**Tujuan**: Kasir bisa terima/kelola order dari GoFood/Grab/Shopee/Zeger di panel khusus, dan dapur punya layar KDS realtime untuk lihat & update status item (queued → cooking → ready → served).

### Cakupan

**1. Online Order Panel (di POS)**
- Tab/drawer baru di POSMain: "Order Online" dengan badge jumlah order pending
- Form input cepat: pilih platform (GoFood/Grab/Shopee/Zeger), nomor order platform, nama customer, item (search produk + qty + catatan), total override (untuk match harga di app aggregator), metode bayar (default sesuai platform: GoFood→qris/transfer, dst)
- Order online masuk `pos_transactions` dengan `order_type` platform + `status='preparing'` (langsung kirim ke KDS, belum perlu kasir tutup)
- Tombol: "Terima → Kirim ke Dapur", "Tolak", "Selesai & Bayar" (saat kurir ambil)
- Realtime list: tampilkan order online aktif + countdown durasi sejak diterima

**2. KDS (Kitchen Display System)**
- Route baru: `/pos/kds` — fullscreen, dark theme, font besar untuk dapur
- Login pakai akun staff (role baru: `kitchen` atau pakai existing branch user)
- Kolom Kanban 3: ANTRI / DIMASAK / SIAP
- Tiap card = 1 order (dine_in/take_away/online), tampil:
  - Nomor order + meja/platform + customer
  - List item + qty + catatan (highlight catatan kuning)
  - Timer sejak masuk (turn merah jika > 10 menit)
  - Tombol swipe/tap: "Mulai Masak", "Siap", "Sajikan"
- Per-item juga bisa di-tick selesai (untuk order banyak item)
- Sound notif saat order baru masuk
- Filter: semua / dine_in only / online only

**3. Sync Otomatis**
- Saat transaksi POS dibuat (apapun source) → auto buat KDS ticket
- Status KDS update realtime via Supabase Realtime channel
- Order online yang sudah "Siap" muncul notif balik di POS untuk handover ke kurir

### Database Migration

```
- pos_kds_tickets (id, transaction_id FK, branch_id, status enum [queued, cooking, ready, served, cancelled], 
  order_type, table_number, external_order_id, customer_name, started_at, ready_at, served_at, created_at)
- pos_kds_ticket_items (id, ticket_id FK, product_id, product_name, qty, notes, is_done bool, done_at)
- pos_transactions: tambah kolom kitchen_status enum [pending, preparing, ready, served]
- RLS: kitchen role + branch staff bisa read/update tickets di branchnya saja
- Trigger: auto-create kds_ticket + items saat pos_transaction baru dibuat (kecuali source=internal/test)
- Realtime: enable replica identity full + add table to publication supabase_realtime
```

### File Baru
- `src/components/pos/POSOnlineOrderPanel.tsx` — drawer/sheet di POS, list order online aktif
- `src/components/pos/POSOnlineOrderForm.tsx` — form input order online cepat
- `src/pages/pos/POSKitchen.tsx` — halaman KDS fullscreen kanban
- `src/components/pos/KDSTicketCard.tsx` — card per ticket di KDS
- `src/hooks/usePOSKDS.tsx` — fetch + realtime subscribe tickets
- `src/hooks/usePOSOnlineOrders.tsx` — fetch + realtime subscribe online orders

### File yang Disentuh
- `src/pages/pos/POSMain.tsx` — tombol buka panel online order + badge counter
- `src/components/pos/POSHeader.tsx` — tombol "KDS" navigasi ke /pos/kds
- `src/App.tsx` — route `/pos/kds`

### Asumsi
- KDS akses pakai akun POS yang sama (kasir/branch staff), tanpa role baru dulu — bisa di-extend nanti
- Order online dari panel manual input dulu (integrasi webhook GoFood/Grab Phase 9)
- Sound notif pakai HTML5 Audio + file di `src/lib/audio.ts` yang sudah ada
- Timer threshold merah = 10 menit (configurable nanti via branch setting)
- Jika order ditolak, status → `cancelled` (tetap tercatat untuk audit)

Setelah approve, saya jalankan migration → bangun KDS page → online order panel → integrasi sync.
