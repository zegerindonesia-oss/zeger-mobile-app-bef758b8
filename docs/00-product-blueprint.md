# Zeger Coffee — Product Blueprint

**Version:** 1.0  
**Status:** Canonical reference — read-only product direction. No runtime changes implied.  
**Purpose:** Describe what Zeger Coffee is today, what it is becoming, and the rules for evolving it without breaking production operations.

---

## 1. Product Vision

Zeger Coffee is an all-in-one F&B operating system purpose-built for the daily operations of Zeger Coffee today, and architected to become the first tenant of a future SaaS F&B ERP platform.

The product exists to unify every operational surface of the business — back office, branch, hub, rider, kitchen, customer, and finance — into one coherent system with a single source of truth. Every sale, stock movement, cash deposit, and financial report is traceable to the same data model, the same timezone, and the same operational rules.

The long-term vision is: **Zeger Coffee as tenant #1 of a scalable, multi-tenant F&B operating system** that can eventually power other F&B brands without a rewrite.

---

## 2. Business Concept

Zeger Coffee operates through three integrated service channels:

### 2.1 Zeger Branch

A physical coffee shop or outlet with a fixed location, staffed by a Kasir (cashier) and managed by a Branch Manager or Small Branch Manager. The branch handles walk-in orders, local POS sales, in-store inventory, and branch-level operational expenses.

### 2.2 Zeger On The Wheels

A mobile coffee cart or motorcycle-based operation served by Riders. A central branch hub prepares and transfers stock to riders. Riders sell products on-site to customers, accept cash and non-cash payments, return unsold stock at the end of shift, and deposit cash back to the branch.

### 2.3 Zeger On The Street

A lighter, often street-level or kiosk-style POS operation. Shares the same POS and inventory backbone as Zeger Branch, but is positioned as a smaller, more agile surface.

These three channels are not independent apps. They are different personas of the same operating system: shared products, shared inventory semantics, shared finance, and shared reporting.

---

## 3. Current App Reality

The existing Zeger Coffee application is already a multi-persona, multi-channel system. It includes:

| Domain | Description |
|--------|-------------|
| **Back Office / Admin Web App** | Owner, admin, finance, and branch manager dashboards for users, branches, products, reports, and finance. |
| **Rider App / Mobile Seller** | Android-optimized web app used by riders to receive stock, record sales, manage shifts, return stock, and view income. |
| **POS App** | Point-of-sale system for branch and on-the-street counters: cart, payments, split bills, promos, bundles, KDS, and online orders. |
| **Customer App** | Mobile-first ordering app for customers: menu, cart, checkout, Xendit payment, order tracking, loyalty, and nearby rider assignment. |
| **Inventory** | Stock cards, waste management, stock transfers, inventory adjustments, and shift-level stock reconciliation. |
| **Stock Transfer** | One-cycle stock transfer from Branch Hub to Riders, with confirmation, blocking rules, and transfer history. |
| **Reports** | Shift reports, rider performance, cash deposit verification, branch hub reports, and operational analytics. |
| **Finance** | Profit-loss, cash flow, balance sheet, operational expenses, rider income, and cash deposit tracking. |
| **Customer Ordering** | End-to-end order-to-rider flow: browse, pay, dispatch, accept, prepare, deliver. |
| **Xendit Payment** | Server-side invoice creation and webhook-based payment recognition. |
| **Rider Location / Order Dispatch** | Live rider location, nearby rider query, and push-based order dispatch. |

The app is built on **React 18 + Vite + Tailwind CSS + shadcn/ui**, backed by **Supabase** (Postgres, Auth, Storage, Edge Functions), and served from a single tenant deployment. All public tables use GRANTs + Row Level Security per project convention. Voided transactions are excluded from every sales and finance query.

---

## 4. Protected Existing Flow

The current operational flow is the heart of Zeger Coffee. It must never be broken by any change.

