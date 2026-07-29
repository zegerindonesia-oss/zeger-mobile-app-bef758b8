## Cara reconnect Google Maps Platform connector

Buka Project Settings → Connectors → Google Maps Platform, lalu ikuti langkah berikut:

1. **Klik "Reconnect"** di bagian atas halaman connector (tombol di sebelah kanan judul "Google Maps Platform").
2. **Pilih "Lovable-managed Google Maps Platform"** (bukan BYOK/API key manual).
3. **Klik "Connect" / "Save"** dan tunggu sampai Lovable meng-inject ulang env variable.

## Setelah reconnect

1. **Refresh / reload preview** (`/customer-app`).
2. Peta seharusnya langsung muncul.

## Kalau masih error

- Pastikan domain yang dibuka masih `*.lovable.app` atau `*.lovableproject.com` (managed key tidak berlaku di custom domain).
- Kalau sudah di custom domain, solusinya bukan reconnect, tapi pakai API key Google Cloud sendiri yang referrer-nya di-allowlist untuk domain kamu.

Catatan: tidak perlu kirim API key di chat. Kalau reconnect berhasil, env `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` akan otomatis terisi oleh Lovable.