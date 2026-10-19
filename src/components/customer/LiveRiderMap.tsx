import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const VESPA_SVG = (selected = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${selected ? 58 : 46}" height="${selected ? 58 : 46}" viewBox="0 0 64 64">
<circle cx="32" cy="32" r="30" fill="#ffffff" stroke="#EA2831" stroke-width="${selected ? 4 : 3}"/>
<g fill="#EA2831">
<path d="M22 22h8l2 4h-6z"/>
<path d="M30 26c6 0 10 4 11 10l3 6H18c0-7 5-16 12-16z"/>
<path d="M40 24l4-6h4l-1 3h-2l-3 6z"/>
<rect x="24" y="20" width="10" height="3" rx="1.5"/>
</g>
<circle cx="20" cy="44" r="6" fill="#1f2937"/><circle cx="20" cy="44" r="2.5" fill="#fff"/>
<circle cx="45" cy="44" r="6" fill="#1f2937"/><circle cx="45" cy="44" r="2.5" fill="#fff"/>
</svg>`;

export interface MapRider { id: string; full_name: string; lat: number | null; lng: number | null; distance_km: number }

interface Props {
  center: { lat: number; lng: number };
  riders: MapRider[];
  focusedId: string | null;
  onSelect: (id: string) => void;
}

/** Interactive OpenStreetMap with red Vespa markers per live rider. */
export default function LiveRiderMap({ center, riders, focusedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, attributionControl: false }).setView([center.lat, center.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map.current);
    L.circleMarker([center.lat, center.lng], { radius: 9, color: '#fff', weight: 4, fillColor: '#3b82f6', fillOpacity: 1 })
      .addTo(map.current).bindTooltip('Lokasi kamu');
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts: L.LatLngExpression[] = [[center.lat, center.lng]];
    riders.forEach(r => {
      if (r.lat == null || r.lng == null) return;
      const sel = r.id === focusedId;
      const size = sel ? 58 : 46;
      const icon = L.divIcon({ html: VESPA_SVG(sel), className: 'cx-vespa-pin', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      L.marker([r.lat, r.lng], { icon, zIndexOffset: sel ? 1000 : 0 })
        .addTo(layer.current!)
        .bindTooltip(`${r.full_name} · ${r.distance_km.toFixed(1)} km`, { direction: 'top', offset: [0, -size / 2] })
        .on('click', () => onSelect(r.id));
      pts.push([r.lat, r.lng]);
    });
    const focused = riders.find(r => r.id === focusedId && r.lat != null);
    if (focused) map.current.setView([focused.lat!, focused.lng!], Math.max(map.current.getZoom(), 15), { animate: true });
    else if (pts.length > 1) map.current.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
  }, [riders, focusedId, center.lat, center.lng]);

  return <div ref={el} className="absolute inset-0 z-0" />;
}
