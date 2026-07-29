
# Zeger Coffee — Customer App Improvement Plan

Goal: turn the Customer App into a loyalty-driven storefront covering all 3 Zeger channels (Branch, On The Street, On The Wheels) without touching Rider App sales, Stock Transfer, POS, Back Office reports, or Xendit.

---

## 1. Current Customer App Architecture

**Entry / Route**
- `src/pages/CustomerApp.tsx` — single-page shell rendering sub-views via internal `view` state (no react-router sub-routes).
- Route mounted at `/customer-app` (see `App.tsx`).

**Pages / Views (in `src/components/customer/`)**
- `CustomerAuth.tsx` — login/register
- `CustomerHome.tsx` — current home (member card, 2 buttons: Branch / On The Wheels)
- `CustomerMenu.tsx`, `CustomerProductDetail.tsx`
- `CustomerCart.tsx`, `CustomerCartNew.tsx`, `CustomerCheckout.tsx`, `CustomerPaymentMethod.tsx`
- `CustomerOrderWaiting.tsx`, `CustomerOrderTracking.tsx`, `CustomerOrderSuccess.tsx`, `CustomerOrders.tsx`, `OrderDetail.tsx`
- `CustomerOutletList.tsx` — branch/outlet list
- `CustomerMap.tsx` — nearby riders map
- `CustomerLoyalty.tsx`, `CustomerVouchers.tsx`, `CustomerPromoReward.tsx`
- `CustomerProfile.tsx`
- `PromoBannerCarousel.tsx` — hero banner (already reads Back Office banners)
- `BottomNavigation.tsx`

**Hooks / Utilities**
- `useAuth`, `usePOSCart` (POS side), toast/mobile hooks
- Supabase client at `src/integrations/supabase/client.ts`

**Supabase tables used (customer side)**
- `customer_users`, `customer_orders`, `customer_order_items`
- `customer_vouchers`, `customer_loyalty_*` (loyalty), `promo_banners`
- `products`, `branches`, `profiles` (riders), `rider_locations`, `rider_checkpoints`
- `shift_management` (used to derive active riders)

**Edge Functions relevant**
- `get-nearby-riders` — nearby rider lookup
- `send-order-request`, `rider-respond-order` — customer→rider online order flow
- `create-xendit-invoice`, `xendit-webhook`, `update-transaction-payment` — payments (do NOT touch)
- `update-rider-location-live` — rider GPS updates (read-only from customer)

**Back Office settings already available**
- `PromoBannerManagement`, `PromoManagement`, `LoyaltyManagement`, `CRMManagement` (settings pages exist in `src/pages/settings/`)

---

## 2. Current Customer App Flow

```text
Auth → Home
        ├─ Zeger Branch button → CustomerOutletList → CustomerMenu → Cart → Checkout → Payment → OrderWaiting → OrderTracking → OrderSuccess
        ├─ On The Wheels button → CustomerMap (nearby riders) → (no rider-detail page) → order path shared with branch
        ├─ Vouchers → CustomerVouchers
        ├─ Loyalty → CustomerLoyalty
        ├─ Orders → CustomerOrders → OrderDetail
        └─ Profile → CustomerProfile
```

Gaps in the flow: no explicit "3 channel" selector, no On The Street channel, no rider-detail page, no request-rider CTA wired to `send-order-request` from the map, no subscription screen.

---

## 3. Gap Analysis

