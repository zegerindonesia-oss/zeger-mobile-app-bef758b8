# Zeger Coffee — SaaS Blueprint (Future State)

Documentation only. Nothing in this file is implemented today. Zeger Coffee runs as an implicit single tenant; this blueprint describes the target multi-tenant F&B ERP that Zeger will be the first pilot of.

## Guiding principles

1. **Zeger is tenant #1.** Every future migration must preserve current Zeger behavior byte-for-byte.
2. **Additive first.** New columns are nullable with defaults; new tables live alongside old ones; feature flags gate rollout.
3. **No big-bang migration.** Multi-tenant is delivered in phases with parity checks between each phase.
4. **RLS is the enforcement point.** Every tenant-scoped table gets a policy that filters by `current_tenant_id()`.
5. **Tenant isolation over convenience.** Cross-tenant reads require an explicit `service_role` code path, never client-side.

## Future tables (design only — do not create yet)

### `tenants`
Represents each F&B brand using the platform.
- `id uuid pk`
- `slug text unique` (URL-safe, e.g. `zeger-coffee`)
- `name text`
- `status text` (`active`, `suspended`, `pending`)
- `plan text` (`starter`, `growth`, `enterprise`)
- `config jsonb` (branding, feature flags, tenant-scoped constants)
- `xendit_account_id text nullable` (per-tenant payment routing)
- `storage_prefix text` (per-tenant storage namespace)
- `created_at timestamptz default now()`

### `tenant_users`
Membership + tenant-scoped role assignment. A user may belong to multiple tenants over time.
- `id uuid pk`
- `tenant_id uuid fk tenants`
- `user_id uuid` (mirrors `auth.users.id`, no FK)
- `role_code text` (unified role codes, tenant-scoped)
- `is_active boolean default true`
- `created_at timestamptz`

### `tenant_settings`
Key-value store for tenant-specific configuration (replaces hardcoded Zeger constants: verifier names, commission tiers, rider targets, categories, brand assets).
- `id uuid pk`
- `tenant_id uuid fk tenants`
- `key text` (e.g. `commission.tiers`, `verifier.outlet_names`, `rider.targets.daily`)
- `value jsonb`
- `updated_at timestamptz`
- Unique on `(tenant_id, key)`.

### `tenant_branches`
Bridge between the existing `branches` table and tenants once `branches.tenant_id` exists. Until then, this doc treats it as the intended target shape.
- `id uuid pk`
- `tenant_id uuid fk tenants`
- `branch_id uuid fk branches`
- `is_hub boolean` (branch hub vs satellite)
- `created_at timestamptz`

### `tenant_subscriptions`
Billing plan lifecycle per tenant.
- `id uuid pk`
- `tenant_id uuid fk tenants`
- `plan text` (`starter`, `growth`, `enterprise`)
- `status text` (`trial`, `active`, `past_due`, `cancelled`)
- `current_period_start timestamptz`
- `current_period_end timestamptz`
- `provider text` (`xendit`, `stripe`, `manual`)
- `provider_subscription_id text`
- `created_at timestamptz`

### `tenant_billing_events`
Immutable audit log of billing events (invoice issued, paid, failed, refunded).
- `id uuid pk`
- `tenant_id uuid fk tenants`
- `subscription_id uuid fk tenant_subscriptions`
- `event_type text`
- `amount numeric`
- `currency text`
- `provider_event_id text` (idempotency key)
- `payload jsonb`
- `occurred_at timestamptz`

## Future `tenant_id` migration strategy (phased, additive)

**Phase A — Preparation (docs only, no code yet)**
- Freeze audit + protected flows (this document + `docs/protected-flows.md`).
- Enumerate every table that must become tenant-scoped.
- Reserve `ZEGER_TENANT_ID` UUID and store it in `tenant_settings`-shaped notes.

**Phase B — Introduce tenants table (additive)**
- Create `tenants` + insert Zeger row.
- Create `tenant_settings` and move hardcoded Zeger constants into it, still read via a compatibility shim that returns identical values.

**Phase C — Add nullable `tenant_id` to scoped tables**
- Add `tenant_id uuid` (nullable) to: `branches`, `profiles`, `products`, `inventory`, `stock_movements`, `transactions`, `pos_transactions`, `customer_orders`, `financial_transactions`, `daily_operational_expenses`, `cash_deposit_verifications`, and every other row-owning table.
- Backfill all existing rows with `ZEGER_TENANT_ID`.
- No RLS change yet; app behavior unchanged.

**Phase D — Enforce NOT NULL + helpers**
- Set `tenant_id NOT NULL` after backfill verified.
- Add `current_tenant_id()` security-definer that reads from JWT claim or `tenant_users` for the current user.
- Add `has_role_in_tenant(_user, _tenant, _role)`.

**Phase E — Rewrite RLS**
- For each tenant-scoped table, add policies `USING (tenant_id = current_tenant_id())` in addition to existing role checks.
- Test with Zeger data — must be a no-op.

**Phase F — Tenant switcher + admin console**
- Add tenant switcher for users in multiple tenants (rare initially).
- Build super-admin console for tenant provisioning, subscription management, billing events.

**Phase G — Staging pilot tenant #2**
- Provision a second tenant on staging.
- Run the full release checklist for both tenants side-by-side.

**Phase H — Production pilot tenant #2**
- Onboard first external customer on production.
- Monitor billing, isolation, and performance for 30 days before opening onboarding.

## Why additive, not big-bang

A single-shot rewrite would (a) require freezing Zeger operations, (b) risk data loss during backfill, (c) invalidate every existing RLS policy simultaneously, and (d) leave no rollback path. The phased approach keeps every step independently revertable and preserves Zeger's 24/7 operation throughout.

## Out of scope (for now)

- Per-tenant custom domains.
- Per-tenant white-label mobile builds.
- Cross-tenant analytics.
- Marketplace-style tenant discoverability.

These will be revisited only after tenant #2 has been stable in production for 90 days.