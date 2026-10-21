import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  value: { lat: number; lng: number } | null;
  fallback: { lat: number; lng: number };
  onChange: (p: { lat: number; lng: number }) => void;
}

const pinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 47s16-15.6 16-27A16 16 0 0 0 4 20c0 11.4 16 27 16 27z" fill="#EA2831" stroke="#fff" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="#fff"/></svg>`,
  iconSize: [40, 48],
  iconAnchor: [20, 46],
});

/** Tap or drag the pin to set the delivery point. */
export default function AddressPinMap({ value, fallback, onChange }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const start = value || fallback;
    const m = L.map(el.current, { zoomControl: true, attributionControl: false }).setView([start.lat, start.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    const mk = L.marker([start.lat, start.lng], { icon: pinIcon, draggable: true }).addTo(m);
    mk.on('dragend', () => { const p = mk.getLatLng(); cb.current({ lat: p.lat, lng: p.lng }); });
    m.on('click', (e: L.LeafletMouseEvent) => { mk.setLatLng(e.latlng); cb.current({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    map.current = m; marker.current = mk;
    if (!value) cb.current(start);
    setTimeout(() => m.invalidateSize(), 200);
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && marker.current && map.current) {
      const cur = marker.current.getLatLng();
      if (Math.abs(cur.lat - value.lat) > 1e-6 || Math.abs(cur.lng - value.lng) > 1e-6) {
        marker.current.setLatLng([value.lat, value.lng]);
        map.current.setView([value.lat, value.lng], 16);
      }
    }
  }, [value]);

  return <div ref={el} className="h-56 w-full rounded-2xl overflow-hidden z-0" />;
}