```text
Branch Hub / Central Kitchen prepares stock
         |
         v
Branch transfers stock to a Rider
         |
         v
Rider confirms the received stock
         |
         v
Rider sells products to customers
         |
         v
Rider inputs each sale into the app
         |
         v
Rider inventory decreases
         |
         v
Sales report appears in Back Office
         |
         v
Rider returns unsold stock at shift close
         |
         v
Rider deposits cash, report is verified
```

### Protected rules

- The one-cycle stock transfer rule must remain intact: a rider can only receive a new transfer after closing the previous cycle (no active shift, no pending transfer, no remaining stock, no unverified report).
- Voided transactions must always be excluded from sales and financial reports.
- Stock decreases from rider sales and POS sales must stay atomic and consistent with `inventory` and `stock_movements`.
- Cash deposit calculations must remain grounded on the same formula across all surfaces: Cash Sales minus Operational Expenses.
- All dates and reporting must remain in **Asia/Jakarta (WIB, +07:00)** timezone.
- Every change affecting this flow must be tested against the release checklist before reaching production.

---

## 5. Target ERP Modules

These are the modules Zeger Coffee is evolving toward, whether as part of the single-tenant system today or as SaaS capabilities tomorrow.

### 5.1 Branch Management

Create and manage branches, assign branch managers, designate branch hubs vs. satellite branches, and configure branch-specific settings.

### 5.2 Product Management

Maintain product master data: name, SKU, category, price, HPP/cost, price history, active/inactive status, and bulk upload via Excel.

### 5.3 Inventory

Track stock by branch and by rider. Support stock cards, stock movements, waste, opname, adjustments, and alerts.

### 5.4 Stock Transfer

Transfer stock from Branch Hub to Rider with confirmation, one-cycle enforcement, transfer history, and aggregated reporting.

### 5.5 Rider Sales

Record sales on mobile, select payment method, optional payment proof, automatic stock decrement, and per-shift reconciliation.

### 5.6 POS Sales

In-store or on-the-street point of sale: cart, checkout, payments, split bills, promos, bundles, vouchers, KDS, and online order integration.

### 5.7 Customer Orders

Customer-facing ordering flow: menu, cart, checkout, address selection, Xendit payment, order status, and nearby rider dispatch.

### 5.8 Loyalty

Points accrual from orders, tiered loyalty levels, rewards, voucher issuance, and customer-facing balance and history.

### 5.9 CRM

Customer profiles, address management, purchase history, segmentation, and communication channels.

### 5.10 Subscription

Recurring subscription plans for customers, subscription billing, and subscription fulfillment workflows.

### 5.11 Finance

Profit-loss, cash flow, balance sheet, operational expenses, rider income, commission tiers, kasbon, cash deposit verification, and finance reports.

### 5.12 Reports

Shift reports, rider performance, cash deposit, stock card, inventory reports, branch hub analytics, and executive dashboards.

### 5.13 User / Role Management

Role-based access control with roles stored in a dedicated table (not on profiles), permission matrices, and user lifecycle management.

---

## 6. App Surfaces

### 6.1 Back Office Web App

Used by:

- **Owner / HO Admin** — full access to users, branches, products, finance, reports, and master data.
- **Finance** — profit-loss, cash flow, balance sheet, operational expenses, rider income, cash deposit verification.
- **Branch Manager / Small Branch Manager** — branch-level inventory, shift reports, stock transfer, branch reports.
- **Branch Hub Report-Only Staff** — read-only reports and analytics for assigned branches.
- **Mitra / Partner** — limited, permission-scoped views.

### 6.2 Rider App (Zeger On The Wheels)

Used by riders on mobile devices. Core flows:

- Login and confirm pending stock transfers.
- Receive stock from Branch Hub.
- Sell products (card click, quantity input, payment method).
- View real-time income and shift history.
- Return stock and close shift.
- Deposit cash and verify reports.

