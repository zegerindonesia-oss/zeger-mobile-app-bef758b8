import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

// Midtrans Core API QRIS: same actions as the old duitku-qris (create/status for customer orders,
// pos_create/pos_status for cashier bills) plus the Midtrans HTTP notification webhook.
const sha512 = async (s: string) => encodeHex(await crypto.subtle.digest('SHA-512', new TextEncoder().encode(s)))
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const isPaid = (s?: string) => s === 'settlement' || s === 'capture'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const prod = (Deno.env.get('MIDTRANS_ENV') ?? 'production') === 'production'
  const serverKey = prod ? Deno.env.get('MIDTRANS_SERVER_KEY') : Deno.env.get('MIDTRANS_SANDBOX_SERVER_KEY')
  if (!serverKey) return json({ error: 'Pembayaran QRIS belum dikonfigurasi' }, 500)
  const base = prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'
  const auth = 'Basic ' + btoa(serverKey + ':')
  const mt = (path: string, body?: unknown) => fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json().catch(() => ({})))
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const markPaid = async (orderId: string) => {
    await admin.from('customer_orders').update({ status: 'pending', payment_method: 'qris' })
      .eq('id', orderId).eq('status', 'pending_payment')
  }
  const qrOf = (d: any) => d.qr_string || ''

  try {
    const raw = await req.json().catch(() => ({}))

    // Midtrans notification webhook (verified by SHA512 signature).
    if (raw?.signature_key && raw?.order_id) {
      const expected = await sha512(`${raw.order_id}${raw.status_code}${raw.gross_amount}${serverKey}`)
      if (expected !== raw.signature_key) return new Response('bad signature', { status: 400 })
      // Re-confirm with Midtrans before trusting the status.
      const s = await mt(`/v2/${encodeURIComponent(raw.order_id)}/status`)
      if (isPaid(s.transaction_status) && !String(raw.order_id).startsWith('POS-')) await markPaid(raw.order_id)
      return new Response('OK')
    }

    if (raw?.action === 'pos_create' || raw?.action === 'pos_status') {
      const P = z.object({ action: z.enum(['pos_create', 'pos_status']), ref: z.string().regex(/^POS-[A-Za-z0-9-]{8,60}$/), amount: z.number().int().min(1).max(100000000).optional() })
      const p = P.safeParse(raw)
      if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400)
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      const { data: u } = await admin.auth.getUser(token)
      if (!u?.user) return json({ error: 'Unauthorized' }, 401)
      const { data: prof } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
      if (!prof || prof.role === 'customer') return json({ error: 'Forbidden' }, 403)
      if (p.data.action === 'pos_status') {
        const d = await mt(`/v2/${p.data.ref}/status`)
        return json({ paid: isPaid(d.transaction_status), amount: Number(d.gross_amount) || null, reference: d.transaction_id, status: d.transaction_status })
      }
      if (!p.data.amount) return json({ error: 'amount wajib' }, 400)
      const d = await mt('/v2/charge', {
        payment_type: 'qris', qris: { acquirer: 'gopay' },
        transaction_details: { order_id: p.data.ref, gross_amount: p.data.amount },
        custom_expiry: { expiry_duration: 15, unit: 'minute' },
      })
      if (!qrOf(d)) { console.error('pos charge failed', d); return json({ error: d.status_message || 'Gagal membuat QRIS' }, 502) }
      return json({ qr_string: qrOf(d), reference: d.transaction_id, amount: p.data.amount })
    }

    const parsed = z.object({ action: z.enum(['create', 'status']), order_id: z.string().uuid() }).safeParse(raw)
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const { action, order_id } = parsed.data
    const userSb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: order } = await userSb.from('customer_orders').select('id, total_price, status, user_id').eq('id', order_id).maybeSingle()
    if (!order) return json({ error: 'Pesanan tidak ditemukan' }, 404)

    if (action === 'status') {
      const d = await mt(`/v2/${order.id}/status`)
      const paid = isPaid(d.transaction_status)
      if (paid) await markPaid(order.id)
      return json({ paid, status: d.transaction_status, message: d.status_message })
    }

    if (order.status !== 'pending_payment') return json({ error: 'Pesanan sudah dibayar atau tidak menunggu pembayaran' }, 400)
    const amount = Math.round(Number(order.total_price))
    // Reuse an existing pending QR for this order if already charged.
    const existing = await mt(`/v2/${order.id}/status`)
    if (existing.transaction_status === 'pending') {
      const qa = (existing.actions || []).find((a: any) => a.name === 'generate-qr-code')
      if (existing.qr_string) return json({ qr_string: existing.qr_string, amount, expires_in_minutes: 15 })
      if (qa) console.log('pending without qr_string', order.id)
    }
    const { data: cust } = await admin.from('customer_users').select('name, phone, email').eq('id', order.user_id).maybeSingle()
    const d = await mt('/v2/charge', {
      payment_type: 'qris', qris: { acquirer: 'gopay' },
      transaction_details: { order_id: order.id, gross_amount: amount },
      customer_details: { first_name: cust?.name || 'Pelanggan Zeger', phone: cust?.phone || undefined, email: cust?.email || undefined },
      custom_expiry: { expiry_duration: 15, unit: 'minute' },
    })
    if (!qrOf(d)) { console.error('charge failed', d); return json({ error: d.status_message || 'Gagal membuat QRIS' }, 502) }
    return json({ qr_string: qrOf(d), reference: d.transaction_id, amount, expires_in_minutes: 15 })
  } catch (e) {
    console.error(e)
    return json({ error: 'Terjadi kesalahan pembayaran' }, 500)
  }
})
