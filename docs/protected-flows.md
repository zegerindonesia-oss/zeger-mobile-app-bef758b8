# Zeger Coffee — Protected Production Flows

These flows are load-bearing for daily operations. Any PR touching them must (a) go through the release checklist in `docs/release-checklist.md` on staging, (b) be reviewed by the release manager, and (c) ship behind a feature flag or in a maintenance window when reasonable.

"Touching" means editing the listed files, tables, or edge functions — including seemingly cosmetic edits, because these files often mix UI and business logic.

---

## PF-01. Branch → Rider Stock Transfer

**Purpose.** Move stock from Branch Hub inventory to a specific rider's inventory under the single-cycle rule.

**Entry points.** `src/pages/Inventory.tsx` (Riwayat Transfer Stok tab), `src/components/stock/StockTransfer.tsx`.
**Tables.** `stock_movements`, `inventory`, `shift_management`, `daily_reports`, `cash_deposit_verifications` (read for guard).
**Rules that must not change without regression.**
- 1-cycle guard: block transfer when rider has active shift, pending unconfirmed transfer, remaining stock, or unverified report.
- Reference id groups a single transfer batch.
- Asia/Jakarta timestamp used for `created_at` display.

## PF-02. Rider Stock Confirmation

**Purpose.** Rider confirms all incoming stock before the sales tab unlocks.

**Entry points.** `src/components/mobile/MobileStockConfirmation*.tsx`, `src/components/mobile/MobileStockManagement.tsx` (Terima tab), `src/components/mobile/MobileSellerEnhanced.tsx` (blocking gate).
**Tables.** `stock_movements` (`transfer_in`), `inventory` (rider-scoped).
**Rules.** No partial confirmation — sales tab remains blocked until every pending item is confirmed.

## PF-03. Rider Sales

**Purpose.** Rider records a sale, decrements stock, and creates the transaction record.

**Entry points.** `src/components/mobile/MobileSellerEnhanced.tsx`.
**Tables.** `transactions`, `transaction_items`, `inventory`, `stock_movements`.
**Rules.**
- Every sale row has `is_voided = false`.
- Payment methods: `cash`, `qris`, `transfer`. QRIS proof photo is **optional**.
- Card tap adds an item (accessibility for hidden `+` on small screens).

## PF-04. Inventory Decrement (POS + Rider)

**Purpose.** Reduce stock atomically on sale.

**Entry points.** `POSMain.decrementInventory`, rider sale path.
**Tables.** `inventory`, `stock_movements`.
**Rules.**
- Rider decrement targets `rider_id = current rider`.
- POS decrement targets `rider_id IS NULL` (branch-level).
- Custom POS items do NOT touch inventory.

## PF-05. Cash Deposit

**Purpose.** Reconcile end-of-shift cash and route it through verification.

**Entry points.** `src/components/mobile/MobileCashDeposit.tsx`, `src/pages/analytics/CashDeposit.tsx`, `src/components/inventory/EnhancedShiftReport.tsx`.
**Tables.** `cash_deposit_verifications`, `daily_operational_expenses`, `transactions` (read).
**Rules.**
- Formula: `Cash Sales − Op Expenses`.
- Multi-stage verifiers (Outlet, Finance) with hardcoded staff names (until `tenant_settings`).
- `Beban Operasional Rider` category is included in the cash-deposit view.

## PF-06. Sales Reports

**Purpose.** Aggregate transactions for dashboards and finance.

**Entry points.** Admin dashboards, `TransactionsEnhanced`, `RiderPerformance`, `StockCardRider`, `finance/*`, `analytics/*`.
**Tables.** `transactions`, `transaction_items`, `pos_transactions`, `pos_transaction_items`, `customer_orders`.
**Rules.**
- Always `.eq('is_voided', false)` on sales queries.
- Always `.range()`-paginate when the dataset can exceed 1,000 rows.
- Always group by Asia/Jakarta local date; never `toISOString()`.

## PF-07. POS Sale

**Purpose.** In-store payment and receipt.

**Entry points.** `src/pages/pos/POSMain.tsx` (`handlePay`), `usePOSCart`, `usePOSPromo`, `POSSplitBillDialog`.
**Tables.** `pos_transactions`, `pos_transaction_items`, `pos_shifts`, `pos_vouchers`, `pos_kds_tickets`, `pos_kds_ticket_items`, `inventory`.
**Rules.** Shift must be open. Vouchers are marked `used_at` on success. KDS ticket must be emitted on food orders.

## PF-08. Customer Order

**Purpose.** Customer places an order and enters the payment funnel.

**Entry points.** `src/pages/CustomerApp.tsx`, `src/components/customer/CustomerCartNew.tsx`, `src/components/customer/CustomerCheckout.tsx`.
**Tables.** `customer_orders`, `customer_order_items`, `customer_addresses`, `order_status_history`.
**Rules.** Order created with `status = 'pending'`; recognized as revenue only after Xendit `paid` webhook.

## PF-09. Xendit Payment

**Purpose.** External payment collection and reconciliation.

**Entry points.** `supabase/functions/create-xendit-invoice/index.ts`, `supabase/functions/xendit-webhook/index.ts`.
**Tables.** `customer_orders`, `financial_transactions`.
**Rules.**
- Server recomputes amount from DB — never trust client amount.
- Webhook must verify signature and be idempotent by `provider_event_id`.
- On `paid`, trigger `send-order-request`.

## PF-10. Rider Dispatch

**Purpose.** Route a paid customer order to the nearest available rider.

**Entry points.** `send-order-request`, `rider-respond-order`, `get-nearby-riders`, `update-rider-location-live`.
**Tables.** `rider_locations`, `customer_orders`, `order_status_history`, `push_tokens`.
**Rules.** Rate limits and input validation on public edge functions; no PII in logs.

## PF-11. Auth and Roles

**Purpose.** Authenticate users and gate access to routes/data.

**Entry points.** `useAuth`, `RoleBasedRoute`, `usePermissions`, `has_role()` (DB function).
**Tables.** `profiles`, `user_role_permissions`, `user_module_permissions`, `user_specific_permissions`.
**Rules.**
- Roles live in `user_role_permissions` — never on `profiles`.
- `is_active = false` blocks sign-in and role resolution.
- Every new page must be added to `RoleBasedRoute` with an explicit allowlist covering both legacy and numbered role names.

---

## Change-control shortlist

Before merging a PR that touches any file listed above:
1. Confirm the PR description names the affected protected flow(s).
2. Attach staging results from `docs/release-checklist.md` for those sections.
3. Confirm no DB migration is silently included; migrations require their own review.
4. Confirm no `service_role` key is being sent to the client.
5. Confirm the change respects Asia/Jakarta timezone rules and voided-row exclusion.
6. Release manager signs off before publish.