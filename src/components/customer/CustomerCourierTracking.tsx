import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Phone, Check, ExternalLink, Store, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { VESPA_SVG } from './LiveRiderMap';

interface Props { orderId: string; onBack: () => void; onCompleted: () => void }

const STEPS = [
  { key: 'prep', label: 'Pesanan disiapkan outlet' },
  { key: 'driver', label: 'Driver menuju outlet' },
  { key: 'otw', label: 'Pesanan dalam perjalanan' },
  { key: 'done', label: 'Pesanan sampai' },
];

/** Maps courier statuses to a simple 4-step progress the customer understands. */
export function courierStep(s?: string | null): number {
  if (!s || ['confirmed', 'booking_failed', 'pending'].includes(s)) return 0;
  if (['allocated', 'picking_up'].includes(s)) return 1;
  if (['picked', 'dropping_off', 'on_hold'].includes(s)) return 2;
  if (s === 'delivered') return 3;
  return 0;
}

export default function CustomerCourierTracking({ orderId, onBack, onCompleted }: Props) {
  const [order, setOrder] = useState<any>(null);
  const [outlet, setOutlet] = useState<any>(null);
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from('customer_orders').select('*').eq('id', orderId).maybeSingle();
      if (!alive || !data) return;
      setOrder(data);
      if (data.outlet_id && !outlet) {
        const { data: b } = await supabase.from('branches').select('name, address, latitude, longitude').eq('id', data.outlet_id).maybeSingle();
        if (alive) setOutlet(b);
      }
    };
    const refresh = async () => {
      await supabase.functions.invoke('courier-delivery', { body: { action: 'track', order_id: orderId } }).catch(() => null);
      load();
    };
    load(); refresh();
    const t = setInterval(refresh, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [orderId]);

  useEffect(() => {
    if (!el.current || !order?.latitude || map.current) return;
    map.current = L.map(el.current, { attributionControl: false }).setView([order.latitude, order.longitude], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map.current);
    L.circleMarker([order.latitude, order.longitude], { radius: 9, color: '#fff', weight: 4, fillColor: '#3b82f6', fillOpacity: 1 })
      .addTo(map.current).bindTooltip('Lokasi kamu', { permanent: true, direction: 'top' });
    return () => { map.current?.remove(); map.current = null; };
  }, [order?.latitude]);

  const step = courierStep(order?.courier_status);

  useEffect(() => {
    if (!map.current || !outlet?.latitude || !order?.latitude) return;
    const icon = L.divIcon({ html: VESPA_SVG(true), className: 'cx-vespa-pin', iconSize: [58, 58], iconAnchor: [29, 29] });
    // Without live GPS from the courier, place the driver along the route by progress.
    const f = [0, 0, 0.5, 1][step];
    const lat = outlet.latitude + (order.latitude - outlet.latitude) * f;
    const lng = outlet.longitude + (order.longitude - outlet.longitude) * f;
    const layer = L.layerGroup().addTo(map.current);
    L.marker([outlet.latitude, outlet.longitude]).addTo(layer).bindTooltip(outlet.name);
    L.polyline([[outlet.latitude, outlet.longitude], [order.latitude, order.longitude]], { color: '#EA2831', weight: 4, dashArray: '8 8' }).addTo(layer);
    if (step >= 1) L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(layer);
    map.current.fitBounds(L.latLngBounds([[outlet.latitude, outlet.longitude], [order.latitude, order.longitude]]), { padding: [40, 40] });
    return () => { layer.remove(); };
  }, [outlet, order?.latitude, step]);

  const statusText = !order ? 'Memuat…'
    : order.courier_status === 'cancelled' ? 'Pengantaran dibatalkan, outlet akan menghubungi kamu'
    : ['Kami sedang mencarikan driver untukmu', 'Driver sedang menuju outlet', 'Driver sedang mengantar pesananmu', 'Pesanan sudah sampai. Selamat menikmati!'][step];

  return (
    <div className="cx-app min-h-screen bg-background pb-8">
      <div className="relative">
        <div ref={el} className="h-[52vh] w-full bg-muted" />
        <button onClick={onBack} aria-label="Kembali" className="absolute left-4 top-4 z-[500] rounded-full bg-card p-2.5 shadow-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="relative -mt-6 z-[500] mx-3 rounded-3xl bg-card p-5 shadow-xl space-y-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status pesanan</p>
          <h2 className="text-lg font-bold">{statusText}</h2>
        </div>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-3">
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold',
                i < step || step === 3 ? 'bg-primary border-primary text-primary-foreground'
                  : i === step ? 'border-primary text-primary animate-pulse' : 'border-muted text-muted-foreground')}>
                {i < step || step === 3 ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn('text-sm', i <= step ? 'font-semibold' : 'text-muted-foreground')}>{s.label}</span>
            </li>
          ))}
        </ol>
        {order?.courier_driver_name && (
          <div className="flex items-center justify-between rounded-2xl bg-muted p-3">
            <div>
              <p className="text-sm font-semibold">{order.courier_driver_name}</p>
              <p className="text-xs text-muted-foreground">{order.courier_name}{order.courier_waybill ? ` · ${order.courier_waybill}` : ''}</p>
            </div>
            {order.courier_driver_phone && (
              <a href={`tel:${order.courier_driver_phone}`} className="rounded-full bg-primary p-2.5 text-primary-foreground" aria-label="Telepon driver">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
        <div className="space-y-2 text-sm">
          <p className="flex gap-2"><Store className="h-4 w-4 shrink-0 text-primary" />{outlet?.name || '-'}</p>
          <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" />{order?.delivery_address || '-'}</p>
        </div>
        {order?.courier_tracking_url && (
          <a href={order.courier_tracking_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold">
            Lihat posisi driver live <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {step === 3 && (
          <button onClick={onCompleted} className="w-full rounded-2xl bg-primary p-3.5 font-bold text-primary-foreground">Selesai</button>
        )}
      </div>
    </div>
  );
}
