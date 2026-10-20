import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'

// Instant couriers suitable for F&B (hot/cold drinks, short distance)
const COURIERS = 'gojek,grab,shopee,lalamove,borzo'
const INSTANT = new Set(['instant', 'same_day_instant', 'motor', 'instant_bike'])

const Body = z.object({
  outlet_id: z.string().uuid(),
  dest_lat: z.number().min(-90).max(90),
  dest_lng: z.number().min(-180).max(180),
  value: z.number().min(0).max(100_000_000),
  items: z.array(z.object({ name: z.string().max(200), quantity: z.number().int().min(1).max(999), value: z.number().min(0) })).max(100).optional(),
})

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const key = Deno.env.get('BITESHIP_API_KEY')
    if (!key) return json({ error: 'Biteship belum dikonfigurasi' }, 500)
    const parsed = Body.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const b = parsed.data

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: outlet } = await sb.from('branches').select('latitude, longitude').eq('id', b.outlet_id).maybeSingle()
    const o = outlet as { latitude?: number; longitude?: number } | null
    if (!o?.latitude || !o?.longitude) return json({ error: 'Lokasi outlet belum diatur', rates: [] }, 200)

    const res = await fetch('https://api.biteship.com/v1/rates/couriers', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_latitude: o.latitude, origin_longitude: o.longitude,
        destination_latitude: b.dest_lat, destination_longitude: b.dest_lng,
        couriers: COURIERS,
        items: (b.items?.length ? b.items : [{ name: 'Minuman', quantity: 1, value: b.value }])
          .map((i) => ({ ...i, weight: 500 })),
      }),
    })
    const data = await res.json()
    if (!res.ok || data.success === false) return json({ error: data.error || 'Gagal cek ongkir', rates: [] }, 200)
    const rates = (data.pricing || [])
      .filter((p: any) => INSTANT.has(String(p.courier_service_code)) || /instant|motor|bike/i.test(p.courier_service_name || ''))
      .map((p: any) => ({
        courier_code: p.courier_code, service_code: p.courier_service_code,
        name: `${p.courier_name} ${p.courier_service_name}`,
        price: p.price, eta: p.duration || p.shipment_duration_range,
      }))
      .sort((a: any, b: any) => a.price - b.price)
    return json({ rates })
  } catch (e) {
    return json({ error: (e as Error).message, rates: [] }, 500)
  }
})
