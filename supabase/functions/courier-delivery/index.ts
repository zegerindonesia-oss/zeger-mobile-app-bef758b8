import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

// Books and tracks instant couriers (GoSend / GrabExpress) for customer delivery orders.
// Customers never see the provider; they only see friendly status + tracking.
const Body = z.object({
  action: z.enum(['book', 'track']),
  order_id: z.string().uuid(),
  courier_code: z.enum(['gojek', 'grab']).optional(),
  service_code: z.string().max(50).optional(),
})

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const API = 'https://api.biteship.com/v1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const key = Deno.env.get('BITESHIP_API_KEY')
    if (!key) return json({ error: 'Pengiriman belum dikonfigurasi' }, 500)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const b = parsed.data

    const url = Deno.env.get('SUPABASE_URL')!
    // Caller's own session: RLS guarantees they can only touch their own order.
    const userSb = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: order } = await userSb.from('customer_orders').select('*').eq('id', b.order_id).maybeSingle()
    if (!order) return json({ error: 'Pesanan tidak ditemukan' }, 404)
    if (order.order_type !== 'outlet_delivery') return json({ error: 'Bukan pesanan antar' }, 400)

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const save = (patch: Record<string, unknown>) =>
      admin.from('customer_orders').update({ ...patch, courier_updated_at: new Date().toISOString() }).eq('id', order.id)

    const book = async (courierCode: string, serviceCode: string) => {
      const [{ data: outlet }, { data: cust }, { data: items }] = await Promise.all([
        admin.from('branches').select('name, address, phone, latitude, longitude').eq('id', order.outlet_id).maybeSingle(),
        admin.from('customer_users').select('name, phone').eq('id', order.user_id).maybeSingle(),
        admin.from('customer_order_items').select('quantity, price, products(name)').eq('order_id', order.id),
      ])
      if (!outlet?.latitude || !outlet?.longitude) return { ok: false, error: 'Lokasi outlet belum diatur' }
      if (!order.latitude || !order.longitude) return { ok: false, error: 'Lokasi pengantaran belum ada' }
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { Authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_id: order.id,
          shipper_contact_name: outlet.name, shipper_contact_phone: outlet.phone || '081200000000',
          origin_contact_name: outlet.name, origin_contact_phone: outlet.phone || '081200000000',
          origin_address: outlet.address || outlet.name,
          origin_coordinate: { latitude: outlet.latitude, longitude: outlet.longitude },
          destination_contact_name: cust?.name || 'Pelanggan', destination_contact_phone: cust?.phone || '081200000000',
          destination_address: order.delivery_address || '-',
          destination_coordinate: { latitude: order.latitude, longitude: order.longitude },
          courier_company: courierCode, courier_type: serviceCode, delivery_type: 'now',
          items: (items?.length ? items : [{ quantity: 1, price: order.total_price, products: { name: 'Minuman' } }]).map((i: any) => ({
            name: i.products?.name || 'Minuman', quantity: i.quantity, value: Number(i.price) || 0, weight: 500,
          })),
        }),
      })
      const d = await res.json()
      if (!res.ok || d.success === false) {
        await save({ courier_code: courierCode, courier_service_code: serviceCode, courier_status: 'booking_failed' })
        console.error('book failed', d)
        return { ok: false, error: d.error || 'Gagal memanggil kurir' }
      }
      await save({
        courier_code: courierCode, courier_service_code: serviceCode,
        courier_name: `${d.courier?.company ?? courierCode}`.toUpperCase(),
        courier_order_id: d.id, courier_waybill: d.courier?.waybill_id ?? null,
        courier_status: d.status ?? 'confirmed', courier_tracking_url: d.courier?.link ?? null,
        courier_driver_name: d.courier?.name ?? null, courier_driver_phone: d.courier?.phone ?? null,
      })
      return { ok: true }
    }

    if (b.action === 'book') {
      if (order.courier_order_id) return json({ ok: true, already: true })
      if (!b.courier_code || !b.service_code) return json({ error: 'Kurir belum dipilih' }, 400)
      return json(await book(b.courier_code, b.service_code))
    }

    // track: retry booking if it previously failed, otherwise refresh status
    if (!order.courier_order_id) {
      if (order.courier_code && order.courier_service_code && !['cancelled', 'pending_payment'].includes(order.status)) {
        await book(order.courier_code, order.courier_service_code)
      }
    } else {
      const res = await fetch(`${API}/orders/${order.courier_order_id}`, { headers: { Authorization: key } })
      const d = await res.json()
      if (res.ok && d.success !== false) {
        const st = d.status as string
        const patch: Record<string, unknown> = {
          courier_status: st,
          courier_waybill: d.courier?.waybill_id ?? order.courier_waybill,
          courier_tracking_url: d.courier?.link ?? order.courier_tracking_url,
          courier_driver_name: d.courier?.name ?? order.courier_driver_name,
          courier_driver_phone: d.courier?.phone ?? order.courier_driver_phone,
        }
        if (st === 'delivered') patch.status = 'delivered'
        await save(patch)
      }
    }
    const { data: fresh } = await admin.from('customer_orders').select(
      'id, status, courier_name, courier_status, courier_waybill, courier_tracking_url, courier_driver_name, courier_driver_phone',
    ).eq('id', order.id).maybeSingle()
    return json({ order: fresh })
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
