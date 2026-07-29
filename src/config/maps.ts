// Google Maps API Configuration
// Uses the browser-safe key provisioned by the Lovable-managed Google Maps Platform connector.
// Restricted to *.lovable.app and *.lovableproject.com referrers.
const browserKey =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ||
  '';

const trackingId =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID as string | undefined) ||
  '';

export const GOOGLE_MAPS_API_KEY = browserKey;

export const GOOGLE_MAPS_TRACKING_ID = trackingId;

export const isGoogleMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY);

export const buildMapsScriptUrl = (extraParams: Record<string, string> = {}): string => {
  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    loading: 'async',
    ...(GOOGLE_MAPS_TRACKING_ID ? { channel: GOOGLE_MAPS_TRACKING_ID } : {}),
    ...extraParams,
  });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};