| Area | Status | Notes |
|---|---|---|
| 3 service channel cards on Home | Partial | Only Branch + On The Wheels shown; On The Street missing |
| On The Wheels map + list | Exists | `CustomerMap.tsx` + `get-nearby-riders`; needs richer cards (checkpoint text, stock preview, actions) |
| Rider checkpoint text ("Mangkal depan …") | Partial | Data in `rider_checkpoints` / profile, not surfaced on customer card |
| Rider available stock preview | Missing on map card | Available inside menu after selecting rider; needs summary card |
| WhatsApp rider button | Missing | Requires rider `phone` from `profiles` |
| Direction (open Maps) | Partial | `RiderTracking` has it; not exposed on customer map card |
| Request rider to come | Missing wiring | `send-order-request` exists but no customer CTA |
| Branch ordering | Exists | Keep as-is |
| Street channel | Missing | No table for street points; needs placeholder |
| Loyalty / Vouchers / Promo | Exists | Needs Home summary widgets (partial today) |
| CRM segmentation / campaigns | Partial | Back Office CRM exists; customer-side surfaces missing |
| Subscription / Membership | Missing | Home entry-point only, no flow |
| Back Office banners | Exists | `PromoBannerCarousel` renders them |
| Big-order / event banners | Missing | No dedicated banner type |
| Push notifications | Missing | Not wired |

---

## 4. Recommended Information Architecture

Bottom nav (5 items, center CTA):

```text
[ Home ] [ Menu ] [ ● Zeger ] [ Order ] [ Account ]
```

Subflows:
- **Home** → 3 service cards + hero banner + loyalty/voucher/subscription strip + recent orders + nearby-rider shortcut + recommended products.
- **Zeger Branch** → Outlet list → Branch menu → Cart → Checkout (existing).
- **Zeger On The Street** → Street points list (placeholder if empty) → Point menu → Cart.
- **Zeger On The Wheels** → Nearby rider map + list → Rider detail (name, checkpoint text, distance, WA/Direction/Call/Request/View Stock) → Rider stock menu → Cart.
- **Center Button** → Quick service selector modal (3 cards).
- **Order** → Ongoing / History tabs (existing `CustomerOrders`).
- **Account** → Profile, Loyalty, Vouchers, Subscription, Support, Privacy, Logout.

---

## 5. UI/UX Direction

Inspired by uploaded screenshots (Sejuta Jiwa style):
- Large red hero on Home with rotating banners.
- Rounded white card overlapping hero (member greeting).
- 3 equal service-channel cards with icons (Store, Bike, Truck) — red primary + subtle shadow.
- On The Wheels: full-height map with draggable bottom sheet listing rider cards (avatar, name, checkpoint text, distance chip, "Lihat Stok" red pill).
- Rider detail: map header with pin, floating card (name/address/distance), WA (green circle) + Direction (red pill) + Call + Request buttons, then "Stok Rider" product list with `Stok < 5` / `Stok Habis` badges.
- Bottom nav with center circular Zeger button (brand mark), inactive icons gray, active red.
- Colors: `#EA2831` primary, `#0F1B3D` navy accents, `#F8F6F6` background. Font: existing.
- Empty states: friendly illustration + red primary CTA (see Order History screenshot).

Design tokens already exist in `index.css`; no new palette needed.

---

## 6. Safe Implementation Phases

**Phase 1 — Home redesign (UI only, existing data)**
- Rework `CustomerHome.tsx`: 3 service cards (Branch / Street / Wheels), keep loyalty/voucher/subscription strip, recent orders, banner carousel.
- Add Street card that routes to a new "Coming Soon" view (no DB).
- No schema/API changes.

**Phase 2 — On The Wheels map + list improvements**
- Enhance `CustomerMap.tsx` bottom sheet cards with checkpoint text (from `rider_checkpoints` — read only), distance, avatar.
- Reuse existing `get-nearby-riders` edge function; if checkpoint not returned, add read-only join client-side.

**Phase 3 — Rider Detail page**
- New view `CustomerRiderDetail` (component only) reachable from map card.
- Shows: name, checkpoint address, distance, WA/Direction/Call/View Stock buttons.
- Stock list derived from existing rider inventory query used by menu.

**Phase 4 — Request Rider integration**
- Wire "Request rider to come" CTA on Rider Detail to existing `send-order-request` edge function.
- No Rider App changes; it already listens for `rider-respond-order`.

**Phase 5 — Branch & Street ordering polish**
- Branch: keep flow, refresh outlet list UI.
- Street: introduce (optional, future) `street_points` table — planned, not built in this phase; UI shows placeholder.