### 6.3 POS App (Zeger Branch / Zeger On The Street)

Used by cashiers at fixed or mobile counters. Core flows:

- Open and close shifts.
- Build carts with products, bundles, custom items, and modifiers.
- Apply promos and vouchers.
- Handle split bills and multiple payment methods.
- Print receipts.
- Send tickets to KDS.
- Receive online orders from GoFood/Grab/Shopee and internal customer orders.

### 6.4 Customer App

Used by end customers on mobile. Core flows:

- Browse menu and promotions.
- Add to cart and customize.
- Checkout with address and payment method.
- Pay via Xendit.
- Track order status and nearby rider.
- View loyalty points, vouchers, and rewards.
- Subscribe to recurring plans.
- Contact rider via WhatsApp when enabled.

---

## 7. SaaS Vision

Zeger Coffee is **tenant #1** of a future multi-tenant F&B ERP.

- Today, the system is implicitly single-tenant. Zeger data is the only data.
- The future platform can serve other F&B brands using the same codebase.
- SaaS migration must be **additive and phased**. There is no big-bang rewrite.

For the detailed technical migration strategy, see:

- `docs/saas-blueprint.md` — future tenant data model and phased migration plan.
- `docs/stabilization-plan-2026-07.md` — current stabilization and no-break strategy.

### SaaS migration principles

1. **Zeger is tenant #1.** Every future migration must preserve current Zeger behavior byte-for-byte.
2. **Additive first.** New columns are nullable with defaults; new tables live alongside old ones; feature flags gate rollout.
3. **No big-bang migration.** Multi-tenant delivery is phased with parity checks between each phase.
4. **RLS is the enforcement point.** Every tenant-scoped table eventually gets policies that filter by tenant.
5. **Tenant isolation over convenience.** Cross-tenant reads require explicit service-role code paths, never client-side logic.

### Out of scope until Zeger is stable

- Per-tenant custom domains.
- White-label mobile builds.
- Cross-tenant analytics.
- Marketplace-style tenant discoverability.

These are only revisited after Zeger has been stable for a significant period and a second tenant pilot is successful in production.

---

## 8. Development Priority

The roadmap is sequential and intentionally cautious. Each phase stabilizes the previous one before expanding scope.

### Phase 1: Stabilize Current Zeger Operations

- Lock the protected operational flow.
- Complete documentation, release checklist, and audit artifacts.
- Add Vitest/Deno tests for critical math and contracts.
- Tag duplicate components and legacy pages.
- Ensure all Supabase RLS, GRANTs, and edge functions are reviewed.
- Establish staging branch and staging Supabase project.

### Phase 2: Stabilize POS

- Finish promos, bundles, vouchers, split bills, and KDS.
- Add online order panel integration (GoFood/Grab/Shopee).
- Harden POS pay path, inventory decrement, and receipt flows.
- Extract pure business logic helpers without changing runtime behavior.
- Add Playwright happy-path tests on staging.

### Phase 3: Improve Customer App

- Consolidate cart components.
- Harden nearby rider dispatch, distance caps, and rate limits.
- Improve order tracking and rider-to-customer communication.
- Polish checkout and payment UX.

### Phase 4: CRM, Loyalty, Subscription

- Build customer profile and address management.
- Expand loyalty tiers, rewards, and points history.
- Introduce subscription plans and billing events.
- All changes are additive on existing tables or new tables.

### Phase 5: Zeger On The Wheels Order / Rider Dispatch

- Enhance the customer-to-rider dispatch flow.
- Improve live rider location and heartbeat reliability.
- Add rider acceptance logic, cancellation handling, and order status lifecycle.
- Add WhatsApp click-to-chat rider support.

### Phase 6: SaaS Tenant Foundation

- Create `tenants` table and insert Zeger as tenant #1.
- Create `tenant_settings` and move hardcoded Zeger constants into a compatibility shim.
- Add nullable `tenant_id` columns to tenant-scoped tables.
- Backfill all existing rows with the Zeger tenant ID.
- No behavior change; verify parity.

