# Roadmap
- [x] KDS multi-station (Barista/Dapur), SLA, recall
- [x] FlowF&B marketing website + company onboarding signup
- [ ] Superadmin SaaS module toggles (per-tenant feature flags)
- [ ] Full multi-tenant provisioning (tenants table, tenant_id on data) — follows docs/saas-blueprint.md
- [x] Hero pakai foto model upload user (background dihapus)

## Mobile apps (Oct 2026)
- [x] POS kasir fit HP & tablet (bottom cart drawer, compact header)
- [x] Kasir, Rider, Customer installable on Android/iOS home screen (manifest + icons)
- [x] Rider & Customer instant taps + safe-area for phone notches
- [ ] Native store apps (Capacitor) — needs user to export to GitHub & build locally

## Customer App redesign (Okt 2026) — Zeger brand, 3D, Apple-glass
### Fondasi
- [ ] Load webfont (Plus Jakarta Sans + Sora) — saat ini font-family dirujuk tapi tidak pernah dimuat
- [ ] Design layer `cx-*` di index.css: raised red button, glass select, 3D depth, ticket, coin, skala tipografi
- [ ] Aset 3D (cup iced/hot, botol, koin, scooter, paper bag, gift, crown)

### Layar
- [ ] CustomerHome — hero banner dari Promo Banner Management + fallback, kartu poin 3D, channel picker
- [ ] CustomerMenu — grid clean, kategori pill glass, placeholder gelas 3D
- [ ] CustomerProductDetail — opsi glass + animasi tekan, potensi poin, sticky footer
- [ ] CustomerVouchers — kartu tiket scalloped, klaim + kode promo berfungsi
- [ ] CustomerLoyalty — warna Zeger (bukan ungu), reward dari tabel loyalty_rewards
- [ ] CustomerPromoReward — data nyata (promo_banners + loyalty_rewards), bukan mock
- [ ] CustomerSubscription — polish MyZeger Plan
- [ ] CustomerOutletList — perbaiki bug pilih outlet + tampilan kartu
- [ ] CustomerCartNew + CustomerCheckout — outlet asli (hapus "SULAWESI SURABAYA"), banner ungu dihapus
- [ ] CustomerProfile + CustomerOrders — konsisten brand
- [ ] BottomNavigation — floating glass dock

### Perbaikan fungsi
- [ ] Nomor Zeger Care → +62 813-3180-488
- [ ] Voucher demo kedaluwarsa (RLS menyembunyikan voucher lewat tanggal) → perpanjang + UI tahan data kosong
- [ ] RLS customer_subscriptions pakai auth.uid() padahal app kirim customer_users.id → langganan selalu gagal
- [ ] Banner `/promo-banners/*.png` broken → fallback gambar
- [ ] CustomerOutletList kirim string id, CustomerApp baca object → outlet_id kosong saat checkout
