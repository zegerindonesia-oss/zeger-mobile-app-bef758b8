declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, options?: MapOptions);
      fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
      setCenter(latLng: LatLngLiteral): void;
      setZoom(zoom: number): void;
    }

    class Marker {
      constructor(options?: MarkerOptions);
      setPosition(latLng: LatLngLiteral): void;
      setMap(map: Map | null): void;
    }

    class Polyline {
      constructor(options?: PolylineOptions);
      setPath(path: LatLngLiteral[]): void;
      setMap(map: Map | null): void;
    }

    class LatLngBounds {
      constructor();
      extend(latLng: LatLngLiteral): LatLngBounds;
    }

    class Geocoder {
      geocode(request: GeocoderRequest, callback: (results: GeocoderResult[], status: string) => void): void;
    }

    interface GeocoderRequest {
      location?: LatLngLiteral;
      address?: string;
    }

    interface GeocoderResult {
      formatted_address: string;
      geometry: { location: { lat(): number; lng(): number } };
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapOptions {
      center?: LatLngLiteral;
      zoom?: number;
      mapTypeControl?: boolean;
      fullscreenControl?: boolean;
      streetViewControl?: boolean;
      zoomControl?: boolean;
      styles?: any[];
    }

    interface MarkerOptions {
      position?: LatLngLiteral;
      map?: Map;
      icon?: string | Symbol | Icon;
      title?: string;
      draggable?: boolean;
      label?: string | MarkerLabel;
    }

    interface MarkerLabel {
      text: string;
      color?: string;
      fontSize?: string;
      fontWeight?: string;
    }

    interface Icon {
      url?: string;
      scaledSize?: Size;
      path?: number;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
    }

    interface Symbol {
      path: number;
      scale?: number;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
    }

    interface PolylineOptions {
      path?: LatLngLiteral[];
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      map?: Map;
    }

    interface Padding {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }

    interface Size {
      width: number;
      height: number;
    }

    const SymbolPath: {
      CIRCLE: number;
      FORWARD_CLOSED_ARROW: number;
      FORWARD_OPEN_ARROW: number;
      BACKWARD_CLOSED_ARROW: number;
      BACKWARD_OPEN_ARROW: number;
    };

    namespace event {
      function addListener(instance: any, eventName: string, handler: (...args: any[]) => void): any;
      function removeListener(listener: any): void;
    }
  }
}
