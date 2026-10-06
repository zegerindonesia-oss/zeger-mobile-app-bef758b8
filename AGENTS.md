# Project Architecture Rules

- Keep the cashier POS presentation isolated in reusable `pos-*` semantic classes and shared UI variants, so visual changes never alter transaction, access, inventory, or payment logic.- FlowF&B app SaaS website lives at / for signed-out visitors (HomeGate) and /landing; onboarding provisions tenant + owner membership + first branch + template menu via the provision_tenant RPC; flow_tenant_signups is kept as a sales lead log.

- Multi-tenant: `tenants` + `tenant_users` tables; tenant-scoped tables carry `tenant_id` defaulting to the Zeger tenant (00000000-0000-0000-0000-000000000001) so existing Zeger flows stay unchanged until tenant RLS is enforced per table.
- SaaS plans (ids free/sme/mid_market/enterprise) and their default modules live in src/lib/flow-plans.ts, mirrored server-side by public.plan_modules(); provision_tenant derives modules from plan so signups cannot self-grant modules.
- POS layout is touch-first: phones (<md) use full catalog + bottom cart drawer, tablets/desktop use split view; install support is manifest-only (no service worker) to keep previews safe.
