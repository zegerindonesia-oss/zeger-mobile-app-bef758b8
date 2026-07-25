# Zeger Coffee — Release Regression Checklist

Run this checklist on **staging** before every production release. Record tester name, timestamp, DB before/after where relevant, and screenshot evidence. If any item fails, **do not publish**.

## Environment prep
- [ ] Deployed build hash: __________
- [ ] Staging Supabase project used: __________
- [ ] Test accounts available for every role listed below.
- [ ] Xendit **sandbox** keys active (never production keys on staging).

---

## 1. Login by role
- [ ] `ho_admin` → lands on admin dashboard.
- [ ] `finance` → `/finance` accessible.
- [ ] `branch_manager` → branch dashboard.
- [ ] `sb_branch_manager` → SB branch dashboard.
- [ ] `bh_report` → `/bh-report-dashboard`.
- [ ] `bh_kasir` / `sb_kasir` / `2_Hub_Kasir` / `3_SB_Kasir` → `/pos`.
- [ ] `rider` / `bh_rider` / `sb_rider` → `/mobile-seller`.
- [ ] `customer` → `/customer-app`.
- [ ] Invalid credentials → error toast, no redirect.
- [ ] Inactive user (`is_active = false`) cannot sign in.

## 2. Rider stock receive
- [ ] Manager creates transfer → rider sees blocking confirmation screen.
- [ ] Sales tab is locked until all items confirmed.
- [ ] After confirm, `stock_movements` `transfer_in` rows exist; rider `inventory` incremented by exact qty.
- [ ] Attempted second transfer while shift open → blocked with clear message.

## 3. Rider sales input
- [ ] Add items via card tap and via `+` button.
- [ ] Tunai checkout succeeds; receipt shown.
- [ ] QRIS checkout succeeds **without** proof photo.
- [ ] QRIS checkout with proof photo attaches upload.
- [ ] Transfer method succeeds.
- [ ] All new rows have `is_voided = false`.

## 4. Rider stock decrease
- [ ] After sale, rider `inventory.stock_quantity` decreased by exact qty sold.
- [ ] `stock_movements` sale row created with correct rider + product.
- [ ] No decrement occurs for a failed/cancelled sale.

## 5. Back office report update
- [ ] New rider sale visible within 1 minute in Admin dashboard, `RiderPerformance`, `TransactionsEnhanced`, `StockCardRider`, `CashDepositHistory`.
- [ ] Voided sale disappears from all totals.
- [ ] Asia/Jakarta date grouping correct at 00:00 WIB boundary.

## 6. POS open shift
- [ ] Kasir with no active shift sees Open Shift modal.
- [ ] Opening cash saved in `pos_shifts`.
- [ ] Reopening blocked while shift active.

## 7. POS sale
- [ ] Cart with regular item, bundle, custom item, promo, voucher completes.
- [ ] `pos_transactions` + `pos_transaction_items` inserted with correct totals.
- [ ] Split-bill produces correct per-payment totals summing to grand total.
- [ ] KDS ticket appears on `/pos-kitchen` in realtime.

## 8. POS inventory decrease
- [ ] Branch-level `inventory` (`rider_id IS NULL`) decreases by exact qty per non-custom item.
- [ ] Custom item does NOT touch inventory.
- [ ] Voucher used gets `used_at` set.

## 9. Customer order
- [ ] Browse → add to cart → checkout → address → payment method selection works.
- [ ] `customer_orders` row created with `status = pending`.
- [ ] Order visible in customer "My Orders".

## 10. Xendit payment
- [ ] `create-xendit-invoice` returns valid invoice URL.
- [ ] Sandbox pay flips `customer_orders.status` to `paid`.
- [ ] `financial_transactions` row created once per order.
- [ ] Duplicate webhook does NOT double-insert.
- [ ] `send-order-request` fired to nearby riders after paid.

## 11. Void transaction
- [ ] Manager submits void via `process-void-transaction`.
- [ ] `is_voided = true` set; dashboards immediately exclude it.
- [ ] Stock reversed per designed rule.
- [ ] Void request row created with approver name/time.

## 12. Cash deposit
- [ ] End of shift creates `cash_deposit_verifications` row.
- [ ] Formula holds: `Cash Sales − Op Expenses` (including `Beban Operasional Rider` category).
- [ ] Verifier stages (Outlet, Finance) transition correctly and persist.
- [ ] Notes typed by manager appear in `finance/RiderIncome` "Keterangan" column for the matching date.

---

## Do Not Publish Until These Pass

**All of the following MUST be green.** A single failure blocks release.

- [ ] §1 Login by role — every listed role signs in and lands correctly.
- [ ] §2 Rider stock receive — blocking screen works, inventory increments correctly.
- [ ] §3 Rider sales input — all three payment methods succeed.
- [ ] §4 Rider stock decrease — exact qty decrement verified in DB.
- [ ] §5 Back office report update — sales + voids reflect in dashboards.
- [ ] §6 POS open shift — shift lifecycle intact.
- [ ] §7 POS sale — cart/promo/voucher/split-bill produce correct totals.
- [ ] §8 POS inventory decrease — branch inventory decrements correctly; custom items don't.
- [ ] §9 Customer order — order created with `pending` status.
- [ ] §10 Xendit payment — webhook flips status, no double-insert.
- [ ] §11 Void transaction — void excludes from totals + reverses stock.
- [ ] §12 Cash deposit — formula and verifier stages correct.

**Sign-off**
- QA lead: __________  Date/time: __________
- Ops sign-off (Zeger foreman): __________  Date/time: __________
- Release manager approves publish: __________  Date/time: __________

If any box above is unchecked or failed: **stop, file the bug, revert or hotfix on staging, and re-run this checklist. Never publish a partial pass.**