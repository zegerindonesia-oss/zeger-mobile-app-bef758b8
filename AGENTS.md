# Project Architecture Rules

- Keep the cashier POS presentation isolated in reusable `pos-*` semantic classes and shared UI variants, so visual changes never alter transaction, access, inventory, or payment logic.- FlowF&B app SaaS website lives at / for signed-out visitors (HomeGate) and /landing; onboarding provisions tenant + owner membership + first branch + template menu via the provision_tenant RPC; flow_tenant_signups is kept as a sales lead log.

- Multi-tenant: `tenants` + `tenant_users` tables; tenant-scoped tables carry `tenant_id` defaulting to the Zeger tenant (00000000-0000-0000-0000-000000000001) so existing Zeger flows stay unchanged until tenant RLS is enforced per table.
- SaaS plans (ids free/sme/mid_market/enterprise) and their default modules live in src/lib/flow-plans.ts, mirrored server-side by public.plan_modules(); provision_tenant derives modules from plan so signups cannot self-grant modules.
- POS layout is touch-first: phones (<md) use full catalog + bottom cart drawer, tablets/desktop use split view; install support is manifest-only (no service worker) to keep previews safe.
- Native Android/iOS apps are Capacitor shells (capacitor.config.ts) loading the published domain, so APKs update without rebuilds; native folders are generated locally by the user via `npx cap add android`.
- POS TV queue screens pair without login via `/tv?branch=<id>` reading the minimal-field `get_queue_display` RPC; per-branch video/running text lives in `pos_display_settings`, so TVs never hold staff credentials.
- Per-branch POS config (order modes, hidden menu items, cash categories) lives in `pos_branch_settings`, edited only in Back Office (/settings/pos-branches); cashier POS reads it, so outlets cannot self-configure.
- Procurement (PO → receive → invoice/due date → payments) lives in purchase_orders/purchase_order_items/purchase_payments; receiving goes only through the receive_purchase_order RPC so stock-in and invoice totals stay atomic; access = is_material_manager() or a granted 'procurement' row in user_module_permissions (has_procurement_access).
- Material unit conversions live in material_units (factor to the material's base unit); recipes and stock always use the base unit.
- Invoicing is its own back-office module (/invoicing/*): sales invoices/orders live in sales_invoices(+items, doc_type invoice|order) with business_customers; purchase side reuses the procurement page; access reuses has_procurement_access so cashiers stay excluded.