**Phase 6 — Loyalty / CRM / Voucher / Subscription surfaces**
- Home widgets + Account entries; connect to existing loyalty/voucher tables.
- Subscription surfaces stubbed until Back Office packages exist.

**Phase 7 — Back Office campaign management**
- Extend `PromoBannerManagement` with banner "type" (promo / big-order / event) — Back Office only.
- Add CRM campaign scheduler UI on top of existing CRM tables.

---

## 7. Database Impact per Phase

| Phase | DB change | Tables (read-only unless noted) |
|---|---|---|
| 1 | None | `promo_banners`, `customer_vouchers`, `customer_orders`, `customer_users` |
| 2 | None | `profiles`, `rider_locations`, `rider_checkpoints`, `shift_management` |
| 3 | None | above + rider inventory views |
| 4 | None | `send-order-request` uses existing tables |
| 5 | Optional future: `street_points` (+RLS public read) | `branches`, `products` |
| 6 | Optional future: `subscription_packages`, `customer_subscriptions` | loyalty/voucher tables |
| 7 | Optional future: banner `type` column, `crm_campaigns` | Back Office only |

All future tables must follow project GRANT + RLS rules.

---

## 8. Risk Analysis

- **Rider App**: none in Phase 1–3 (read-only). Phase 4 uses existing edge function — verify payload matches current Rider App listener.
- **Customer App**: risk of breaking checkout if we touch cart; scope Home/Discovery UI only in early phases.
- **Back Office**: untouched until Phase 7.
- **Xendit**: not touched anywhere.
- **rider_locations privacy**: expose only coarse lat/lng + checkpoint address for active-shift riders (already filtered by `get-nearby-riders`). Do not expose phone unless rider opted in — add `whatsapp_opt_in` gate in Phase 3 (client-side check only in early phases).
- **Stock visibility**: only show summary/qty for current rider; do not leak cross-branch inventory.
- **Online order notifications**: use existing edge function contract; no schema drift.

---

## 9. First Safe Build Task

**Phase 1 — Customer Home redesign** with 3 service cards using only existing data.
- No migration, no Rider App changes, no payment changes, no stock transfer changes.
- Pure `CustomerHome.tsx` rework + a new "Zeger On The Street — Coming Soon" view registered in `CustomerApp.tsx`.

---

## 10. First Build Prompt (copy-paste)

> Redesign the Customer App Home screen in `src/components/customer/CustomerHome.tsx` and register a new "street" view in `src/pages/CustomerApp.tsx`. Do NOT change Rider App, POS, Back Office reports, Xendit, Stock Transfer, or any DB schema.
>
> Requirements:
> 1. Keep `PromoBannerCarousel` hero.
> 2. Replace the current 2-button Order block with **3 service cards**: "Zeger Branch" (Store icon → `onNavigate('outlets')`), "Zeger On The Street" (Truck icon → `onNavigate('street')`), "Zeger On The Wheels" (Bike icon → `onNavigate('map')`). Use `#EA2831` primary, rounded-2xl, soft shadow, equal sizing, mobile-first grid (1 col on xs, 3 col on sm+).
> 3. Keep the existing loyalty / points / subscription strip and voucher+referral cards.
> 4. Keep "Pesanan Terakhir" and "Promo Aktif" sections.
> 5. Add a "Nearby Rider" shortcut card under the 3 service cards that navigates to `map`.
> 6. Add a new component `CustomerStreetComingSoon.tsx` with a friendly empty state ("Zeger On The Street segera hadir") and a red CTA "Lihat Rider Terdekat" that calls `onNavigate('map')`. Register `case 'street'` in `CustomerApp.tsx` to render it.
> 7. Use only existing design tokens; do not hardcode new colors outside `#EA2831` already in use.
> 8. No new tables, no new edge functions, no changes to `customer_orders`, `products`, or rider tables.
>
> Verify: build passes, `/customer-app` renders, tapping each of the 3 cards navigates correctly, Street card shows placeholder view, no console errors.
