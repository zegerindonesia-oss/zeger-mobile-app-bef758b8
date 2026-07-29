
# Customer App — Full Wiring & Backoffice Control

Goal: setiap modul di Customer App (Home, Loyalty/Zeger Point, Subscription, Voucher Reward, Promo, Referral, Care, Notifications, Profile) bisa **diatur dari back office** (App Management + CRM) dan **berfungsi real** — bukan mock/placeholder.

Sumber data: `products` (menu), `promo_banners` (banner), `loyalty_tiers` + `loyalty_rewards` + `customer_loyalty` (poin & reward), `customer_vouchers` + `customer_user_vouchers` (voucher), `app_settings` (feature toggle & konfigurasi generik). Tambah tabel baru hanya untuk Subscription & Referral.

---

## Phase A — Backoffice: pusat kendali Customer App

Perluas menu **Settings → App Management** menjadi satu control panel Customer App. Tidak menghapus menu lama; tambahkan sub-halaman dan lengkapi yang setengah jadi.

1. **App Settings (global)** — halaman baru `/settings/app-management/customer-app`
   - Baca/tulis `app_settings` (sudah ada). Kunci-kunci yang dipakai:
     - `customer_home.sections` — toggle & urutan section: Membership Card, Voucher/Referral, Big Order, Zeger Care, Promo Aktif, Rider Nearby.
     - `customer_features` — toggle modul: `loyalty`, `subscription`, `vouchers`, `promo_reward`, `referral`, `care`.
     - `care.whatsapp_number`, `care.faq_url`, `referral.reward_points`, `referral.code_prefix`.
   - UI: tabs "Layout", "Features", "Contact & Support".

2. **Banner Management** (sudah ada `PromoBannerManagement`) — tambah placement pilihan: `carousel`, `big_order`, `zeger_care`, `promo_reward_top`. Sudah ada `placement`; tinggal pastikan semua placement dipakai konsumen.

3. **Loyalty Settings** (sudah ada `LoyaltyManagement`) — pastikan CRUD `loyalty_tiers` & `loyalty_rewards` lengkap: nama tier, min points, benefits, warna; reward: nama, image (ImageUpload), poin, stok, valid range.

4. **Voucher/Promo Management** — buka CRUD `customer_vouchers` di sub-halaman baru: kode, deskripsi, tipe diskon, nilai, min order, valid range, is_active, image banner (opsional untuk tampilan di Promo Reward).

5. **Subscription Plans** (baru) — CRUD paket langganan (mis. "10 kopi/bulan").
   - Migration: `subscription_plans` (name, description, price, quota, period_days, image_url, is_active) + `customer_subscriptions` (user_id, plan_id, status, starts_at, ends_at, remaining_quota). GRANT + RLS: authenticated read plans; customer read own subscription; service_role all.

6. **Referral** (baru) — CRUD hadiah referral via `app_settings`. Tambah tabel `customer_referrals` (referrer_id, referee_id, status, reward_points, created_at) + RPC `redeem_referral(code)`.

7. **CRM Management** (sudah ada) — tambah tab "Notifikasi Broadcast" (kirim pesan in-app ke customer, simpan ke tabel `customer_notifications`). Tabel baru: `customer_notifications` (user_id nullable=broadcast, title, body, link, read_at).

---

## Phase B — Customer App: sambungkan & aktifkan modul

Semua komponen konsumsi `app_settings` via hook baru `useCustomerAppConfig()` supaya toggle backoffice langsung berefek.

1. **Home (`CustomerHome.tsx`)**
   - Section muncul/hilang sesuai `customer_home.sections`.
   - Kartu Voucher menampilkan jumlah voucher terklaim (tidak lagi hanya voucher aktif global).
   - Kartu Subscription menampilkan status paket aktif dari `customer_subscriptions`.
   - Notification bell → buka daftar `customer_notifications` (view baru `notifications`).

