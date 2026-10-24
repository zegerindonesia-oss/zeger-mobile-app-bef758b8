# Roadmap
- [x] Back Office Customer App Settings: urutan kategori tersimpan dan diterapkan ke filter serta bagian menu, termasuk tamu QR.
- [ ] Uji simpan urutan kategori dengan akun admin asli — sesi terautentikasi tidak tersedia pada Supabase eksternal.
- [x] QR meja langsung membuka menu tanpa login; checkout nama + nomor HP, bayar di kasir; bill dan tiket dapur diuji tanpa meninggalkan data uji.
- [ ] Login pelanggan nomor HP + OTP — provider SMS Supabase belum aktif.
- [x] KDS multi-station (Barista/Dapur), SLA, recall
- [x] FlowF&B marketing website + company onboarding signup
- [ ] Superadmin SaaS module toggles (per-tenant feature flags)
- [ ] Full multi-tenant provisioning (tenants table, tenant_id on data) — follows docs/saas-blueprint.md
- [x] Hero pakai foto model upload user (background dihapus)

## Integrasi workspace baru (Okt 2026)
- [x] Google Maps Platform terhubung (Managed by Lovable) — browser key diverifikasi lewat get-maps-key
- [x] Supabase tetap aktif (87 tabel terbaca) — Edge Function get-maps-key di-deploy ulang
- [ ] Maps di domain custom flowfnb.flowsstack.com — perlu API key milik sendiri (managed key hanya untuk *.lovable.app)

## Mobile apps (Oct 2026)
- [x] POS kasir fit HP & tablet (bottom cart drawer, compact header)
- [x] Kasir, Rider, Customer installable on Android/iOS home screen (manifest + icons)
- [x] Rider & Customer instant taps + safe-area for phone notches
- [ ] Native store apps (Capacitor) — needs user to export to GitHub & build locally

## Customer App redesign (Okt 2026) — Zeger brand, 3D, Apple-glass
### Fondasi
- [x] Webfont Plus Jakarta Sans + Sora dimuat
- [x] Design layer `cx-*` di index.css (raised red button, glass select, 3D depth, ticket, coin, skala tipografi)
- [x] Aset 3D (cup iced/hot, botol, koin, scooter, paper bag, gift, crown)

### Layar
- [x] CustomerHome — hero banner dari Promo Banner Management + fallback, kartu poin 3D, channel picker
- [x] CustomerMenu — grid clean, kategori pill glass, placeholder gelas 3D
- [x] CustomerProductDetail — opsi glass + animasi tekan, potensi poin, sticky footer
- [x] CustomerVouchers — kartu tiket scalloped, klaim + kode promo
- [x] CustomerLoyalty — warna Zeger, reward dari loyalty_rewards
- [x] CustomerPromoReward — data nyata (promo_banners + loyalty_rewards)
- [x] CustomerSubscription — MyZeger Plan
- [x] CustomerOutletList — pilih outlet + jarak dikirim ke checkout
- [x] CustomerCartNew + CustomerCheckout — outlet asli, voucher, poin, ongkir
- [x] CustomerProfile, CustomerCare, CustomerNotifications, CustomerReferral
- [x] BottomNavigation — floating glass dock
- [x] CustomerAuth — layar masuk/daftar brand Zeger
- [x] CustomerOrders — daftar pesanan gaya baru
- [x] CustomerPaymentMethod — pilih pembayaran (glass + raised)
- [x] CustomerOrderWaiting / CustomerOrderSuccess — animasi 3D
- [x] CustomerOrderTracking + OrderDetail — peta & struk
- [x] CustomerMap (On The Wheels) — panggil rider via WhatsApp
- [x] CustomerStreetComingSoon

### Perbaikan fungsi
- [x] Nomor Zeger Care → +62 813-3180-488
- [x] Voucher kedaluwarsa diperpanjang + RPC claim_voucher idempoten
- [x] Banner promo kedaluwarsa diperpanjang; fallback gambar bila kosong
- [x] Outlet terpilih (id + jarak) terbawa ke checkout
- [x] Ongkir / diskon ongkir / biaya kemasan dapat diatur di Back Office (Customer App Settings → Ongkir & Biaya)
- [ ] Harga & benefit paket MyZeger Plan masih contoh — menunggu harga final dari owner
- [ ] 114 temuan linter Supabase lama (SECURITY DEFINER dll) — tunggu persetujuan owner
- [x] POS 3 printer (Kasir/Kitchen/Label) + Bluetooth langsung ESC/POS & TSPL
- [ ] Pisah 3 APK Android (POS, Rider, Customer) — lanjutan
- [ ] Uji cetak fisik Bluetooth XP-420B di tablet

## Printer stiker (Okt 2026)
- [x] POS bisa pakai printer Bluetooth yang sudah dipairing di tablet (Bluetooth Classic) — perlu build ulang APK
- [x] Filter printer stiker/dapur per Brand (selain kategori & menu)
- [x] QR meja smart hybrid (scan → web order / app), cetak QR, status meja di POS
- [x] Back Office: Manajemen Meja & QR per cabang, pengaturan bersama POS dan cetak QR.
- [ ] Uji tambah/edit meja dan sinkron POS dengan akun asli — koneksi Supabase eksternal tidak menyediakan sesi uji terautentikasi.
