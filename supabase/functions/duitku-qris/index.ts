import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { crypto } from 'https://deno.land/std@0.224.0/crypto/mod.ts'
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts'

// Duitku QRIS Dynamic: create QR for a customer order, check status, and receive Duitku callback.
// merchantOrderId = customer_orders.id. Paid → order moves from pending_payment to pending,
// which lets courier-delivery book the driver automatically.
const md5 = async (s: string) => encodeHex(await crypto.subtle.digest('MD5', new TextEncoder().encode(s)))
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Body = z.object({ action: z.enum(['create', 'status']), order_id: z.string().uuid() })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const merchant = Deno.env.get('DUITKU_MERCHANT_CODE')
  const apiKey = Deno.env.get('DUITKU_API_KEY')
  if (!merchant || !apiKey) return json({ error: 'Pembayaran QRIS belum dikonfigurasi' }, 500)
  const base = Deno.env.get('DUITKU_ENV') === 'production' ? 'https://passport.duitku.com' : 'https://sandbox.duitku.com'
  const method = Deno.env.get('DUITKU_QRIS_METHOD') || 'SP'
  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const markPaid = async (orderId: string, ref?: string) => {
    await admin.from('customer_orders').update({ status: 'pending', payment_method: 'qris' })
      .eq('id', orderId).eq('status', 'pending_payment')
    console.log('paid', orderId, ref)
  }

  try {
    // Duitku callback (form-urlencoded)
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/x-www-form-urlencoded')) {
      const f = new URLSearchParams(await req.text())
      const amount = f.get('amount') ?? '', oid = f.get('merchantOrderId') ?? ''
      const expected = await md5(merchant + amount + oid + apiKey)
      if (f.get('merchantCode') !== merchant || f.get('signature') !== expected) return new Response('bad signature', { status: 400 })
      if (f.get('resultCode') === '00' && !oid.startsWith('POS-')) await markPaid(oid, f.get('reference') ?? undefined)
      return new Response('OK')
    }

    const raw = await req.json().catch(() => ({}))

    // In-store POS QRIS: cashier creates a QR for the bill amount; paid status is verified with Duitku.
    if (raw?.action === 'pos_create' || raw?.action === 'pos_status') {
      const P = z.object({ action: z.enum(['pos_create', 'pos_status']), ref: z.string().regex(/^POS-[A-Za-z0-9-]{8,60}$/), amount: z.number().int().min(1).max(100000000).optional() })
      const p = P.safeParse(raw)
      if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400)
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      const { data: u } = await admin.auth.getUser(token)
      if (!u?.user) return json({ error: 'Unauthorized' }, 401)
      const { data: prof } = await admin.from('profiles').select('role, branch_id').eq('user_id', u.user.id).maybeSingle()
      if (!prof || prof.role === 'customer') return json({ error: 'Forbidden' }, 403)
      if (p.data.action === 'pos_status') {
        const res = await fetch(`${base}/webapi/api/merchant/transactionStatus`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchantCode: merchant, merchantOrderId: p.data.ref, signature: await md5(merchant + p.data.ref + apiKey) }),
        })
        const d = await res.json().catch(() => ({}))
        return json({ paid: d.statusCode === '00', amount: Number(d.amount) || null, reference: d.reference, status: d.statusCode })
      }
      if (!p.data.amount) return json({ error: 'amount wajib' }, 400)
      const res = await fetch(`${base}/webapi/api/merchant/v2/inquiry`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantCode: merchant, paymentAmount: p.data.amount, paymentMethod: method, merchantOrderId: p.data.ref,
          productDetails: `Pembayaran Kasir ${p.data.ref.slice(4, 12)}`, email: 'kasir@flowfnb.com', phoneNumber: '', customerVaName: 'Pelanggan',
          callbackUrl: `${url}/functions/v1/duitku-qris`, returnUrl: 'https://flowfnb.flowsstack.com/pos',
          signature: await md5(merchant + p.data.ref + p.data.amount + apiKey), expiryPeriod: 15,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.statusCode !== '00') { console.error('pos inquiry failed', res.status, d); return json({ error: d.statusMessage || d.Message || 'Gagal membuat QRIS' }, 502) }
      return json({ qr_string: d.qrString, reference: d.reference, amount: p.data.amount })
    }

    const parsed = Body.safeParse(raw)
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const { action, order_id } = parsed.data
    // Caller's own session: RLS ensures customers only reach their own order.
    const userSb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: order } = await userSb.from('customer_orders').select('id, total_price, status, user_id').eq('id', order_id).maybeSingle()
    if (!order) return json({ error: 'Pesanan tidak ditemukan' }, 404)

    if (action === 'status') {
      const res = await fetch(`${base}/webapi/api/merchant/transactionStatus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantCode: merchant, merchantOrderId: order.id, signature: await md5(merchant + order.id + apiKey) }),
      })
      const d = await res.json().catch(() => ({}))
      const paid = d.statusCode === '00'
      if (paid) await markPaid(order.id, d.reference)
      return json({ paid, status: d.statusCode, message: d.statusMessage })
    }

    if (order.status !== 'pending_payment') return json({ error: 'Pesanan sudah dibayar atau tidak menunggu pembayaran' }, 400)
    const amount = Math.round(Number(order.total_price))
    const { data: cust } = await admin.from('customer_users').select('name, phone, email').eq('id', order.user_id).maybeSingle()
    const res = await fetch(`${base}/webapi/api/merchant/v2/inquiry`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: merchant, paymentAmount: amount, paymentMethod: method, merchantOrderId: order.id,
        productDetails: `Pesanan Zeger #${order.id.slice(0, 8)}`,
        email: cust?.email || 'customer@zegercoffee.com', phoneNumber: cust?.phone || '', customerVaName: cust?.name || 'Pelanggan Zeger',
        callbackUrl: `${url}/functions/v1/duitku-qris`, returnUrl: 'https://flowfnb.flowsstack.com/customer-app',
        signature: await md5(merchant + order.id + amount + apiKey), expiryPeriod: 15,
      }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok || d.statusCode !== '00') {
      console.error('inquiry failed', res.status, d)
      return json({ error: d.statusMessage || d.Message || 'Gagal membuat QRIS' }, 502)
    }
    return json({ qr_string: d.qrString, reference: d.reference, amount, payment_url: d.paymentUrl, expires_in_minutes: 15 })
  } catch (e) {
    console.error(e)
    return json({ error: 'Terjadi kesalahan pembayaran' }, 500)
  }
})