2. **Loyalty / Zeger Point (`CustomerLoyalty.tsx`)**
   - Ganti tier hardcoded dengan `loyalty_tiers`; tier badge otomatis dari `points_balance`.
   - Ganti list reward hardcoded dengan `loyalty_rewards` (image dari storage).
   - Tombol "Tukar" → RPC `redeem_reward(reward_id)` yang decrement poin & buat entry di `customer_points_history` dan (jika reward voucher) auto-claim `customer_user_vouchers`.
   - "History" → tampilkan `customer_points_history`.

3. **Voucher (`CustomerVouchers.tsx`)** — sudah fetch dari DB; tambah aksi "Klaim" untuk voucher publik → insert ke `customer_user_vouchers`; hapus mock kalau ada.

4. **Promo Reward (`CustomerPromoReward.tsx`)** — hapus mock, tarik dari `promo_banners` (placement `promo_reward_top`) untuk header, `loyalty_rewards` untuk reward list dengan filter kategori dari `products.category`.

5. **Subscription (view baru)** — daftar `subscription_plans`, tombol "Berlangganan" → checkout (reuse `CustomerCheckout`) dengan payment method QRIS/Transfer; setelah paid buat row di `customer_subscriptions`.

6. **Referral (view baru)** — tampilkan kode referral (`ZG-<userid6>`), tombol Share (Web Share API), input redeem kode.

7. **Zeger Care (view baru)** — buka WhatsApp CS pakai `care.whatsapp_number`, list FAQ dari `care.faq_url` atau `app_settings.care.faq_items` (JSON).

8. **Notifications (view baru)** — list `customer_notifications`, tandai baca.

9. **Menu produk** — pastikan Customer selalu baca dari `products` (master). Jika ada mock, hapus.

10. **Routing** — tambah `View` baru di `CustomerApp.tsx`: `subscription`, `referral`, `care`, `notifications`. Sambungkan onClick di Home & Profile.

---

## Phase C — Database & keamanan

Satu migration meliputi:
- `subscription_plans`, `customer_subscriptions`, `customer_referrals`, `customer_notifications` (dengan GRANT + RLS).
- RPC `redeem_reward(reward_id uuid)`, `claim_voucher(voucher_id uuid)`, `redeem_referral(code text)` (SECURITY DEFINER, search_path=public).
- Seed default `app_settings` untuk `customer_home.sections`, `customer_features`, `care.*`, `referral.*`.

RLS pola: customer hanya melihat baris miliknya (`user_id = auth.uid()`); backoffice roles (level 1/2/3 manager) full CRUD via `has_role`.

---

## Detail teknis singkat

- Hook baru: `src/hooks/useCustomerAppConfig.ts` — cache `app_settings` di React Query, expose `sections`, `features`, `care`, `referral`.
- Komponen baru: `src/components/customer/CustomerSubscription.tsx`, `CustomerReferral.tsx`, `CustomerCare.tsx`, `CustomerNotifications.tsx`.
- Halaman baru backoffice: `src/pages/settings/CustomerAppSettings.tsx`, `SubscriptionPlans.tsx`, `VoucherManagement.tsx`, dan tab broadcast di `CRMManagement.tsx`.
- Timezone: semua tanggal pakai helper Jakarta (mengikuti core memory).
- Gambar upload pakai `ImageUpload` yang sudah ada.

---

## Urutan eksekusi (bisa dipecah per commit)
1. Migration DB + app_settings seed.
2. Backoffice: CustomerAppSettings, VoucherManagement, SubscriptionPlans, CRM broadcast.
3. Hook `useCustomerAppConfig` + refactor Home/Loyalty pakai config.
4. View baru Customer (Subscription, Referral, Care, Notifications) + routing.
5. Aksi klaim voucher & tukar reward (RPC).
6. Smoke test alur end-to-end.

Cakupan besar — kalau kamu setuju, aku eksekusi bertahap mulai step 1 setelah plan di-approve. Ada modul yang mau di-skip atau diprioritaskan lebih dulu?
