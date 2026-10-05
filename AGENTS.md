# Project Architecture Rules

- Keep the cashier POS presentation isolated in reusable `pos-*` semantic classes and shared UI variants, so visual changes never alter transaction, access, inventory, or payment logic.- FlowF&B app SaaS website lives at / for signed-out visitors (HomeGate) and /landing; company signups saved to flow_tenant_signups until multi-tenant provisioning exists.
