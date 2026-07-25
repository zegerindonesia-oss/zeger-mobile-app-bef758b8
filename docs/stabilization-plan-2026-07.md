# Zeger Coffee — Safe Stabilization Plan (July 2026)

Documentation only. No runtime, DB, or edge function changes.

## 1. Protected Production Flows

See `docs/protected-flows.md` for the canonical list. Summary:
- Rider sales, Branch→Rider stock transfer, Rider stock confirmation, Inventory decrement, Sales reports, Cash deposit, POS payment, Customer order/payment, Xendit webhook, Rider dispatch, Auth & roles.

Any PR touching these requires the regression checklist in §2 to be executed on staging.

## 2. Regression Test Checklist

See `docs/release-checklist.md` for the full manual checklist. Test cases cover: login by role, rider stock receive, rider sales input, rider stock decrease, back office report update, POS open shift, POS sale, POS inventory decrease, customer order, Xendit payment, void transaction, cash deposit.

## 3. Risk-Based Priority

**P0 — Critical security / data**
- Xendit webhook signature + idempotency.
- Server-side amount recomputation in `create-xendit-invoice`.
- Input validation + rate limits on public edge functions.
- Secrets never in git; rotate any historically leaked keys.
- RLS coverage on financial and permission tables.

**P1 — Production stability**
- Voided-row filter on every sales/finance query.
- `.range()` pagination anywhere aggregation exceeds 1,000 rows.
- Realtime cleanup in `useEffect`.
- Atomicity of POS pay + rider sale (multi-insert + decrement).
- Stock transfer 1-cycle guard edge cases.
- Asia/Jakarta timezone discipline.

**P2 — Maintainability**
- Duplicated components/pages tagged `@deprecated`.
- Large components split by extraction (behavior-preserving).
- Business logic extracted from UI into pure helpers.
- Role naming consolidation plan (legacy ↔ numbered).

**P3 — Future SaaS**
- No `tenant_id` yet; hardcoded tenant values documented.
- Single Xendit account; document multi-tenant Xendit strategy.
- Tenant provisioning + admin console planned only.

## 4. No-Break Refactor Strategy

All additive; no runtime behavior change.
- Route documentation (`docs/routes.md`).
- Role matrix (`docs/roles.md`).
- Component inventory (`docs/components.md`).
- Query inventory (`docs/queries.md`) — voided-filter + pagination audit.
- Edge function inventory (`docs/edge-functions.md`).
- Duplicate tagging via `@deprecated` JSDoc only.
- Tests: Vitest for pure helpers; Deno tests for edge functions.
- Logging: structured breadcrumbs (no PII/secret) around POS pay, rider sale, stock transfer.

## 5. Branch Strategy

```
main          ← production; fast-forward only from staging
  ↑
staging       ← QA/UAT against staging Supabase
  ↑
audit         ← long-lived docs/tests branch
  ↑
feature/*     ← one branch per task, small PRs
hotfix/*      ← from main; back-port to staging
```
Rules: no direct commits to `main`; all merges via PR; tag releases `vYYYY.MM.DD-<n>`; maintain `CHANGELOG.md`.

## 6. Supabase Safety Strategy

- **Backup**: Supabase PITR daily; weekly `pg_dump` archived off-platform; quarterly restore drill.
- **Staging project**: separate Supabase project seeded from sanitized prod snapshot; `.env.staging` in Lovable secrets.
- **Migration review**: SQL diff + dry-run on staging + GRANTs verified + rollback SQL in PR description.
- **RLS review**: quarterly linter run + manual review of touched policies; tests per role.
- **Edge function review**: CORS, JWT/signature, Zod validation, idempotency, no `service_role` leak, sanitized logs.
- **Rollback**: revert commit + redeploy previous tag; paired down-migrations; edge function last-known-good redeploy; Xendit sandbox toggle for isolation.

## 7. POS Stabilization Plan (no rewrite)

