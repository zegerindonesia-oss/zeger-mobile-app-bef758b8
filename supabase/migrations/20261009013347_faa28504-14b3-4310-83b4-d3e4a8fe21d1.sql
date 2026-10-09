INSERT INTO public.app_settings (setting_key, setting_value, setting_type, description, is_active)
VALUES (
  'care.faq_items',
  '[
    {"q":"Bagaimana cara mengumpulkan Zeger Poin?","a":"Setiap belanja Rp10.000 di outlet, booth Zeger On The Street, maupun rider Zeger On The Wheels otomatis jadi 1 poin. Pastikan kasir atau rider memindai kartu member kamu sebelum bayar."},
    {"q":"Poin saya bisa dipakai di outlet mana saja?","a":"Bisa. Poin berlaku di seluruh channel Zeger. 1 poin setara potongan Rp500 dan bisa ditukar lewat menu Tukar Poin di aplikasi atau langsung di kasir."},
    {"q":"Berapa lama pesanan delivery sampai?","a":"Rata-rata 20-40 menit tergantung jarak dan antrean outlet. Kamu bisa memantau posisi rider di menu Pesanan."},
    {"q":"Voucher saya tidak bisa dipakai, kenapa?","a":"Cek minimal belanja dan masa berlaku voucher. Voucher gratis ongkir hanya berlaku untuk pesanan yang diantar, bukan ambil sendiri."},
    {"q":"Apa untungnya berlangganan MyZeger Plan?","a":"Langganan memberi kamu kuota diskon dan gratis minuman tiap bulan, plus hadiah ulang tahun. Detail benefitnya ada di halaman MyZeger Plan."},
    {"q":"Bagaimana kalau pesanan saya salah atau kurang?","a":"Hubungi Zeger Care lewat WhatsApp dengan menyertakan nomor pesanan. Tim kami akan bantu proses penggantian atau pengembalian dana."}
  ]'::jsonb,
  'customer_app',
  'FAQ yang tampil di halaman Zeger Care aplikasi customer',
  true
)
ON CONFLICT (setting_key) DO NOTHING;