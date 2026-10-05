# Project Architecture Rules

- Keep the cashier POS presentation isolated in reusable `pos-*` semantic classes and shared UI variants, so visual changes never alter transaction, access, inventory, or payment logic.