import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface LocationData {
  location_name: string;
  latitude: number;
  longitude: number;
  customer_name: string;
  rider_name: string;
  products_sold: string;
  total_sales: number;
  transaction_count: number;
}

interface LocationMapProps {
  data: LocationData[];
  onMarkerClick: (lat: number, lng: number) => void;
}

export const LocationMap = ({ data, onMarkerClick }: LocationMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Set Mapbox access token
  mapboxgl.accessToken = 'pk.eyJ1IjoibG92YWJsZS1tYXBib3giLCJhIjoiY2xqeXc1azRqMXoxcjNrbXQzY2FhZTFmZSJ9.tLFU0Gb7QgfD4sc8JqVLdQ';

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map centered on Indonesia
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [110.0, -2.5], // Indonesia center
      zoom: 5
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl());

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !data.length) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Create markers for each location
    const bounds = new mapboxgl.LngLatBounds();
    
    data.forEach((location) => {
      const { latitude, longitude, location_name, total_sales, transaction_count, customer_name, rider_name } = location;
      
      // Create custom marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'custom-marker';
      markerEl.style.cssText = `
        width: 40px;
        height: 40px;
        background: #3B82F6;
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;
      
      // Display sales amount in K format
      const salesText = total_sales >= 1000 ? `${Math.round(total_sales / 1000)}K` : `${Math.round(total_sales)}`;
      markerEl.textContent = salesText;

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-64">
          <h3 class="font-semibold text-base mb-2">${location_name}</h3>
          <div class="space-y-1 text-sm">
            <div><strong>Customer:</strong> ${customer_name}</div>
            <div><strong>Rider:</strong> ${rider_name}</div>
            <div><strong>Total Sales:</strong> 
              <span class="text-green-600 font-medium">
                Rp ${total_sales.toLocaleString('id-ID')}
              </span>
            </div>
            <div><strong>Transaksi:</strong> ${transaction_count}</div>
          </div>
          <button 
            onclick="window.open('https://www.google.com/maps?q=${latitude},${longitude}', '_blank')"
            class="mt-2 w-full px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Buka di Google Maps
          </button>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false
      }).setHTML(popupContent);

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Add click handler
      markerEl.addEventListener('click', () => {
        onMarkerClick(latitude, longitude);
      });

      markers.current.push(marker);
      bounds.extend([longitude, latitude]);
    });

    // Fit map to show all markers
    if (data.length > 0) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    }
  }, [data, onMarkerClick]);

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium mb-2">Tidak ada data lokasi</div>
          <div className="text-sm">Silakan pilih filter yang berbeda</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
};