1. Document current flow (`docs/pos-flow.md`).
2. Instrument breadcrumbs + timing logs.
3. Test harness: Vitest for cart/promo/split-bill math; Playwright happy-path on staging.
4. Extract `posCheckout({cart, promo, payment})` as pure orchestration (same runtime behavior).
5. Extract `decrementInventory` into `lib/pos/inventory.ts` (same signature).
6. Shadow-write parity log (computed vs stored totals) for 2 weeks.
7. Later: move `handlePay` into an RPC `pos_checkout_v1` behind feature flag `POS_USE_RPC`; gradual rollout.
8. Later: retire `/pos-legacy` after clean parity month.

## 8. Rider App Protection Plan

1. **No UI changes first** — add Playwright screenshot tests per screen on staging.
2. **No table changes first** — snapshot rider queries; verify voided-filter + pagination.
3. **No stock logic changes first** — Vitest for stock decrement + 1-cycle guard using fixtures.
4. Add health probes on rider login (role, branch, pending transfers).
5. Only then, additive UI improvements behind env flag; roll 1 → 5 → all riders.
6. §2 rider items before + after every change; foreman sign-off.
7. Freeze window: no rider deploys 06:00–22:00 WIB.

## 9. Customer App Continuation Plan

Guardrails: work only in `src/components/customer/*`, `src/pages/CustomerApp.tsx`, and customer-scoped edge functions. Only additive nullable columns on shared tables.

Sequenced backlog:
1. Cart consolidation (pick canonical `CustomerCartNew`; `@deprecated` the other).
2. Nearby rider hardening (validation, distance cap, rate limit).
3. WhatsApp click-to-chat rider (additive).
4. Loyalty / subscription on existing loyalty tables; new subscription table additive.
5. Reviews/ratings additive table.

## 10. SaaS Preparation Plan

Doc-only now. Zeger = tenant #1. Design `tenants`, `tenant_users`, `tenant_settings`, `tenant_branches`, `tenant_subscriptions`, `tenant_billing_events` (see `docs/saas-blueprint.md`). Migration is additive, phased: nullable `tenant_id` + backfill → NOT NULL → RLS rewrite → tenant switcher → staging pilot tenant #2 → prod pilot. No SaaS code until Zeger is stable 90 days on single-tenant.

## 11. First 10 Safe Tasks

| # | Task | Objective | Risk | Files | DB migration | Prod behavior | Rollback |
|---|------|-----------|------|-------|--------------|---------------|----------|
| T1 | `docs/audit-2026-07.md` | Freeze audit as canonical reference | none | `docs/audit-2026-07.md` | no | no | delete file |
| T2 | `docs/routes.md` + `docs/roles.md` | Route × role matrix | none | 2 new docs | no | no | delete files |
| T3 | `docs/queries.md` | Query inventory + voided/pagination audit | none | 1 new doc | no | no | delete file |
| T4 | `docs/edge-functions.md` | Edge fn catalog + risks | none | 1 new doc | no | no | delete file |
| T5 | Verify `.env` ignored; rotate any historically leaked keys | Close secret leakage | low | `.gitignore`, external key rotation | no | none if coordinated | revert to prior key |
| T6 | Vitest for `financial-utils`, `date`, `usePOSPromo` | Lock formulas | none | `src/**/__tests__/*` | no | no | delete tests |
| T7 | Deno tests for `xendit-webhook`, `create-xendit-invoice` | Contract tests | none | `supabase/functions/*_test.ts` | no | no | delete tests |
| T8 | Structured breadcrumbs on POS pay / rider sale / stock transfer | Diagnostics | low | log-only additions | no | additive logs | remove logs |
| T9 | `@deprecated` JSDoc on duplicated components | Signal canonical | none | JSDoc only | no | no | remove JSDoc |
| T10 | Staging Supabase + `staging` branch + release checklist doc | Enable §5/§6 | low | `docs/release-checklist.md`, staging env | no (new project) | no | pause staging project |

All ten are additive documentation, tests, or logging. None require DB migration or change production behavior.