### Phase 7: SaaS Commercial Rollout

- Enforce `NOT NULL` tenant IDs and rewrite RLS policies.
- Build tenant switcher and super-admin console.
- Provision tenant #2 on staging and run full release checklist.
- Pilot tenant #2 on production for a stabilization window before opening onboarding.

---

## 9. No-Break Development Rules

These rules apply to every change, regardless of size or urgency.

- **Do not rewrite from scratch.** Refactor incrementally, preserving behavior.
- **Do not break the Rider App.** The rider flow is the core revenue path.
- **Do not break stock transfer.** The one-cycle rule must remain intact.
- **Do not break existing reports.** Reported numbers must stay consistent after any change.
- **Do not change the production database without review.** Every migration needs a GRANT check, rollback SQL, and staging run.
- **Prefer small PRs.** Small changes are easier to review, test, and revert.
- **Prefer additive changes.** Add new code or tables alongside existing ones; avoid destructive edits.
- **Use staging before production.** Every production-affecting change must pass on the staging Supabase project first.
- **Always exclude voided records** from sales and financial queries.
- **Always use Asia/Jakarta (+07:00)** for dates displayed to users and stored as business dates.
- **Always include GRANT statements** when creating new public tables.
- **Never store roles on the `profiles` table.** Roles live in a dedicated `user_roles` table.
- **Never check admin status via client-side storage.** Use server-side validation only.

---

## 10. AI Coding Agent Workflow

When an AI coding agent works on Zeger Coffee, it must follow this workflow to avoid unintended production impact.

### 10.1 Plan mode first

For any feature, refactor, or non-trivial change:

1. Read the relevant files and documentation.
2. Clarify unclear requirements before writing code.
3. Present a plan for user approval before implementation.

### 10.2 Build mode only for small, scoped tasks

Build mode is allowed only when:

- The task is narrow and well-defined.
- The user has explicitly approved the direction or the change is a pure documentation/test addition.
- The affected files are clearly identified.

### 10.3 Always mention protected flows

Any implementation that touches the following must call out the risk explicitly and verify against the release checklist:

- Rider sales and stock decrement.
- Stock transfer from Branch Hub to Rider.
- POS payment and inventory decrement.
- Customer order, Xendit payment, and webhook.
- Cash deposit verification and finance reports.
- User roles and permissions.

### 10.4 Always list affected files

Before and after making changes, list the files that will be or were affected. This includes:

- React components and pages.
- Hooks and utility libraries.
- Supabase migrations and edge functions.
- Tests and documentation.

### 10.5 Always avoid unrelated changes

- Do not reformat files outside the scope.
- Do not rename unrelated components.
- Do not upgrade dependencies unless the task requires it.
- Do not change design tokens or global styles unless requested.

### 10.6 Always test against the release checklist

After changes, verify with the fastest relevant signal:

- Build output (`bun run build` or Vite equivalent).
- Targeted tests (Vitest for pure helpers, Deno for edge functions, Playwright for UI flows).
- Console logs and network requests from the preview.
- Manual release checklist steps for protected flows.

No bug is considered fixed until the signal that matters has been checked.

---

## Related Documents

- `docs/audit-2026-07.md` — technical audit of the current system.
- `docs/stabilization-plan-2026-07.md` — safe stabilization and no-break strategy.
- `docs/saas-blueprint.md` — future multi-tenant data model and migration plan.
- `docs/protected-flows.md` — canonical list of protected production flows.
- `docs/release-checklist.md` — regression test checklist before release.
- `docs/routes.md` (planned) — route × role matrix.
- `docs/roles.md` (planned) — role naming consolidation and role matrix.

---

*End of product blueprint. This document is read-only direction. Any change to its content should be proposed and approved before editing.*
